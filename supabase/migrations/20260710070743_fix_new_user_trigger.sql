-- Both the Admin API (admin.createUser) and public signUp() insert into
-- auth.users via GoTrue's own internal Postgres connection, not through
-- PostgREST — so auth.role() is NOT 'service_role' inside this trigger for
-- either path, and the "is_trusted" branch added in 20260710065935 never
-- actually took the trusted branch. Simplify: the trigger always creates
-- profiles as role='staff', status='inactive' regardless of caller (safe
-- default matching the pre-Supabase register flow). department_id/position/
-- employee_id from metadata are fine to trust either way — they aren't
-- privilege fields. Elevated demo accounts get their role/status set by a
-- separate, explicit service-role UPDATE after creation (which does go
-- through PostgREST, so protect_profile_privileges' service_role check
-- applies correctly there).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, email, role, status, department_id, position, employee_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    'staff',
    'inactive',
    nullif(new.raw_user_meta_data->>'department_id', '')::uuid,
    new.raw_user_meta_data->>'position',
    nullif(new.raw_user_meta_data->>'employee_id', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
