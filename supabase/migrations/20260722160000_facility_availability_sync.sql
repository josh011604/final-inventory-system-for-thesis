-- Keeps facilities.current_availability honest about reservations.
--
-- Until now the column never moved: a facility stayed 'available' even after a
-- reservation against it was approved, so the Facilities screen kept offering
-- an already-booked room and the Availability column was decorative.
--
-- Rule: a facility reads 'reserved' while it has at least one approved
-- reservation dated today or later, and returns to 'available' once none
-- remain. Only those two states are managed here — 'under_maintenance' and
-- 'in_use' are set deliberately elsewhere and must never be clobbered by a
-- reservation, so a facility in either state is left exactly as it is.
--
-- A pending request does not take the room out of circulation; only an approved
-- one does. Overlapping requests are already impossible thanks to the
-- facility_reservations_no_overlap constraint in 20260722140000.

create or replace function public.sync_facility_availability(p_facility_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_active_reservation boolean;
  v_current text;
begin
  select current_availability into v_current
  from public.facilities
  where id = p_facility_id;

  if v_current is null or v_current in ('under_maintenance', 'in_use') then
    return;
  end if;

  select exists (
    select 1
    from public.facility_reservations
    where facility_id = p_facility_id
      and status = 'approved'
      and reserved_date >= current_date
  ) into v_has_active_reservation;

  update public.facilities
  set current_availability = case when v_has_active_reservation then 'reserved' else 'available' end
  where id = p_facility_id
    and current_availability is distinct from (case when v_has_active_reservation then 'reserved' else 'available' end);
end;
$$;

create or replace function public.on_facility_reservation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_facility_availability(old.facility_id);
    return old;
  end if;

  perform public.sync_facility_availability(new.facility_id);
  -- A reservation moved to a different facility frees the old one.
  if tg_op = 'UPDATE' and old.facility_id is distinct from new.facility_id then
    perform public.sync_facility_availability(old.facility_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_facility_reservations_sync_availability on public.facility_reservations;
create trigger trg_facility_reservations_sync_availability
after insert or update or delete on public.facility_reservations
for each row execute function public.on_facility_reservation_change();

-- The trigger fires on reservation changes, but a booking also expires simply
-- because the date rolls over. This sweep releases those rooms.
create or replace function public.refresh_all_facility_availability()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_facility record;
  v_count integer := 0;
begin
  for v_facility in
    select id from public.facilities where current_availability in ('available', 'reserved')
  loop
    perform public.sync_facility_availability(v_facility.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.refresh_all_facility_availability() from public, anon, authenticated;
grant execute on function public.refresh_all_facility_availability() to service_role;

-- Bring existing rows in line with the new rule immediately.
select public.refresh_all_facility_availability();

-- Schedule the daily rollover sweep, mirroring the defensive pattern used by
-- the overdue-borrows job in 20260713120000.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'refresh-facility-availability') then
      perform cron.unschedule('refresh-facility-availability');
    end if;
    perform cron.schedule('refresh-facility-availability', '5 0 * * *', 'select public.refresh_all_facility_availability();');
  else
    raise notice 'pg_cron not available - facility availability sweep created but not scheduled.';
  end if;
exception
  when others then
    raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
