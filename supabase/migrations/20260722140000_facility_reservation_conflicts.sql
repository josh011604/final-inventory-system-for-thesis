-- Hardens facility reservations in two places the original migration left open.
--
-- 1. Double-booking was only prevented by a client-side overlap check in
--    FacilitiesPage. That check can only see rows the caller's RLS policy lets
--    it read, so a requester could book a facility whose existing reservations
--    are invisible to them (notably the central, department-less rooms, whose
--    reservations only the super admin can see). The exclusion constraint below
--    makes the database the authority instead.
--
-- 2. A reservation for a department-less facility produced a notification with
--    both profile_id and department_id null. Under the notifications select
--    policy (profile_id = auth.uid() or department_id = current_user_department_id()
--    or is_super_admin()) that row was addressed to nobody, so no dean ever saw
--    the request land. Those requests are now routed to every super admin.

create extension if not exists btree_gist;

-- Only pending and approved reservations hold a slot; rejected and cancelled
-- ones release it, so they are excluded from the constraint.
alter table public.facility_reservations
  drop constraint if exists facility_reservations_no_overlap;

alter table public.facility_reservations
  add constraint facility_reservations_no_overlap
  exclude using gist (
    facility_id with =,
    reserved_date with =,
    tsrange(('2000-01-01'::date + start_time)::timestamp, ('2000-01-01'::date + end_time)::timestamp) with &&
  )
  where (status in ('pending', 'approved'));

-- Replaces the version in 20260722120000: same behavior, except a request
-- against a facility with no owning department now notifies the super admins
-- individually instead of writing an unaddressed row.
create or replace function public.notify_facility_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
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
