-- After switching from Printful to Prodigi, the orders table needs to store
-- a StickerSize key ("small" | "medium" | "large" | "xlarge") rather than
-- an int millimeter value. Drop the Printful-shaped check constraints and
-- change size_mm to text. Column name kept ("size_mm") to avoid touching
-- every TS type — content semantics now hold the StickerSize key.
--
-- Existing rows from before the switch had int values (50/70/100); the cast
-- preserves them as text strings, but those orders won't match any current
-- StickerSize and shouldn't be re-submitted.

alter table orders drop constraint if exists orders_size_mm_check;
alter table orders drop constraint if exists orders_cut_type_check;
alter table orders alter column size_mm type text using size_mm::text;
