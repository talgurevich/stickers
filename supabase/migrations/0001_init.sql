-- Initial schema for the WhatsApp sticker print service.
-- Apply via Supabase CLI (`supabase db push`) or directly in the SQL editor
-- once the Supabase project exists.

-- ----------------------------------------------------------------------------
-- sessions: open carts waiting for an image / being configured / paid
-- ----------------------------------------------------------------------------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  status text not null default 'awaiting_image'
    check (status in (
      'awaiting_image',
      'image_received',
      'configuring',
      'paid',
      'abandoned',
      'expired'
    )),
  image_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '60 minutes'
);

create index if not exists sessions_phone_status
  on sessions (phone_e164, status);

-- ----------------------------------------------------------------------------
-- orders: sessions that converted, plus fulfillment state
-- ----------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions (id),
  phone_e164 text not null,
  email text,

  image_url text not null,                  -- raw upload / WhatsApp original
  print_image_url text not null,            -- post-processed, print-ready PNG

  size_mm int not null check (size_mm in (50, 70, 100)),
  cut_type text not null check (cut_type in ('kiss_cut', 'rectangle')),
  quantity int not null check (quantity between 1 and 50),
  shipping_address jsonb not null,

  product_cost_agorot int not null,
  shipping_cost_agorot int not null,
  total_agorot int not null,

  payplus_transaction_id text,
  paid_at timestamptz,

  printful_order_id text,
  printful_status text,
  shipped_at timestamptz,
  tracking_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_phone on orders (phone_e164);
create index if not exists orders_printful on orders (printful_order_id);

-- Auto-bump updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- whatsapp_orphans: inbound messages we couldn't immediately match (~15 min TTL)
-- ----------------------------------------------------------------------------
create table if not exists whatsapp_orphans (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  image_url text not null,
  whatsapp_message_id text not null,
  received_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  matched_to_session_id uuid references sessions (id)
);

create index if not exists whatsapp_orphans_phone_unmatched
  on whatsapp_orphans (phone_e164)
  where matched_to_session_id is null;

-- ----------------------------------------------------------------------------
-- Realtime: publish session row updates so the "waiting for sticker" page
-- can react when WhatsApp ingestion sets image_url.
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table sessions;
