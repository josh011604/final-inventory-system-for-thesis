-- Borrow traceability: a readable name for the borrower and the approver.
--
-- The "profiles select own or admin" policy (20260708_0001) lets a user read
-- only their OWN profile unless they are a super admin or the department admin
-- of that profile's department. That breaks two borrow rules that depend on
-- knowing who the other party is:
--
--   * Faculty (role 'staff') may approve a STUDENT's request for an item in
--     their own department — but the Borrowing screen decides whether to offer
--     Approve/Reject from the borrower's role, which a faculty member could not
--     read at all. The approval button never appeared, even though
--     transition_borrow_record would have allowed the action.
--   * Every borrow must record who approved it. A student (or faculty member)
--     could not read the approver's profile, so the "Approved by" column and
--     the item-history timeline showed nothing for exactly the people the
--     record is meant to be accountable to.
--
-- Rather than widen the profiles policy (which would expose PII columns such as
-- employee_id to every classmate), this adds a narrow directory view exposing
-- only identity fields — no contact details, no PII.
--
-- The view deliberately runs with the definer's rights (security_invoker off)
-- so it can see past the profiles policy; its own WHERE clause is the access
-- rule, and it is strictly narrower than "any authenticated user".

create or replace view public.profile_directory
with (security_invoker = false) as
select
  p.id,
  p.full_name,
  p.role,
  p.department_id
from public.profiles p
where
  -- Yourself.
  p.id = auth.uid()
  -- Super admins already read every profile.
  or public.is_super_admin()
  -- Anyone in your own department: this is what lets a faculty member see that
  -- a request came from a student of their department, and lets a department
  -- admin / student see each other's names on a request.
  or (public.current_user_department_id() is not null and p.department_id = public.current_user_department_id())
  -- The other party on a borrow record you are already part of, even across
  -- departments — so a borrower can always see who approved their request
  -- (e.g. the Supply Office super admin) and vice versa.
  or exists (
    select 1
    from public.borrow_records b
    where (b.borrower_id = p.id and b.approved_by = auth.uid())
       or (b.approved_by = p.id and b.borrower_id = auth.uid())
  );

revoke all on public.profile_directory from anon;
grant select on public.profile_directory to authenticated;
