-- Same RLS gap as approver tracking (20260729120000), on the other side of
-- the record: the frontend resolved the borrower's display name via
-- `borrower:profiles!borrow_records_borrower_id_fkey(full_name)`, but
-- "profiles select own or admin" RLS only lets a viewer read their own
-- profile or (if they're an admin) their department's — so a student or
-- staff member browsing a peer's borrow entry in item history got `null`
-- back and fell through to the generic "a borrower" label.
--
-- Fixed the same way: denormalize the name onto the row instead of relying
-- on a cross-user profiles join. Done in enforce_borrow_department_scope()
-- (the existing before-insert trigger that already looks up the borrower's
-- profile to validate department scope) rather than the borrow-status edge
-- function, so it's authoritative regardless of insert path — the "borrow
-- insert scoped" RLS policy also lets a department/super admin insert a
-- request on someone else's behalf, not just through the edge function.

alter table public.borrow_records
  add column if not exists borrower_name text;

update public.borrow_records br
set borrower_name = p.full_name
from public.profiles p
where br.borrower_id = p.id and br.borrower_name is null;

create or replace function public.enforce_borrow_department_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_equipment_department uuid;
	v_borrower_role text;
	v_borrower_department uuid;
	v_borrower_name text;
begin
	select department_id into v_equipment_department from public.equipment where id = new.equipment_id;
	select role, department_id, full_name into v_borrower_role, v_borrower_department, v_borrower_name from public.profiles where id = new.borrower_id;

	if v_equipment_department is null then
		-- Supply Office / Super Admin inventory — off-limits to students only.
		if v_borrower_role = 'student' then
			raise exception 'Students can only request items from their own department' using errcode = '42501';
		end if;
	elsif v_equipment_department is distinct from v_borrower_department then
		raise exception 'Borrower can only request items from their own department' using errcode = '42501';
	end if;

	-- Always set from the resolved profile, never trust a client-supplied value.
	new.borrower_name := v_borrower_name;

	return new;
end;
$$;
