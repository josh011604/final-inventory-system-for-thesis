-- Add a 'student' role: a department-scoped, read-mostly account that borrows
-- items the same way 'staff' does. Isolation is not new logic — it reuses the
-- existing department_id RLS policies on equipment/facilities and the
-- department check already enforced in borrow-status/index.ts (create action).

alter table public.profiles
	add column if not exists student_id text unique;

alter table public.profiles
	drop constraint if exists profiles_role_check;
alter table public.profiles
	add constraint profiles_role_check check (role in ('super_admin', 'department_admin', 'staff', 'student'));

-- Every student must belong to exactly one department; other roles are
-- unaffected (super_admin legitimately has department_id null).
alter table public.profiles
	drop constraint if exists profiles_student_requires_department;
alter table public.profiles
	add constraint profiles_student_requires_department check (role <> 'student' or department_id is not null);

-- handle_new_user only trusts role/department_id/student_id from
-- raw_user_meta_data when the auth.users row was created by a service-role
-- caller (see create-student edge function) — a self-service signUp() still
-- always lands as role='staff', status='inactive'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	is_trusted boolean := auth.role() = 'service_role';
begin
	insert into public.profiles (id, full_name, username, email, role, status, department_id, position, employee_id, student_id)
	values (
		new.id,
		coalesce(new.raw_user_meta_data->>'full_name', new.email),
		coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
		new.email,
		case when is_trusted then coalesce(new.raw_user_meta_data->>'role', 'staff') else 'staff' end,
		case when is_trusted then coalesce(new.raw_user_meta_data->>'status', 'inactive') else 'inactive' end,
		nullif(new.raw_user_meta_data->>'department_id', '')::uuid,
		new.raw_user_meta_data->>'position',
		nullif(new.raw_user_meta_data->>'employee_id', ''),
		nullif(new.raw_user_meta_data->>'student_id', '')
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

create index if not exists idx_profiles_student_id on public.profiles(student_id);
