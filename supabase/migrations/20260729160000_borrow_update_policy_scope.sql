-- Close two holes in the "borrow update scoped" policy (20260708_0001), which
-- allowed an update when:
--
--   public.is_super_admin() or public.is_department_admin() or borrower_id = auth.uid()
--
--   1. `borrower_id = auth.uid()` let ANY borrower update their own record —
--      including its status. A student or faculty member could approve their
--      own pending request with a single direct PostgREST call
--      (update borrow_records set status = 'confirmed' where id = <mine>),
--      skipping approval entirely. The insert guard from 20260723130000 pins
--      new rows to 'pending', but nothing stopped them changing it afterwards.
--   2. `public.is_department_admin()` is not department-scoped, so any
--      department admin could act on ANY department's requests, and on Supply
--      Office requests (department_id null) that are supposed to reach only the
--      super admin.
--
-- Nothing in the application updates borrow_records directly: every transition
-- goes through the borrow-status edge function, which uses the service-role key
-- and bypasses RLS altogether. So this policy exists purely as the backstop for
-- direct API access, and narrowing it changes no app behaviour.
--
-- Faculty approval of a student's request is intentionally NOT expressed here.
-- It would need to read the borrower's role from profiles, and a subquery in a
-- policy runs with the caller's own rights — a faculty member cannot read that
-- student's profile row (see 20260729150000), so the check would always be
-- false. That path runs through the edge function like every other transition;
-- transition_borrow_record remains the authority on who may approve what.

drop policy if exists "borrow update scoped" on public.borrow_records;
create policy "borrow update scoped"
on public.borrow_records
for update
to authenticated
using (
  public.is_super_admin()
  or (public.is_department_admin() and department_id = public.current_user_department_id())
)
with check (
  public.is_super_admin()
  or (public.is_department_admin() and department_id = public.current_user_department_id())
);
