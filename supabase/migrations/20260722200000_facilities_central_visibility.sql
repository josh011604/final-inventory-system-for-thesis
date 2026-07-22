-- Central (department-less) facilities such as the Supply Office are meant to
-- be visible and reservable by any non-student user: the
-- facility_reservations insert policy already allows a request against one
-- from any non-student role, and notify_facility_reservation already routes
-- those requests to the super admins. But "facilities scoped select" only
-- ever matched `department_id = current_user_department_id()` — that
-- comparison is NULL, not true, when department_id IS NULL, so staff and
-- department admins could never see a central facility in the first place.
-- Only the super admin could reserve one; the "anyone but a student" design
-- was unreachable for everybody else.

drop policy if exists "facilities scoped select" on public.facilities;
create policy "facilities scoped select"
on public.facilities
for select
to authenticated
using (public.is_super_admin() or department_id = public.current_user_department_id() or department_id is null);
