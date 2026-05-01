-- Multi-design cart support. Multiple orders rows that belong to a single
-- checkout share the same cart_id and ship together (one Prodigi order, one
-- PayPlus payment, one shipping fee). Nullable: legacy single-item orders
-- predating the cart UI keep cart_id NULL and continue to work as before.

alter table orders
  add column if not exists cart_id uuid;

create index if not exists orders_cart_id on orders (cart_id);
