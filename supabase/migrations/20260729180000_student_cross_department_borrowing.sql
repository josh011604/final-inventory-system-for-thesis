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

-- 2. The borrower's role, denormalized onto the row.
--
--    Faculty may approve a STUDENT's request in their own department, so the
--    Borrowing screen has to know whether the borrower is a student. It used to
--    read that from a profiles join, but "profiles select own or admin" RLS lets
--    a faculty member read only their own profile — the join came back null and
--    their Approve button silently disappeared. Same problem, and same fix, as
--    borrower_name in 20260729130000: store it on the row at write time.
--    approved_by_role is the same idea on the approver's side: an audit record
--    has to say what authority cleared the request (super admin / department
--    admin / faculty), not just a name, and it must stay readable after the
--    approver changes role or leaves.
alter table public.borrow_records
  add column if not exists borrower_role text,
  add column if not exists approved_by_role text;

update public.borrow_records br
set borrower_role = p.role
from public.profiles p
where br.borrower_id = p.id and br.borrower_role is null;

update public.borrow_records br
set approved_by_role = p.role
from public.profiles p
where br.approved_by = p.id and br.approved_by_role is null;

-- 3. Request scope, plus the denormalized borrower fields. This trigger is the
--    unconditional backstop for a client that writes to the table directly
--    instead of going through the borrow-status edge function.
--
--    It combines two lines of change that both replaced this function:
--      * 20260729130000 — stamps borrower_name so item history can show who
--        borrowed without a profiles join. Kept.
--      * this migration — students lose the own-department restriction and keep
--        only the Supply Office one. Note that the version in 20260729130000
--        still carried the original "own department only" rule for EVERY role;
--        that was already relaxed for faculty in 20260728130000 and is relaxed
--        for students here, so re-applying it would undo both.
--
--    borrower_name / borrower_role are always taken from the resolved profile,
--    never from a client-supplied value.
create or replace function public.enforce_borrow_department_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_equipment_department uuid;
	v_borrower_role text;
	v_borrower_name text;
begin
	select department_id into v_equipment_department from public.equipment where id = new.equipment_id;
	select role, full_name into v_borrower_role, v_borrower_name from public.profiles where id = new.borrower_id;

	if v_borrower_role = 'student' and v_equipment_department is null then
		raise exception 'Students cannot request Supply Office items' using errcode = '42501';
	end if;

	new.borrower_name := v_borrower_name;
	new.borrower_role := v_borrower_role;

	return new;
end;
$$;

drop trigger if exists trg_borrow_department_scope on public.borrow_records;
create trigger trg_borrow_department_scope
before insert on public.borrow_records
for each row execute function public.enforce_borrow_department_scope();
