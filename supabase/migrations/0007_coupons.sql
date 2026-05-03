-- Coupon codes. One row per code; usage is tracked atomically via
-- redeem_coupon(). Discount applies to the cart total (product+ship+handling).

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_percent int not null check (discount_percent > 0 and discount_percent <= 100),
  max_uses int not null check (max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Case-insensitive lookups: store as-is, query via lower(code).
create index if not exists coupons_code_lower on coupons (lower(code));

-- Atomic redeem: increments used_count only when there's still capacity and
-- the coupon is active/unexpired. Returns the row if successful, NULL if not.
create or replace function redeem_coupon(p_code text)
returns table (
  code text,
  discount_percent int
) language sql as $$
  update coupons
     set used_count = used_count + 1
   where lower(coupons.code) = lower(p_code)
     and active
     and used_count < max_uses
     and (expires_at is null or expires_at > now())
  returning coupons.code, coupons.discount_percent;
$$;

-- Per-cart discount tracking on orders. Discount is split across rows the
-- same way shipping/handling are (entire amount on the first row).
alter table orders
  add column if not exists coupon_code text,
  add column if not exists discount_agorot int not null default 0;
