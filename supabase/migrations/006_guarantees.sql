-- =============================================================================
-- 006: Re-polish guarantee card
-- Each order line keeps the guarantee text the piece was sold with, so editing
-- a product later never changes the cover a customer already bought.
-- Safe to run more than once.
-- =============================================================================

alter table public.order_items
  add column if not exists warranty_details text;

create or replace function public.order_items_copy_warranty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.warranty_details is null and new.product_id is not null then
    select p.warranty_details into new.warranty_details from public.products p where p.id = new.product_id;
  end if;
  return new;
end;
$$;

revoke all on function public.order_items_copy_warranty() from public, anon, authenticated;

drop trigger if exists order_items_copy_warranty on public.order_items;
create trigger order_items_copy_warranty
  before insert on public.order_items
  for each row execute function public.order_items_copy_warranty();

-- Earlier orders: best available record is the product's current text.
update public.order_items oi
   set warranty_details = p.warranty_details
  from public.products p
 where p.id = oi.product_id
   and oi.warranty_details is null;
