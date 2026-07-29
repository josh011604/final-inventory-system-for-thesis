-- Students may request any DEPARTMENT's items — never the Supply Office.
--
-- Previously students were locked to their own department: they could neither
-- read nor request another department's equipment. The product rule is now the
-- same shape as the one faculty already have, minus the Supply Office:
--
--   * Inventory Items screen — every role sees only their OWN department's
--     stock, so the list stays about the things they work with day to day.
--     (Client-side scoping; this migration only governs what is readable.)
--   * Borrowing → New Request — the picker is where other departments' stock
--     appears. Faculty additionally get Supply Office items there; students
--     never do.
--   * A request for another department's item is stamped with THAT department
--     and routed to its admin (or, for a student's request, its faculty) —
--     which already falls out of borrow_records.department_id and the existing
--     approval rules. Nothing about routing changes here.
--
-- The single thing students remain locked out of is Supply Office (central,
-- department-less) inventory, which stays super-admin business.

-- 1. Equipment visibility. Students can now read every departmental item so the
--    New Request picker can list them; department_id is null only for Supply
--    Office stock, which stays hidden from them. Replaces the own-department
--    rule for students from 20260728130000; the other roles are unchanged.
drop policy if exists "equipment scoped select" on public.equipment;
create policy "equipment scoped select"
on public.equipment
for select
to authenticated
using (
  public.current_user_role() in ('super_admin', 'department_admin', 'staff')
  -- Students: any department's item, never the Supply Office pool.
  or (public.current_user_role() = 'student' and department_id is not null)
  or department_id = public.current_user_department_id()
);

-- 2. Request scope. The trigger is the unconditional backstop for a client that
--    calls the table directly instead of going through the borrow-status edge
--    function. Students lose the own-department restriction but keep the
--    Supply Office one. Replaces the rule from 20260728130000.
create or replace function public.enforce_borrow_department_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_equipment_department uuid;
	v_borrower_role text;
begin
	select department_id into v_equipment_department from public.equipment where id = new.equipment_id;
	select role into v_borrower_role from public.profiles where id = new.borrower_id;

	if v_borrower_role = 'student' and v_equipment_department is null then
		raise exception 'Students cannot request Supply Office items' using errcode = '42501';
	end if;

	return new;
end;
$$;

drop trigger if exists trg_borrow_department_scope on public.borrow_records;
create trigger trg_borrow_department_scope
before insert on public.borrow_records
for each row execute function public.enforce_borrow_department_scope();
