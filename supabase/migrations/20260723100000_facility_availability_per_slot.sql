-- Undoes the blanket day-level availability from 20260722160000.
--
-- That migration flipped a facility to 'reserved' for the rest of the day (in
-- fact indefinitely, since it checked reserved_date >= current_date with no
-- upper bound) the moment ANY approved reservation existed against it. A
-- single 8–9 AM booking made the whole facility read "reserved" all day,
-- hiding that it was actually free at 10 AM and every afternoon — misleading,
-- and it also silently blocked booking a second, non-overlapping slot on the
-- same day even though nothing about that second slot conflicts.
--
-- current_availability now reflects only what an administrator explicitly
-- set (under_maintenance / in_use) or the schema default (available). Whether
-- a facility is occupied *right now*, and what its other bookings for today
-- are, is computed live from facility_reservations — see facilityBookingsOn
-- and activeBooking in src/backend/lib/reservations.ts — rather than stored,
-- so it's always exact to the minute instead of only as fresh as the last
-- write or the last cron tick.

-- One-time repair: release every facility this logic incorrectly parked in
-- 'reserved', regardless of whether it happens to have a booking active this
-- instant — the column is no longer this system's concern.
update public.facilities
set current_availability = 'available'
where current_availability = 'reserved';

drop trigger if exists trg_facility_reservations_sync_availability on public.facility_reservations;
drop function if exists public.on_facility_reservation_change();
drop function if exists public.sync_facility_availability(bigint);
drop function if exists public.refresh_all_facility_availability();

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'refresh-facility-availability') then
      perform cron.unschedule('refresh-facility-availability');
    end if;
  end if;
exception
  when others then
    raise notice 'cron unschedule skipped: %', sqlerrm;
end;
$$;
