-- Main Supply (Central Inventory): equipment with no department (department_id
-- is null) is owned centrally by the super admin. Anyone signed in may VIEW
-- Main Supply items so they can be requested through the New Request workflow,
-- while department-owned items stay scoped to their own department (for viewing
-- and tracking only). Writing Main Supply items remains super-admin-only via the
-- existing "equipment admin write" policy.

drop policy if exists "equipment scoped select" on public.equipment;
create policy "equipment scoped select"
on public.equipment
for select
to authenticated
using (
  public.is_super_admin()
  or department_id = public.current_user_department_id()
  or department_id is null
);
