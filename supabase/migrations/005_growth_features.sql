-- =============================================================================
-- Alankrita Jewels — growth features (October 2026)
-- Paste into Supabase → SQL Editor and run once. Safe to re-run.
--
--   1. Full cash on delivery (fee, amount cap, open-order cap, per-customer block)
--   2. Offers: cart-value tiers, bridal set saving, coupons, free gift
--   3. Gifting: gift wrap, gift message, gift cards
--   4. Product tags for filters (occasion, stone) and grid thumbnails
--   5. Verified-purchase reviews with photos (moderated)
--   6. Back-in-stock requests, "frequently bought together", re-polish guarantee dates
--   7. Sales funnel events (first-party, no personal data)
--
-- Every amount below is mirrored in src/config/site.ts (PAYMENT_RULES, OFFER_RULES);
-- tests/pricingParity.test.ts reads this file and fails if they drift apart.
-- =============================================================================

alter type public.payment_mode add value if not exists 'COD';

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists occasions text[] not null default '{}',
  add column if not exists stones    text[] not null default '{}';

alter table public.products drop constraint if exists products_occasions_valid;
alter table public.products add constraint products_occasions_valid
  check (occasions <@ array['wedding', 'festival', 'daily', 'office', 'party']);
alter table public.products drop constraint if exists products_stones_valid;
alter table public.products add constraint products_stones_valid
  check (stones <@ array['kempu', 'emerald', 'pearl', 'cz', 'plain']);

alter table public.product_media add column if not exists thumb_url text;

alter table public.profiles add column if not exists cod_blocked boolean not null default false;

