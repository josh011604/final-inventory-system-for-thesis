-- A borrow request should be visible only to its borrower and to the accounts
-- that can actually act on it.
--
-- The old policy (20260708_0001) was:
--
--   is_super_admin() or department_id = current_user_department_id() or borrower_id = auth.uid()
--
-- The middle clause is the problem: it exposes a department's entire borrowing
-- ledger to EVERY member of that department. A student could read their
-- classmates' and their faculty's requests, and a faculty member could read
-- other faculty's requests, none of which they have any authority over. Supply
-- Office requests were already correctly hidden from department admins
-- (department_id is null never equals a department), so that part is unchanged.
--
-- The rule below mirrors the approval authority in transition_borrow_record, so
-- "can see it" and "can act on it" finally agree:
--
--   * the borrower — always sees their own requests, wherever the item lives;
--   * super admin — everything (the only approver for Supply Office items);
--   * department admin — their own department's requests;
--   * faculty (staff) — their own department's STUDENT requests, which are the
--     only ones they may approve.
--
-- The faculty clause reads borrower_role off the row rather than joining
-- profiles: a policy subquery runs with the caller's own rights, and the
-- profiles policy would hide that student's row from the faculty member, making
-- the check silently false. borrower_role is denormalized for exactly this
-- reason (20260729180000).

drop policy if exists "borrow select scoped" on public.borrow_records;
create policy "borrow select scoped"
on public.borrow_records
for select
to authenticated
using (
  borrower_id = auth.uid()
  or public.is_super_admin()
  or (
    public.current_user_role() = 'department_admin'
    and department_id = public.current_user_department_id()
  )
  or (
    public.current_user_role() = 'staff'
    and borrower_role = 'student'
    and department_id = public.current_user_department_id()
  )
);
