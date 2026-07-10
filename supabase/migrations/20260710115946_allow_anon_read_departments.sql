-- The public Register form needs to populate its department dropdown for
-- genuinely anonymous (not-yet-signed-in) visitors, but "public read
-- departments" was scoped to `authenticated` only — confirmed via a fresh,
-- session-less browser context that the dropdown renders zero options for
-- a real first-time visitor. Department names/programs aren't sensitive,
-- so extend read access to `anon` as well.
drop policy if exists "public read departments" on public.departments;
create policy "public read departments"
on public.departments
for select
to authenticated, anon
using (true);
