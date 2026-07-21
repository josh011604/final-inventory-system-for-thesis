-- Defense in depth: the borrow-status edge function already checks that a
-- borrower's department matches the item's department before inserting, but
-- the "borrow insert scoped" RLS policy only checks `borrower_id = auth.uid()`
-- — it never validated department. A client calling
-- supabase.from('borrow_records').insert(...) directly (bypassing the edge
-- function) could request any item regardless of department. This trigger
-- makes the rule unconditional at the database layer, closing that bypass for
-- every future caller, not just the current edge function.

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
begin
	select department_id into v_equipment_department from public.equipment where id = new.equipment_id;
	select role, department_id into v_borrower_role, v_borrower_department from public.profiles where id = new.borrower_id;

	if v_equipment_department is null then
		-- Supply Office / Super Admin inventory — off-limits to students only.
		if v_borrower_role = 'student' then
			raise exception 'Students can only request items from their own department' using errcode = '42501';
		end if;
	elsif v_equipment_department is distinct from v_borrower_department then
		raise exception 'Borrower can only request items from their own department' using errcode = '42501';
	end if;

	return new;
end;
$$;

drop trigger if exists trg_borrow_department_scope on public.borrow_records;
create trigger trg_borrow_department_scope
before insert on public.borrow_records
for each row execute function public.enforce_borrow_department_scope();
