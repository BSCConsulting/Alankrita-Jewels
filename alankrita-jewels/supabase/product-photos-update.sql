-- Swap the seeded SVG placeholders for the temporary stock photos in public/products.
-- Only touches rows still pointing at /placeholders/, so products with uploaded photos are left alone.
-- Run once in the Supabase SQL Editor after the site with public/products has deployed.

update public.product_media
set url = regexp_replace(url, '^/placeholders/(.+)\.svg$', '/products/\1.webp')
where media_type = 'image'
  and url ~ '^/placeholders/.+-[12]\.svg$';

select p.slug, m.url, m.is_thumbnail
from public.product_media m
join public.products p on p.id = m.product_id
where m.media_type = 'image'
order by p.slug, m.display_order;
