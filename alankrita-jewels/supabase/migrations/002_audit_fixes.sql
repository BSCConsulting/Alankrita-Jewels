-- =============================================================================
-- Alankrita Jewels — audit fixes (October 2026)
-- Paste into Supabase → SQL Editor and run once. Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Phone login: look customers up by their *verified* number in auth.users.
--    profiles.phone was customer-editable, so a customer could claim someone
--    else's number and be signed into that account at their next OTP login.
-- -----------------------------------------------------------------------------
create or replace function public.user_id_by_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
    from auth.users u
   where u.phone in (ltrim(p_phone, '+'), '+' || ltrim(p_phone, '+'))
   order by u.created_at
   limit 1;
$$;

revoke all on function public.user_id_by_phone(text) from public, anon, authenticated;
grant execute on function public.user_id_by_phone(text) to service_role;

-- Customers may only change their display name; phone and role are managed by the system.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Undo any tampering: profiles.phone mirrors the verified number in auth.users.
update public.profiles p
   set phone = null
  from auth.users u
 where p.id = u.id
   and p.phone is distinct from nullif(u.phone, '');

update public.profiles p
   set phone = nullif(u.phone, '')
  from auth.users u
 where p.id = u.id
   and p.phone is null
   and nullif(u.phone, '') is not null;

-- -----------------------------------------------------------------------------
-- 2. Restock on cancel: return the quantity, but keep a product the admin
--    deliberately marked "out of stock" hidden.
-- -----------------------------------------------------------------------------
create or replace function public.restock_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_status = 'CANCELLED' and old.order_status <> 'CANCELLED' then
    update public.products p
       set stock_count = p.stock_count + returned.qty,
           in_stock    = p.in_stock or p.stock_count = 0
      from (
        select oi.product_id, sum(oi.quantity)::int as qty
          from public.order_items oi
         where oi.order_id = new.id and oi.product_id is not null
         group by oi.product_id
      ) returned
     where returned.product_id = p.id;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Order status can only move forward. Prevents double restocks
--    (CANCELLED → PLACED → CANCELLED) and reviving cancelled orders.
--    The SQL editor, service role and cron (no signed-in user) are exempt.
-- -----------------------------------------------------------------------------
create or replace function public.guard_order_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_status is distinct from old.order_status and auth.uid() is not null
     and not (
       (old.order_status = 'PLACED'     and new.order_status in ('CONFIRMED', 'DISPATCHED', 'CANCELLED')) or
       (old.order_status = 'CONFIRMED'  and new.order_status in ('DISPATCHED', 'CANCELLED')) or
       (old.order_status = 'DISPATCHED' and new.order_status in ('DELIVERED', 'CANCELLED'))
     ) then
    raise exception 'An order cannot move from % to %', old.order_status, new.order_status using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_status on public.orders;
create trigger orders_guard_status
  before update of order_status on public.orders
  for each row execute function public.guard_order_status();

-- -----------------------------------------------------------------------------
-- 4. place_order: cap bag size and unpaid orders per customer so one account
--    cannot lock up the whole inventory with orders it never pays for.
-- -----------------------------------------------------------------------------
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

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your bag is empty' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) > c_max_lines then
    raise exception 'Please place orders of up to % different items at a time', c_max_lines using errcode = '22023';
  end if;

  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Customer name is required' using errcode = '22023';
  end if;

  if not (p_shipping_address ?& array['address_line', 'city', 'state', 'pincode'])
     or (p_shipping_address ->> 'pincode') !~ '^[1-9][0-9]{5}$' then
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

  insert into public.orders (
    order_number, user_id, customer_phone, customer_name, shipping_address,
    final_amount, payment_mode
  ) values (
    public.generate_order_number(), v_user_id, '+' || ltrim(v_phone, '+'), trim(p_customer_name), p_shipping_address,
    0, p_payment_mode
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := coalesce((v_item ->> 'quantity')::int, 0);
    v_size := nullif(v_item ->> 'selected_size', '');

    if v_qty < 1 or v_qty > 10 then
      raise exception 'Invalid quantity' using errcode = '22023';
    end if;

    -- Row lock prevents overselling under concurrent checkouts.
    select * into v_product
      from public.products
     where id = (v_item ->> 'product_id')::uuid
     for update;

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

-- -----------------------------------------------------------------------------
-- 5. Admin product saves in one transaction: a failed save can no longer leave
--    a product with its photos deleted. SECURITY INVOKER, so RLS still applies.
--    p_product: products columns as JSON; p_media: [{ media_type, url, is_thumbnail, display_order }]
-- -----------------------------------------------------------------------------
create or replace function public.admin_save_product(p_id uuid, p_product jsonb, p_media jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r    public.products := jsonb_populate_record(null::public.products, p_product);
  v_id uuid := p_id;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if v_id is null then
    insert into public.products (
      title, telugu_title, slug, description, category_id, mrp, sale_price, jewellery_type,
      plating_type, warranty_details, available_sizes, stock_count, in_stock, featured
    ) values (
      r.title, r.telugu_title, r.slug, r.description, r.category_id, r.mrp, r.sale_price, r.jewellery_type,
      r.plating_type, r.warranty_details, coalesce(r.available_sizes, '{}'), r.stock_count, r.in_stock, r.featured
    )
    returning id into v_id;
  else
    update public.products
       set title = r.title, telugu_title = r.telugu_title, slug = r.slug, description = r.description,
           category_id = r.category_id, mrp = r.mrp, sale_price = r.sale_price, jewellery_type = r.jewellery_type,
           plating_type = r.plating_type, warranty_details = r.warranty_details,
           available_sizes = coalesce(r.available_sizes, '{}'), stock_count = r.stock_count,
           in_stock = r.in_stock, featured = r.featured
     where id = v_id;
    if not found then
      raise exception 'This product no longer exists' using errcode = 'P0002';
    end if;
    delete from public.product_media where product_id = v_id;
  end if;

  insert into public.product_media (product_id, media_type, url, is_thumbnail, display_order)
  select v_id, m.media_type, m.url, coalesce(m.is_thumbnail, false), coalesce(m.display_order, 0)
    from jsonb_to_recordset(coalesce(p_media, '[]')) as m(media_type public.media_type, url text, is_thumbnail boolean, display_order int);

  return v_id;
end;
$$;

revoke all on function public.admin_save_product(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_product(uuid, jsonb, jsonb) to authenticated;

-- Bulk CSV import: all rows or none. p_rows: [{ product: {...}, media: [...] }]
create or replace function public.admin_bulk_insert_products(p_rows jsonb)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row   jsonb;
  v_count int := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]')) loop
    perform public.admin_save_product(null, v_row -> 'product', v_row -> 'media');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.admin_bulk_insert_products(jsonb) from public, anon;
grant execute on function public.admin_bulk_insert_products(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. OPTIONAL — auto-cancel unpaid orders and release their stock.
--    While payments are collected manually over WhatsApp/UPI, use a long window
--    so a customer who pays late is not cancelled before you mark them paid.
--    To enable: Database → Extensions → enable pg_cron, then run:
--
--    select cron.schedule('cancel-stale-orders', '0 * * * *',
--      $$select public.cancel_stale_pending_orders(interval '48 hours')$$);
-- -----------------------------------------------------------------------------
