-- Allow the anon key to subscribe to changes on `sessions` so the /start
-- page's Realtime subscription receives image_url updates after the
-- WhatsApp ingest writes them.
--
-- Auth model: session ids are unguessable UUIDs. Knowing the id grants the
-- bearer access. The browser only ever sees its own session id (carried in
-- the URL after createSession). All writes still go through service-role
-- on the server side; this policy unblocks reads only.

alter table sessions enable row level security;

drop policy if exists "anon can read sessions" on sessions;
create policy "anon can read sessions"
  on sessions
  for select
  to anon, authenticated
  using (true);

-- Realtime needs the anon role to also have SELECT at the schema-grant
-- level (separate from RLS policies). Supabase's default GRANT covers this,
-- but be explicit so a fresh project works without manual setup.
grant select on table sessions to anon, authenticated;