create table if not exists public.coupons (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  description         text check (char_length(description) <= 120),
  kind                text not null check (kind in ('percent', 'flat')),
  value               numeric(10, 2) not null check (value > 0),
  min_subtotal        numeric(10, 2) not null default 0 check (min_subtotal >= 0),
  max_discount        numeric(10, 2) check (max_discount > 0),
  first_order_only    boolean not null default false,
  usage_limit         int check (usage_limit > 0),
  per_customer_limit  int not null default 1 check (per_customer_limit > 0),
  starts_at           timestamptz,
  ends_at             timestamptz,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  constraint coupons_percent_range check (kind <> 'percent' or value <= 50),
  constraint coupons_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.gift_cards (
  id              uuid primary key default gen_random_uuid(),
  -- 12+ random characters: too many combinations to guess, even with many attempts.
  code            text not null unique check (code ~ '^[A-Z0-9]{12,20}$'),
  initial_amount  numeric(10, 2) not null check (initial_amount > 0),
  balance         numeric(10, 2) not null check (balance >= 0),
  recipient_name  text check (char_length(recipient_name) <= 80),
  note            text check (char_length(note) <= 200),
  active          boolean not null default true,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  constraint gift_cards_balance_le_initial check (balance <= initial_amount)
);

alter table public.orders
  add column if not exists subtotal          numeric(10, 2) not null default 0,
  add column if not exists offer_kind        text check (offer_kind in ('tier', 'bundle', 'coupon')),
  add column if not exists offer_label       text,
  add column if not exists offer_discount    numeric(10, 2) not null default 0,
  add column if not exists prepaid_discount  numeric(10, 2) not null default 0,
  add column if not exists coupon_id         uuid references public.coupons (id) on delete set null,
  add column if not exists coupon_code       text,
  add column if not exists cod_fee           numeric(10, 2) not null default 0,
  add column if not exists gift_wrap         boolean not null default false,
  add column if not exists gift_wrap_fee     numeric(10, 2) not null default 0,
  add column if not exists gift_message      text check (char_length(gift_message) <= 200),
  add column if not exists gift_card_id      uuid references public.gift_cards (id) on delete set null,
  add column if not exists gift_card_amount  numeric(10, 2) not null default 0,
  add column if not exists free_gift         text,
  add column if not exists delivered_at      timestamptz;

create index if not exists orders_coupon_idx on public.orders (coupon_id) where coupon_id is not null;
create index if not exists orders_delivered_idx on public.orders (delivered_at) where delivered_at is not null;

-- Backfill without touching updated_at, which the delivered_at backfill below relies on.
alter table public.orders disable trigger orders_set_updated_at;
-- Orders delivered before this migration: best available delivery date.
update public.orders set delivered_at = updated_at where order_status = 'DELIVERED' and delivered_at is null;
update public.orders set subtotal = (select coalesce(sum(oi.unit_price * oi.quantity), 0) from public.order_items oi where oi.order_id = orders.id)
 where subtotal = 0;
alter table public.orders enable trigger orders_set_updated_at;

-- Only cancelled orders can be deleted, so paid order history (and gift card / coupon usage) is never lost by accident.
drop policy if exists "orders: admin delete" on public.orders;
create policy "orders: admin delete" on public.orders for delete to authenticated
  using (public.is_admin() and order_status = 'CANCELLED');

alter table public.coupons    enable row level security;
alter table public.gift_cards enable row level security;

drop policy if exists "coupons: admin all" on public.coupons;
create policy "coupons: admin all" on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "gift_cards: admin all" on public.gift_cards;
create policy "gift_cards: admin all" on public.gift_cards for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Coupons and gift cards: validation shared by checkout previews and place_order
-- -----------------------------------------------------------------------------
create or replace function public.coupon_problem(c public.coupons, p_user uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not c.active then return 'This coupon is no longer active'; end if;
  if c.starts_at is not null and now() < c.starts_at then return 'This coupon is not active yet'; end if;
  if c.ends_at is not null and now() > c.ends_at then return 'This coupon has expired'; end if;
  if c.usage_limit is not null and (
    select count(*) from public.orders o where o.coupon_id = c.id and o.order_status <> 'CANCELLED'
  ) >= c.usage_limit then
    return 'This coupon has been fully redeemed';
  end if;
  if (
    select count(*) from public.orders o where o.coupon_id = c.id and o.user_id = p_user and o.order_status <> 'CANCELLED'
  ) >= c.per_customer_limit then
    return 'You have already used this coupon';
  end if;
  if c.first_order_only and exists (
    select 1 from public.orders o where o.user_id = p_user and o.order_status <> 'CANCELLED'
  ) then
    return 'This coupon is for your first order only';
  end if;
  return null;
end;
$$;

revoke all on function public.coupon_problem(public.coupons, uuid) from public, anon, authenticated;

-- Failed code checks per customer, so coupon and gift card codes cannot be guessed by trying many.
-- The check functions return { valid: false } instead of raising, so the attempt row is kept.
create table if not exists public.code_attempts (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('coupon', 'gift_card')),
  created_at  timestamptz not null default now()
);
create index if not exists code_attempts_user_idx on public.code_attempts (user_id, created_at desc);
alter table public.code_attempts enable row level security;

create or replace function public.too_many_code_attempts(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) >= 10 from public.code_attempts a where a.user_id = p_user and a.created_at > now() - interval '1 hour';
$$;

revoke all on function public.too_many_code_attempts(uuid) from public, anon, authenticated;

create or replace function public.check_coupon(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_coupon  public.coupons;
  v_problem text;
begin
  if v_user is null then
    raise exception 'Please verify your mobile number first' using errcode = '28000';
  end if;
  if public.too_many_code_attempts(v_user) then
    return jsonb_build_object('valid', false, 'message', 'Too many attempts. Please try again in an hour.');
  end if;
  select * into v_coupon from public.coupons where code = upper(trim(coalesce(p_code, '')));
  if not found then
    insert into public.code_attempts (user_id, kind) values (v_user, 'coupon');
    return jsonb_build_object('valid', false, 'message', 'This coupon code is not valid');
  end if;
  v_problem := public.coupon_problem(v_coupon, v_user);
  if v_problem is not null then
    return jsonb_build_object('valid', false, 'message', v_problem);
  end if;
  return jsonb_build_object(
    'valid', true, 'code', v_coupon.code, 'kind', v_coupon.kind, 'value', v_coupon.value, 'min_subtotal', v_coupon.min_subtotal,
    'max_discount', v_coupon.max_discount, 'description', v_coupon.description
  );
end;
$$;

revoke all on function public.check_coupon(text) from public, anon;
grant execute on function public.check_coupon(text) to authenticated;

create or replace function public.check_gift_card(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_card public.gift_cards;
begin
  if v_user is null then
    raise exception 'Please verify your mobile number first' using errcode = '28000';
  end if;
  if public.too_many_code_attempts(v_user) then
    return jsonb_build_object('valid', false, 'message', 'Too many attempts. Please try again in an hour.');
  end if;
  select * into v_card from public.gift_cards where code = upper(trim(coalesce(p_code, '')));
  -- One message for every failure, so a guess never reveals whether a code exists.
  if not found or not v_card.active or v_card.balance <= 0
     or (v_card.expires_at is not null and now() > v_card.expires_at) then
    insert into public.code_attempts (user_id, kind) values (v_user, 'gift_card');
    return jsonb_build_object('valid', false, 'message', 'This gift card is not valid or has no balance left');
  end if;
  return jsonb_build_object('valid', true, 'code', v_card.code, 'balance', v_card.balance);
end;
$$;

revoke all on function public.check_gift_card(text) from public, anon;
grant execute on function public.check_gift_card(text) to authenticated;

-- -----------------------------------------------------------------------------
-- place_order v3. Pricing order (mirrored by computeTotals in src/lib/pricing.ts):
--   subtotal → best single offer (tier | bridal set | coupon) → 5% UPI discount
--   → + COD fee → + gift wrap → − gift card → final amount
-- -----------------------------------------------------------------------------
drop function if exists public.place_order(jsonb, text, jsonb, public.payment_mode);
drop function if exists public.place_order(jsonb, text, jsonb, public.payment_mode, text, text, boolean, text);

-- p_replaces_order_id: the customer's own unpaid order from an earlier checkout attempt (e.g. they
-- changed the address after closing the payment window). It is cancelled first, so its stock, coupon
-- and gift card value are free for the new order.
create or replace function public.place_order(
  p_items             jsonb,
  p_customer_name     text,
  p_shipping_address  jsonb,
  p_payment_mode      public.payment_mode,
  p_coupon_code       text default null,
  p_gift_card_code    text default null,
  p_gift_wrap         boolean default false,
  p_gift_message      text default null,
  p_replaces_order_id uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_prepaid_discount_rate constant numeric   := 0.05;
  c_partial_cod_advance   constant numeric   := 150;
  c_cod_fee               constant numeric   := 49;
  c_cod_max_amount        constant numeric   := 5999;
  c_max_open_cod_orders   constant int       := 2;
  c_max_lines             constant int       := 20;
  c_max_qty_per_product   constant int       := 10;
  c_max_pieces            constant int       := 20;
  c_max_unpaid_orders     constant int       := 3;
  c_tier_mins             constant numeric[] := array[2499, 4999, 9999];
  c_tier_discounts        constant numeric[] := array[150, 350, 800];
  c_bundle_types          constant text[]    := array['1-gram-gold', 'nakshi-temple', 'american-diamond'];
  c_bundle_min_pieces     constant int[]     := array[3, 5];
  c_bundle_rates          constant numeric[] := array[0.07, 0.12];
  c_free_gift_min         constant numeric   := 3999;
  c_free_gift             constant text      := 'Velvet jewellery pouch';
  c_gift_wrap_fee         constant numeric   := 49;
  c_gift_message_max      constant int       := 200;

  v_user_id      uuid := auth.uid();
  v_phone        text;
  v_item         jsonb;
  v_product      public.products;
  v_qty          int;
  v_size         text;
  v_total_mrp    numeric := 0;
  v_subtotal     numeric := 0;
  v_bundle_ids   uuid[] := '{}';
  v_coupon_code  text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  v_card_code    text := nullif(upper(trim(coalesce(p_gift_card_code, ''))), '');
  v_message      text := nullif(trim(coalesce(p_gift_message, '')), '');
  v_coupon       public.coupons;
  v_card         public.gift_cards;
  v_problem      text;
  v_candidate    numeric;
  v_rate         numeric := 0;
  v_offer        numeric := 0;
  v_offer_kind   text;
  v_offer_label  text;
  v_prepaid      numeric := 0;
  v_cod_fee      numeric := 0;
  v_wrap_fee     numeric := 0;
  v_total        numeric;
  v_card_amount  numeric := 0;
  v_final        numeric;
  v_order        public.orders;
  i              int;
begin
  if v_user_id is null then
    raise exception 'Please verify your mobile number to place an order' using errcode = '28000';
  end if;

  -- One checkout at a time per customer, so parallel requests cannot slip past the caps below.
  perform pg_advisory_xact_lock(hashtextextended('place_order:' || v_user_id::text, 0));

  -- Rolled back with everything else if the new order fails, so the earlier order is never lost for nothing.
  if p_replaces_order_id is not null then
    update public.orders
       set order_status = 'CANCELLED', payment_status = 'FAILED'
     where id = p_replaces_order_id
       and user_id = v_user_id
       and payment_status = 'PENDING'
       and order_status = 'PLACED'
       and payment_mode <> 'COD';
  end if;

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

  if coalesce(jsonb_typeof(p_shipping_address), '') <> 'object'
     or not (p_shipping_address ?& array['address_line', 'city', 'state', 'pincode'])
     or (p_shipping_address ->> 'pincode') !~ '^[1-9][0-9]{5}$'
     or length(trim(p_shipping_address ->> 'address_line')) not between 8 and 200
     or length(trim(p_shipping_address ->> 'city')) not between 2 and 60
     or length(p_shipping_address ->> 'state') not between 2 and 60
     or length(coalesce(p_shipping_address ->> 'landmark', '')) > 100 then
    raise exception 'A complete shipping address with a valid 6-digit pincode is required' using errcode = '22023';
  end if;

  if char_length(v_message) > c_gift_message_max then
    raise exception 'Please keep the gift message under % characters', c_gift_message_max using errcode = '22023';
  end if;

  select u.phone into v_phone from auth.users u where u.id = v_user_id;
  if coalesce(v_phone, '') = '' then
    raise exception 'Mobile number not verified' using errcode = '28000';
  end if;

  if (select count(*) from public.orders o
       where o.user_id = v_user_id and o.payment_status = 'PENDING' and o.order_status = 'PLACED'
         and o.payment_mode <> 'COD') >= c_max_unpaid_orders then
    raise exception 'You already have % orders awaiting payment. Please pay for them or message us on WhatsApp before placing another.',
      c_max_unpaid_orders using errcode = 'P0001';
  end if;

  if p_payment_mode = 'COD' then
    if exists (select 1 from public.profiles p where p.id = v_user_id and p.cod_blocked) then
      raise exception 'Cash on delivery is not available for this account. Please pay online or choose Partial COD.' using errcode = 'P0001';
    end if;
    if (select count(*) from public.orders o
         where o.user_id = v_user_id and o.payment_mode = 'COD' and o.payment_status = 'PENDING'
           and o.order_status in ('PLACED', 'CONFIRMED', 'DISPATCHED')) >= c_max_open_cod_orders then
      raise exception 'You already have % cash-on-delivery orders on the way. Please pay online for this one.',
        c_max_open_cod_orders using errcode = 'P0001';
    end if;
  end if;

  -- Coupon checks run before the order exists, so "first order only" ignores the order being placed.
  -- The row lock serialises redemptions so usage limits hold under concurrent checkouts.
  if v_coupon_code is not null then
    select * into v_coupon from public.coupons where code = v_coupon_code for update;
    if not found then
      raise exception 'This coupon code is not valid' using errcode = 'P0002';
    end if;
    v_problem := public.coupon_problem(v_coupon, v_user_id);
    if v_problem is not null then
      raise exception '%', v_problem using errcode = '22023';
    end if;
  end if;

  -- Lock every product in the bag up front, in id order: prevents overselling and deadlocks between checkouts.
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
    if v_product.jewellery_type::text = any (c_bundle_types) and not (v_product.id = any (v_bundle_ids)) then
      v_bundle_ids := v_bundle_ids || v_product.id;
    end if;
  end loop;

  -- Best single offer. Strict ">" keeps the earlier candidate on a tie: tier, then bridal set, then coupon.
  for i in 1 .. array_length(c_tier_mins, 1) loop
    if v_subtotal >= c_tier_mins[i] and c_tier_discounts[i] > v_offer then
      v_offer := c_tier_discounts[i];
      v_offer_kind := 'tier';
      v_offer_label := 'Cart value saving';
    end if;
  end loop;

  for i in 1 .. array_length(c_bundle_min_pieces, 1) loop
    if cardinality(v_bundle_ids) >= c_bundle_min_pieces[i] then
      v_rate := greatest(v_rate, c_bundle_rates[i]);
    end if;
  end loop;
  v_candidate := round(v_subtotal * v_rate);
  if v_candidate > v_offer then
    v_offer := v_candidate;
    v_offer_kind := 'bundle';
    v_offer_label := format('Bridal set saving (%s%% on %s pieces)', round(v_rate * 100), cardinality(v_bundle_ids));
  end if;

  -- Below its minimum the coupon is simply not used (checkout shows why), matching bestOffer() in pricing.ts.
  if v_coupon_code is not null and v_subtotal >= v_coupon.min_subtotal then
    v_candidate := case when v_coupon.kind = 'percent' then round(v_subtotal * v_coupon.value / 100) else v_coupon.value end;
    if v_coupon.max_discount is not null then
      v_candidate := least(v_candidate, v_coupon.max_discount);
    end if;
    v_candidate := least(v_candidate, v_subtotal);
    if v_candidate > v_offer then
      v_offer := v_candidate;
      v_offer_kind := 'coupon';
      v_offer_label := 'Coupon ' || v_coupon.code;
    end if;
  end if;

  if p_payment_mode = 'PREPAID_UPI' then
    v_prepaid := round((v_subtotal - v_offer) * c_prepaid_discount_rate);
  end if;
  if p_payment_mode = 'COD' then
    v_cod_fee := c_cod_fee;
  end if;
  if coalesce(p_gift_wrap, false) then
    v_wrap_fee := c_gift_wrap_fee;
  end if;
  v_total := v_subtotal - v_offer - v_prepaid + v_cod_fee + v_wrap_fee;
  if v_total <= 0 then
    raise exception 'This order total is not valid. Please contact us on WhatsApp.' using errcode = 'P0001';
  end if;

  if v_card_code is not null then
    if public.too_many_code_attempts(v_user_id) then
      raise exception 'Too many attempts. Please try again in an hour.' using errcode = 'P0001';
    end if;
    select * into v_card from public.gift_cards where code = v_card_code for update;
    if not found or not v_card.active or v_card.balance <= 0
       or (v_card.expires_at is not null and now() > v_card.expires_at) then
      raise exception 'This gift card is not valid or has no balance left' using errcode = 'P0002';
    end if;
    v_card_amount := least(v_card.balance, v_total);
    update public.gift_cards set balance = balance - v_card_amount where id = v_card.id;
  end if;

  v_final := v_total - v_card_amount;

  if p_payment_mode = 'PARTIAL_COD' and v_final <= c_partial_cod_advance then
    raise exception 'Partial COD is available on orders above ₹%', c_partial_cod_advance using errcode = '22023';
  end if;
  if p_payment_mode = 'COD' and v_final <= 0 then
    raise exception 'Your gift card covers this order. Please choose UPI to confirm it.' using errcode = '22023';
  end if;
  if p_payment_mode = 'COD' and v_final > c_cod_max_amount then
    raise exception 'Cash on delivery is available up to ₹%. Please pay online or choose Partial COD.', to_char(c_cod_max_amount, 'FM9,99,999') using errcode = '22023';
  end if;

  update public.orders
     set total_mrp               = v_total_mrp,
         subtotal                = v_subtotal,
         offer_kind              = v_offer_kind,
         offer_label             = v_offer_label,
         offer_discount          = v_offer,
         prepaid_discount        = v_prepaid,
         coupon_id               = case when v_offer_kind = 'coupon' then v_coupon.id end,
         coupon_code             = case when v_offer_kind = 'coupon' then v_coupon.code end,
         cod_fee                 = v_cod_fee,
         gift_wrap               = coalesce(p_gift_wrap, false),
         gift_wrap_fee           = v_wrap_fee,
         gift_message            = v_message,
         gift_card_id            = case when v_card_amount > 0 then v_card.id end,
         gift_card_amount        = v_card_amount,
         free_gift               = case when v_subtotal >= c_free_gift_min then c_free_gift end,
         discount_amount         = v_total_mrp - v_subtotal + v_offer + v_prepaid,
         final_amount            = v_final,
         balance_due_on_delivery = case p_payment_mode
                                     when 'PARTIAL_COD' then v_final - c_partial_cod_advance
                                     when 'COD' then v_final
                                     else 0
                                   end,
         -- A gift card that covers everything settles the order immediately.
         payment_status          = case when v_final = 0 and v_card_amount > 0 then 'PAID'::public.payment_status else payment_status end,
         order_status            = case when v_final = 0 and v_card_amount > 0 then 'CONFIRMED'::public.order_status else order_status end
   where id = v_order.id
  returning * into v_order;

  update public.profiles
     set full_name = trim(p_customer_name)
   where id = v_user_id and coalesce(full_name, '') = '';

  return v_order;
end;
$$;

revoke all on function public.place_order(jsonb, text, jsonb, public.payment_mode, text, text, boolean, text, uuid) from public, anon;
grant execute on function public.place_order(jsonb, text, jsonb, public.payment_mode, text, text, boolean, text, uuid) to authenticated;

-- Cash-on-delivery orders are unpaid until the courier collects, so the 48-hour auto-cancel skips them.
create or replace function public.cancel_stale_pending_orders(p_older_than interval default interval '45 minutes')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  update public.orders
     set order_status = 'CANCELLED', payment_status = 'FAILED'
   where payment_status = 'PENDING'
     and order_status = 'PLACED'
     and payment_mode <> 'COD'
     and created_at < now() - p_older_than;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.cancel_stale_pending_orders(interval) from public, anon, authenticated;

-- Cancelling an order returns the gift card value it used.
create or replace function public.release_cancelled_order_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_status = 'CANCELLED' and old.order_status <> 'CANCELLED'
     and new.gift_card_id is not null and new.gift_card_amount > 0 then
    update public.gift_cards
       set balance = least(initial_amount, balance + new.gift_card_amount)
     where id = new.gift_card_id;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_release_credit_on_cancel on public.orders;
create trigger orders_release_credit_on_cancel
  after update of order_status on public.orders
  for each row execute function public.release_cancelled_order_credit();

-- Delivery date starts the re-polish guarantee and unlocks reviews.
create or replace function public.stamp_delivered_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_status = 'DELIVERED' and old.order_status is distinct from 'DELIVERED' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_stamp_delivered_at on public.orders;
create trigger orders_stamp_delivered_at
  before update of order_status on public.orders
  for each row execute function public.stamp_delivered_at();

-- Customers who refuse COD parcels can be limited to prepaid orders.
create or replace function public.admin_set_cod_blocked(p_user_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  update public.profiles set cod_blocked = p_blocked where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_cod_blocked(uuid, boolean) from public, anon;
grant execute on function public.admin_set_cod_blocked(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Admin product save: now with occasions, stones and thumbnails
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
      plating_type, warranty_details, available_sizes, occasions, stones, stock_count, in_stock, featured
    ) values (
      r.title, r.telugu_title, r.slug, r.description, r.category_id, r.mrp, r.sale_price, r.jewellery_type,
      r.plating_type, r.warranty_details, coalesce(r.available_sizes, '{}'), coalesce(r.occasions, '{}'),
      coalesce(r.stones, '{}'), r.stock_count, r.in_stock, r.featured
    )
    returning id into v_id;
  else
    update public.products
       set title = r.title, telugu_title = r.telugu_title, slug = r.slug, description = r.description,
           category_id = r.category_id, mrp = r.mrp, sale_price = r.sale_price, jewellery_type = r.jewellery_type,
           plating_type = r.plating_type, warranty_details = r.warranty_details,
           available_sizes = coalesce(r.available_sizes, '{}'), occasions = coalesce(r.occasions, '{}'),
           stones = coalesce(r.stones, '{}'), stock_count = r.stock_count, in_stock = r.in_stock, featured = r.featured
     where id = v_id;
    if not found then
      raise exception 'This product no longer exists' using errcode = 'P0002';
    end if;
    delete from public.product_media where product_id = v_id;
  end if;

  insert into public.product_media (product_id, media_type, url, thumb_url, is_thumbnail, display_order)
  select v_id, m.media_type, m.url, m.thumb_url, coalesce(m.is_thumbnail, false), coalesce(m.display_order, 0)
    from jsonb_to_recordset(coalesce(p_media, '[]'))
      as m(media_type public.media_type, url text, thumb_url text, is_thumbnail boolean, display_order int);

  return v_id;
end;
$$;

revoke all on function public.admin_save_product(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_product(uuid, jsonb, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Reviews: only customers with a delivered order for the piece can review it;
-- nothing is public until an admin approves it.
-- -----------------------------------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  title         text check (char_length(title) <= 80),
  body          text not null check (char_length(body) between 10 and 1000),
  photos        text[] not null default '{}' check (cardinality(photos) <= 4),
  display_name  text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists reviews_product_idx on public.reviews (product_id, status, created_at desc);
create index if not exists reviews_status_idx on public.reviews (status, created_at desc);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;

drop policy if exists "reviews: public read approved" on public.reviews;
create policy "reviews: public read approved" on public.reviews for select to anon, authenticated
  using (status = 'approved' or user_id = auth.uid() or public.is_admin());

-- Public readers get the review, not the reviewer's account id.
revoke select on public.reviews from anon, authenticated;
grant select (id, product_id, rating, title, body, photos, display_name, status, created_at, updated_at)
  on public.reviews to anon, authenticated;

drop policy if exists "reviews: admin update" on public.reviews;
create policy "reviews: admin update" on public.reviews for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "reviews: admin delete" on public.reviews;
create policy "reviews: admin delete" on public.reviews for delete to authenticated
  using (public.is_admin());

create or replace function public.submit_review(
  p_product_id uuid,
  p_rating     int,
  p_title      text,
  p_body       text,
  p_photos     text[] default '{}'
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_name   text;
  v_city   text;
  v_photo  text;
  v_review public.reviews;
begin
  if v_user is null then
    raise exception 'Please verify your mobile number first' using errcode = '28000';
  end if;

  select o.customer_name, o.shipping_address ->> 'city' into v_name, v_city
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
   where o.user_id = v_user and o.order_status = 'DELIVERED' and oi.product_id = p_product_id
   order by o.created_at desc
   limit 1;
  if not found then
    raise exception 'You can review pieces from your delivered orders' using errcode = '42501';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Please choose a rating from 1 to 5 stars' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 10 then
    raise exception 'Please write at least a sentence about the piece' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_photos, '{}')) > 4 then
    raise exception 'Please add up to 4 photos' using errcode = '22023';
  end if;
  -- Photos are object paths in the review-photos bucket ("<user id>/<file>"), never free-form URLs,
  -- and must be files this customer actually uploaded.
  foreach v_photo in array coalesce(p_photos, '{}') loop
    if v_photo !~ ('^' || v_user::text || '/[A-Za-z0-9._-]{1,100}$')
       or not exists (select 1 from storage.objects so where so.bucket_id = 'review-photos' and so.name = v_photo) then
      raise exception 'Invalid photo' using errcode = '22023';
    end if;
  end loop;

  insert into public.reviews (product_id, user_id, rating, title, body, photos, display_name)
  values (
    p_product_id, v_user, p_rating, nullif(left(trim(coalesce(p_title, '')), 80), ''), left(trim(p_body), 1000),
    coalesce(p_photos, '{}'),
    initcap(split_part(trim(v_name), ' ', 1)) || coalesce(', ' || initcap(nullif(trim(v_city), '')), '')
  )
  on conflict (product_id, user_id) do update
    set rating = excluded.rating, title = excluded.title, body = excluded.body, photos = excluded.photos,
        display_name = excluded.display_name, status = 'pending'
  returning * into v_review;

  return v_review;
end;
$$;

revoke all on function public.submit_review(uuid, int, text, text, text[]) from public, anon;
grant execute on function public.submit_review(uuid, int, text, text, text[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- The bucket is public, so photos load by URL without a read policy; leaving one out stops anyone listing every file.
drop policy if exists "review-photos: public read" on storage.objects;

-- Uploads only into the customer's own folder, only after a delivered order, and at most 20 files each.
create or replace function public.can_upload_review_photo(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.orders o where o.user_id = p_user and o.order_status = 'DELIVERED')
     and (select count(*) from storage.objects so
           where so.bucket_id = 'review-photos' and so.name like p_user::text || '/%') < 20;
$$;

revoke all on function public.can_upload_review_photo(uuid) from public, anon;
grant execute on function public.can_upload_review_photo(uuid) to authenticated;

drop policy if exists "review-photos: customer upload own folder" on storage.objects;
create policy "review-photos: customer upload own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_upload_review_photo(auth.uid())
  );

drop policy if exists "review-photos: admin delete" on storage.objects;
create policy "review-photos: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'review-photos' and public.is_admin());

-- -----------------------------------------------------------------------------
-- Back-in-stock requests ("notify me on WhatsApp")
-- -----------------------------------------------------------------------------
create table if not exists public.stock_alerts (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  phone        text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  created_at   timestamptz not null default now(),
  notified_at  timestamptz,
  unique (product_id, phone)
);

create index if not exists stock_alerts_pending_idx on public.stock_alerts (product_id) where notified_at is null;

alter table public.stock_alerts enable row level security;

drop policy if exists "stock_alerts: admin all" on public.stock_alerts;
create policy "stock_alerts: admin all" on public.stock_alerts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Uses the customer's OTP-verified number, so nobody can sign up someone else's phone for messages.
drop function if exists public.request_stock_alert(uuid, text);

create or replace function public.request_stock_alert(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := auth.uid();
  v_phone   text;
  v_product public.products;
begin
  if v_user is null then
    raise exception 'Please verify your mobile number first' using errcode = '28000';
  end if;
  select '+' || ltrim(u.phone, '+') into v_phone from auth.users u where u.id = v_user;
  if coalesce(v_phone, '') !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'Back-in-stock alerts are available for Indian mobile numbers' using errcode = '22023';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found then
    raise exception 'This piece is no longer available' using errcode = 'P0002';
  end if;
  if v_product.in_stock and v_product.stock_count > 0 then
    raise exception 'Good news — this piece is in stock now' using errcode = '22023';
  end if;

  if (select count(*) from public.stock_alerts a where a.phone = v_phone and a.notified_at is null) >= 10 then
    raise exception 'You are already waiting for 10 pieces. We will message you as they arrive.' using errcode = 'P0001';
  end if;

  insert into public.stock_alerts (product_id, phone)
  values (p_product_id, v_phone)
  on conflict (product_id, phone) do update set notified_at = null
   where public.stock_alerts.notified_at is not null;
end;
$$;

revoke all on function public.request_stock_alert(uuid) from public, anon;
grant execute on function public.request_stock_alert(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Frequently bought together: product pairs from real orders, counts only (no customer data).
-- Only paid or confirmed orders count, and a pair needs three different customers, so one shopper
-- cannot plant recommendations with unpaid orders.
-- -----------------------------------------------------------------------------
create or replace function public.frequently_bought_with(p_product_id uuid, p_limit int default 8)
returns table (product_id uuid, orders_together int)
language sql
stable
security definer
set search_path = ''
as $$
  select other.product_id, count(distinct other.order_id)::int as orders_together
    from public.order_items mine
    join public.order_items other on other.order_id = mine.order_id and other.product_id <> mine.product_id
    join public.orders o on o.id = mine.order_id
   where mine.product_id = p_product_id and other.product_id is not null
     and o.order_status in ('CONFIRMED', 'DISPATCHED', 'DELIVERED')
   group by other.product_id
  having count(distinct o.user_id) >= 3
   order by orders_together desc
   limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.frequently_bought_with(uuid, int) from public;
grant execute on function public.frequently_bought_with(uuid, int) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Funnel events. Written only by the /api/track Pages Function (service role);
-- an anonymous per-tab session id, never a phone number or name.
-- -----------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  event       text not null check (event in ('page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'phone_verified', 'order_placed', 'payment_done')),
  session_id  text not null check (session_id ~ '^[A-Za-z0-9-]{8,64}$'),
  product_id  uuid,
  path        text check (char_length(path) <= 200),
  created_at  timestamptz not null default now()
);

create index if not exists analytics_events_created_idx on public.analytics_events (created_at);

alter table public.analytics_events enable row level security;

create or replace function public.admin_funnel(p_days int default 30)
returns table (event text, sessions bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  return query
    select e.event, count(distinct e.session_id)
      from public.analytics_events e
     where e.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
     group by e.event;
end;
$$;

revoke all on function public.admin_funnel(int) from public, anon;
grant execute on function public.admin_funnel(int) to authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-analytics';
select cron.schedule('purge-old-analytics', '30 3 * * *', $$delete from public.analytics_events where created_at < now() - interval '180 days'$$);

-- -----------------------------------------------------------------------------
-- Starter data: tags and thumbnails for the sample catalogue, and a welcome coupon
-- -----------------------------------------------------------------------------
update public.products p
   set occasions = t.occasions, stones = t.stones
  from (values
    ('lakshmi-nakshi-temple-vaddanam',          array['wedding', 'festival'], array['kempu']),
    ('peacock-kempu-stone-hip-belt',            array['wedding', 'festival'], array['kempu']),
    ('lakshmi-coin-nallapusalu-long-chain',     array['daily', 'festival'],   array['plain']),
    ('traditional-gold-bead-nallapusalu',       array['daily', 'office'],     array['plain']),
    ('nakshi-lakshmi-choker-set-jhumkas',       array['wedding', 'festival'], array['kempu']),
    ('kempu-emerald-bridal-choker-set',         array['wedding'],             array['kempu', 'emerald']),
    ('micro-gold-plated-bangles-set-of-4',      array['daily', 'festival'],   array['plain']),
    ('guttapusalu-long-haram',                  array['wedding', 'festival'], array['pearl', 'kempu']),
    ('aaa-swiss-cz-bridal-necklace-set',        array['wedding', 'party'],    array['cz']),
    ('rose-gold-cz-cocktail-ring',              array['party'],               array['cz']),
    ('waterproof-pvd-gold-paperclip-chain',     array['daily', 'office'],     array['plain']),
    ('anti-tarnish-butterfly-huggie-earrings',  array['daily', 'office'],     array['plain']),
    ('minimal-pvd-office-wear-bracelet',        array['office', 'daily'],     array['plain']),
    ('korean-pearl-drop-earrings',              array['party', 'office'],     array['pearl']),
    ('k-trend-heart-pendant-necklace',          array['daily', 'party'],      array['plain'])
  ) as t(slug, occasions, stones)
 where p.slug = t.slug and cardinality(p.occasions) = 0 and cardinality(p.stones) = 0;

update public.product_media
   set thumb_url = regexp_replace(url, '\.webp$', '-w480.webp')
 where thumb_url is null and media_type = 'image' and url ~ '^/products/[a-z0-9-]+-[0-9]+\.webp$';

-- Only on the first run: re-running the file must not bring back a coupon the owner has deleted.
insert into public.coupons (code, description, kind, value, min_subtotal, max_discount, first_order_only, per_customer_limit)
select 'WELCOME10', '10% off your first order (up to ₹300) on ₹999+', 'percent', 10, 999, 300, true, 1
 where not exists (select 1 from public.coupons);
