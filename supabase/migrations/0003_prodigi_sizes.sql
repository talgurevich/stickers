-- Drop size_mm and cut_type check constraints. They were sized to Printful's
-- catalog (50/70/100 mm; kiss_cut/rectangle). After switching to Prodigi for
-- IL shipping, the actual product dimensions and cut options differ.
-- Validation moves into application code (lib/prodigi-catalog.ts).

alter table orders drop constraint if exists orders_size_mm_check;
alter table orders drop constraint if exists orders_cut_type_check;
