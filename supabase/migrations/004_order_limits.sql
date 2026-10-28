-- =============================================================================
-- 004: Order limits hardening (security audit)
--   * One checkout at a time per customer (advisory lock), so parallel requests
--     cannot slip past the unpaid-order cap.
--   * Quantity caps per product (summed across sizes/lines) and per order, so
--     repeating a product on many lines cannot reserve the whole inventory.
--   * Product rows are locked in a fixed order, avoiding deadlocks between
--     concurrent checkouts that share products.
--   * Name/address length limits match the checkout form.
-- Signature is unchanged, so the live site keeps working before and after this runs.
-- Safe to re-run.
-- =============================================================================

create or replace function public.place_order(
  p_items             jsonb,
  p_customer_name     text,
  p_shipping_address  jsonb,
  p_payment_mode      public.payment_mode
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_prepaid_discount_rate constant numeric := 0.05;
  c_partial_cod_advance   constant numeric := 150;
  c_max_lines             constant int     := 20;
  c_max_qty_per_product   constant int     := 10;
  c_max_pieces            constant int     := 20;
  c_max_unpaid_orders     constant int     := 3;

  v_user_id    uuid := auth.uid();
  v_phone      text;
  v_item       jsonb;
  v_product    public.products;
  v_qty        int;
  v_size       text;
  v_total_mrp  numeric := 0;
  v_subtotal   numeric := 0;
  v_discount   numeric := 0;
  v_final      numeric;
  v_order      public.orders;
begin
  if v_user_id is null then
    raise exception 'Please verify your mobile number to place an order' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('place_order:' || v_user_id::text, 0));

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your bag is empty' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) > c_max_lines then
    raise exception 'Please place orders of up to % different items at a time', c_max_lines using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
     where jsonb_typeof(e) <> 'object'
        or coalesce(e ->> 'product_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or coalesce(e ->> 'quantity', '') !~ '^[0-9]{1,3}$'
        or (e ->> 'quantity')::int < 1
  ) then
    raise exception 'Invalid item in your bag' using errcode = '22023';
  end if;

  if (select sum((e ->> 'quantity')::int) from jsonb_array_elements(p_items) e) > c_max_pieces then
    raise exception 'Please order up to % pieces at a time', c_max_pieces using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
     group by e ->> 'product_id'
    having sum((e ->> 'quantity')::int) > c_max_qty_per_product
  ) then
    raise exception 'Please order up to % of any one design at a time', c_max_qty_per_product using errcode = '22023';
  end if;

  if coalesce(trim(p_customer_name), '') = '' or length(trim(p_customer_name)) > 80 then
    raise exception 'Please enter your full name (up to 80 characters)' using errcode = '22023';
  end if;

  if jsonb_typeof(p_shipping_address) <> 'object'
     or not (p_shipping_address ?& array['address_line', 'city', 'state', 'pincode'])
     or (p_shipping_address ->> 'pincode') !~ '^[1-9][0-9]{5}$'
     or length(trim(p_shipping_address ->> 'address_line')) not between 8 and 200
     or length(trim(p_shipping_address ->> 'city')) not between 2 and 60
     or length(p_shipping_address ->> 'state') not between 2 and 60
     or length(coalesce(p_shipping_address ->> 'landmark', '')) > 100 then
    raise exception 'A complete shipping address with a valid 6-digit pincode is required' using errcode = '22023';
  end if;

  select u.phone into v_phone from auth.users u where u.id = v_user_id;
  if coalesce(v_phone, '') = '' then
    raise exception 'Mobile number not verified' using errcode = '28000';
  end if;

  if (select count(*) from public.orders o
       where o.user_id = v_user_id and o.payment_status = 'PENDING' and o.order_status = 'PLACED') >= c_max_unpaid_orders then
    raise exception 'You already have % orders awaiting payment. Please pay for them or message us on WhatsApp before placing another.',
      c_max_unpaid_orders using errcode = 'P0001';
  end if;

  -- Lock every product in the bag up front, in id order.
  perform 1
     from public.products p
    where p.id in (select (e ->> 'product_id')::uuid from jsonb_array_elements(p_items) e)
    order by p.id
      for update;

  insert into public.orders (
    order_number, user_id, customer_phone, customer_name, shipping_address,
    final_amount, payment_mode
  ) values (
    public.generate_order_number(), v_user_id, '+' || ltrim(v_phone, '+'), trim(p_customer_name), p_shipping_address,
    0, p_payment_mode
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := (v_item ->> 'quantity')::int;
    v_size := nullif(v_item ->> 'selected_size', '');

    select * into v_product
      from public.products
     where id = (v_item ->> 'product_id')::uuid;

    if not found then
      raise exception 'A product in your bag is no longer available' using errcode = 'P0002';
    end if;

    if not v_product.in_stock or v_product.stock_count < v_qty then
      raise exception '% is out of stock', v_product.title using errcode = 'P0001';
    end if;

    if cardinality(v_product.available_sizes) > 0
       and (v_size is null or not (v_size = any (v_product.available_sizes))) then
      raise exception 'Please choose a valid size for %', v_product.title using errcode = '22023';
    end if;

    insert into public.order_items (order_id, product_id, product_title, quantity, unit_price, selected_size)
    values (v_order.id, v_product.id, v_product.title, v_qty, v_product.sale_price, v_size);

    update public.products
       set stock_count = stock_count - v_qty,
           in_stock    = (stock_count - v_qty) > 0
     where id = v_product.id;

    v_total_mrp := v_total_mrp + v_product.mrp * v_qty;
    v_subtotal  := v_subtotal  + v_product.sale_price * v_qty;
  end loop;

  if p_payment_mode = 'PREPAID_UPI' then
    v_discount := round(v_subtotal * c_prepaid_discount_rate);
  end if;

  v_final := v_subtotal - v_discount;

  if p_payment_mode = 'PARTIAL_COD' and v_final <= c_partial_cod_advance then
    raise exception 'Partial COD is available on orders above ₹%', c_partial_cod_advance using errcode = '22023';
  end if;

  update public.orders
     set total_mrp               = v_total_mrp,
         discount_amount         = v_total_mrp - v_final,
         final_amount            = v_final,
         balance_due_on_delivery = case when p_payment_mode = 'PARTIAL_COD' then v_final - c_partial_cod_advance else 0 end
   where id = v_order.id
  returning * into v_order;

  update public.profiles
     set full_name = trim(p_customer_name)
   where id = v_user_id and coalesce(full_name, '') = '';

  return v_order;
end;
$$;

revoke all on function public.place_order(jsonb, text, jsonb, public.payment_mode) from public, anon;
grant execute on function public.place_order(jsonb, text, jsonb, public.payment_mode) to authenticated;
