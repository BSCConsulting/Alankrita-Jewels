-- =============================================================================
-- Alankrita Jewels — initial schema
-- Tables, enums, RLS policies, order placement RPC and storage bucket.
-- Run with: supabase db push   (or paste into the Supabase SQL editor)
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.theme_variant     as enum ('heritage', 'modern');
create type public.jewellery_type    as enum ('1-gram-gold', 'anti-tarnish', 'american-diamond', 'korean', 'nakshi-temple');
create type public.media_type        as enum ('image', 'video_reel');
create type public.payment_mode      as enum ('PREPAID_UPI', 'PARTIAL_COD');
create type public.payment_status    as enum ('PENDING', 'PAID', 'PARTIAL_PAID', 'FAILED');
create type public.order_status      as enum ('PLACED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CANCELLED');
create type public.shipping_provider as enum ('SHIPROCKET', 'DELHIVERY', 'MANUAL');
create type public.user_role         as enum ('customer', 'admin');

-- -----------------------------------------------------------------------------
-- Shared trigger: updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  phone       text unique,
  full_name   text,
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now()
);

comment on column public.profiles.role is 'Promote an admin from the SQL editor: update profiles set role = ''admin'' where id = ''<uuid>'';';

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  telugu_name    text,
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  parent_id      uuid references public.categories (id) on delete set null,
  description    text,
  theme_default  public.theme_variant not null default 'heritage',
  display_order  int not null default 0,
  created_at     timestamptz not null default now()
);

create index categories_parent_idx on public.categories (parent_id);

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  telugu_title      text,
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description       text,
  category_id       uuid references public.categories (id) on delete set null,
  mrp               numeric(10, 2) not null check (mrp > 0),
  sale_price        numeric(10, 2) not null check (sale_price > 0),
  jewellery_type    public.jewellery_type not null,
  plating_type      text,
  warranty_details  text,
  available_sizes   text[] not null default '{}',
  in_stock          boolean not null default true,
  stock_count       int not null default 10 check (stock_count >= 0),
  featured          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint products_sale_le_mrp check (sale_price <= mrp)
);

create index products_category_idx on public.products (category_id);
create index products_type_idx     on public.products (jewellery_type);
create index products_featured_idx on public.products (featured) where featured;

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- product_media
-- -----------------------------------------------------------------------------
create table public.product_media (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  media_type     public.media_type not null default 'image',
  url            text not null,
  is_thumbnail   boolean not null default false,
  display_order  int not null default 0,
  created_at     timestamptz not null default now()
);

create index product_media_product_idx on public.product_media (product_id, display_order);
create unique index product_media_one_thumbnail on public.product_media (product_id) where is_thumbnail;

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id                       uuid primary key default gen_random_uuid(),
  order_number             text not null unique,
  user_id                  uuid references auth.users (id) on delete set null,
  customer_phone           text not null,
  customer_name            text not null,
  shipping_address         jsonb not null
                             check (shipping_address ?& array['address_line', 'city', 'state', 'pincode']),
  total_mrp                numeric(10, 2) not null default 0,
  discount_amount          numeric(10, 2) not null default 0,
  final_amount             numeric(10, 2) not null check (final_amount >= 0),
  payment_mode             public.payment_mode not null,
  advance_paid             numeric(10, 2) not null default 0,
  balance_due_on_delivery  numeric(10, 2) not null default 0,
  payment_gateway_ref      text,
  payment_status           public.payment_status not null default 'PENDING',
  order_status             public.order_status not null default 'PLACED',
  shipping_provider        public.shipping_provider,
  awb_number               text,
  tracking_url             text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index orders_user_idx           on public.orders (user_id, created_at desc);
create index orders_phone_idx          on public.orders (customer_phone);
create index orders_status_idx         on public.orders (order_status, payment_status);
create index orders_created_idx        on public.orders (created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- order_items
-- -----------------------------------------------------------------------------
create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  product_title  text not null,
  quantity       int not null check (quantity > 0),
  unit_price     numeric(10, 2) not null check (unit_price >= 0),
  selected_size  text
);

create index order_items_order_idx on public.order_items (order_id);

-- =============================================================================
-- Helper functions
-- =============================================================================

-- SECURITY DEFINER so it can read profiles without recursing through RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Create a profile row whenever a user signs up (phone OTP or email).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, nullif(new.phone, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block customers from promoting themselves. Service role / SQL editor (no JWT) may change roles.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Human-friendly order numbers like ALK-84920.
create or replace function public.generate_order_number()
returns text
language plpgsql
set search_path = ''
as $$
declare
  candidate text;
begin
  loop
    candidate := 'ALK-' || lpad((floor(random() * 90000) + 10000)::int::text, 5, '0');
    exit when not exists (select 1 from public.orders where order_number = candidate);
  end loop;
  return candidate;
end;
$$;

-- Return stock to inventory when an order is cancelled.
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
           in_stock    = true
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

create trigger orders_restock_on_cancel
  after update of order_status on public.orders
  for each row execute function public.restock_cancelled_order();

-- =============================================================================
-- place_order — the ONLY way customers create orders.
-- Prices, discounts and the Partial-COD split are computed server-side from the
-- products table so the client can never tamper with totals.
--
-- p_items: [{ "product_id": uuid, "quantity": int, "selected_size": text|null }]
-- p_shipping_address: { address_line, landmark?, city, state, pincode }
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

  -- Create the order shell first so items can reference it.
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

-- Releases stock held by abandoned, unpaid orders (restock happens via orders_restock_on_cancel).
-- Schedule with pg_cron (Database → Extensions → pg_cron):
--   select cron.schedule('cancel-stale-orders', '*/15 * * * *',
--     $$select public.cancel_stale_pending_orders(interval '45 minutes')$$);
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
     and created_at < now() - p_older_than;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.cancel_stale_pending_orders(interval) from public, anon, authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles      enable row level security;
alter table public.categories    enable row level security;
alter table public.products      enable row level security;
alter table public.product_media enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;

-- profiles: users see/edit themselves; admins see everyone.
create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: update own or admin"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Catalog: public read, admin write.
create policy "categories: public read" on public.categories for select to anon, authenticated using (true);
create policy "categories: admin write" on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "products: public read" on public.products for select to anon, authenticated using (true);
create policy "products: admin write" on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "product_media: public read" on public.product_media for select to anon, authenticated using (true);
create policy "product_media: admin write" on public.product_media for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Orders: inserted only via place_order(); customers read their own; admins manage all.
create policy "orders: read own or admin"
  on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "orders: admin update"
  on public.orders for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "orders: admin delete"
  on public.orders for delete to authenticated
  using (public.is_admin());

create policy "order_items: read own or admin"
  on public.order_items for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

create policy "order_items: admin write"
  on public.order_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- Storage: public bucket for product images & reels, admin-only writes.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media', 'product-media', true, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;

create policy "product-media: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-media');

create policy "product-media: admin insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-media' and public.is_admin());

create policy "product-media: admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-media' and public.is_admin());

create policy "product-media: admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-media' and public.is_admin());
