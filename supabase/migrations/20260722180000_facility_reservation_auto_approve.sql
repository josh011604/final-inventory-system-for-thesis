-- A department admin (or super admin) reserving a facility is also that
-- facility's approver, so making them file a pending request and then approve
-- it themselves a moment later is pure friction — and self-approval on an
-- *update* is already blocked by guard_facility_reservation, so without this
-- change an admin's own booking could only ever be approved by someone else.
--
-- Rule, mirrored client-side by reservationAutoApproves() in
-- src/backend/lib/reservations.ts:
--   - A super admin's request is approved on arrival (they approve everything).
--   - A department admin's request is approved on arrival only when it is for
--     their own department's facility — a central (department-less) facility
--     is still approved by a super admin, so that request still starts pending.
--   - Staff (and, if ever enabled, students) always start pending; someone
--     else must review their request.

drop policy if exists "facility reservations insert own" on public.facility_reservations;
create policy "facility reservations insert own"
on public.facility_reservations
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and public.current_user_role() <> 'student'
  and (
    (status = 'pending' and approved_by is null)
    or (
      status = 'approved'
      and approved_by = auth.uid()
      and (
        public.is_super_admin()
        or (public.is_department_admin() and department_id is not distinct from public.current_user_department_id())
      )
    )
  )
);

-- Replaces the version in 20260722140000: a self-approved insert must not
-- generate an "awaiting review" notification — there is nothing left to
-- review. The approve/reject-on-update branch is unchanged.
create or replace function public.notify_facility_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    if new.department_id is not null then
      insert into public.notifications (department_id, title, message, tone)
      values (
        new.department_id,
        'New facility reservation',
        'A facility reservation request for ' || new.reserved_date || ' is awaiting review.',
        'info'
      );
    else
      -- Central facility: the super admins are the approvers.
      insert into public.notifications (profile_id, title, message, tone)
      select
        p.id,
        'New facility reservation',
        'A central facility reservation request for ' || new.reserved_date || ' is awaiting review.',
        'info'
      from public.profiles p
      where p.role = 'super_admin' and p.status = 'active';
    end if;
  elsif tg_op = 'UPDATE'
        and new.status is distinct from old.status
        and new.status in ('approved', 'rejected') then
    insert into public.notifications (profile_id, title, message, tone)
    values (
      new.requester_id,
      'Facility reservation ' || new.status,
      'Your facility reservation for ' || new.reserved_date || ' was ' || new.status || '.',
      case when new.status = 'approved' then 'success' else 'danger' end
    );
  end if;
  return new;
end;
$$;
