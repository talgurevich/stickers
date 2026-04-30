-- Public feed opt-in flag. Default true (opt-out model — customers see the
-- checkbox at checkout and can uncheck it). The /api/recent feed filters on
-- this column so unchecked orders never appear publicly.
--
-- Existing rows get true to match the prior implicit behavior (all orders
-- were displayed). If you want to retro-actively hide existing rows, run:
--   update orders set display_publicly = false where created_at < '<cutoff>';

alter table orders
  add column if not exists display_publicly boolean not null default true;
