-- Multi-product support. Adds product_type to orders so the row's size_mm
-- string is interpreted in context: "small" means a different SKU for a
-- sticker vs. a magnet. Existing rows backfill as 'sticker' (the only
-- product type that existed before this migration).

alter table orders
  add column if not exists product_type text not null default 'sticker'
  check (product_type in ('sticker', 'magnet', 'tattoo'));

create index if not exists orders_product_type on orders (product_type);
