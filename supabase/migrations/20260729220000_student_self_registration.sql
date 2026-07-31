-- Let a self-registering visitor actually create a STUDENT account.
--
-- The Register form has an Employee/Student toggle, but handle_new_user pinned
-- every self-service signup to role 'staff' — so choosing "Student" silently
-- produced a Faculty account, and the Student ID went into employee_id. The
-- only real student path was the create-student edge function, which requires
-- an admin caller and has no UI, so students could not be created at all.
--
-- The hard-coded 'staff' was deliberate (20260710065935): raw_user_meta_data is
-- attacker-controlled on a self-service signUp(), so trusting a role from it
-- would let a visitor hand themselves 'super_admin'. That protection stays —
-- this only carves out 'student', which is the LEAST privileged role in the
-- system. Anything else still falls back to 'staff'.
--
-- Note what has NOT changed: status is still forced to 'inactive' for every
-- untrusted signup, so a self-registered student still cannot sign in until an
-- admin activates them. The role choice affects only what they become once
-- approved, never whether they get in.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	is_trusted boolean := auth.role() = 'service_role';
	requested_role text := new.raw_user_meta_data->>'role';
	resolved_role text;
begin
	if is_trusted then
		-- Service-role callers (create-student, the seed scripts) are trusted to
		-- name any role.
		resolved_role := coalesce(requested_role, 'staff');
	else
		-- Self-service: 'student' is honoured, everything else becomes 'staff'.
		-- An attacker asking for 'super_admin' lands as ordinary faculty, exactly
		-- as before.
		resolved_role := case when requested_role = 'student' then 'student' else 'staff' end;
	end if;

	insert into public.profiles (id, full_name, username, email, role, status, department_id, position, employee_id, student_id)
	values (
		new.id,
		coalesce(new.raw_user_meta_data->>'full_name', new.email),
		coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
		new.email,
		resolved_role,
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
