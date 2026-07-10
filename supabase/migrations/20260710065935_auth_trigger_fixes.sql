-- Fixes applied after the initial 20260708_0001 push (which had already run
-- on the remote by the time these corrections were written, so `db push`
-- would not re-apply them from the edited original file):
--   1. handle_new_user(): only trust role/status from signup metadata when
--      the auth.users row was created via the service-role Admin API —
--      otherwise a self-registering visitor could hand themselves
--      'super_admin' + 'active' in their own signUp() request body.
--   2. protect_profile_privileges(): recognize service-role connections
--      (auth.uid() is null for those) so the demo-seed script and any future
--      admin tooling using the service role can actually set role/department,
--      instead of having every field silently reverted to its old value.
--   3. email_for_username(): new RPC so the login screen can resolve
--      "username or email" to an email address before a session exists.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_trusted boolean := auth.role() = 'service_role';
begin
  insert into public.profiles (id, full_name, username, email, role, status, department_id, position, employee_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    case when is_trusted then coalesce(new.raw_user_meta_data->>'role', 'staff') else 'staff' end,
    case when is_trusted then coalesce(new.raw_user_meta_data->>'status', 'inactive') else 'inactive' end,
    nullif(new.raw_user_meta_data->>'department_id', '')::uuid,
    new.raw_user_meta_data->>'position',
    nullif(new.raw_user_meta_data->>'employee_id', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_super_admin() then
    return new;
  end if;

  if public.is_department_admin() and old.department_id = public.current_user_department_id() then
    new.role := old.role;
    new.department_id := old.department_id;
    return new;
  end if;

  new.role := old.role;
  new.status := old.status;
  new.department_id := old.department_id;
  return new;
end;
$$;

create or replace function public.email_for_username(lookup_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select email from public.profiles where username = lookup_username limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;
