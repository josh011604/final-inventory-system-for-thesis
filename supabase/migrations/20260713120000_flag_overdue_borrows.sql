-- Automated overdue detection for borrowed equipment.
--
-- The dashboard "Needs Attention" panel and the Reports module already compute
-- "overdue" on the fly (still out + past the expected return date). This
-- migration makes that state *authoritative and actionable* on the server:
--
--   1. flag_overdue_borrow_records() sweeps every still-out record whose due
--      date has passed, moves it to status 'overdue', notifies the borrower,
--      and writes an audit-log entry. It mirrors the security-definer +
--      notification + audit-log pattern already used by transition_borrow_record.
--   2. transition_borrow_record() is extended so an 'overdue' item can still be
--      returned (previously only 'confirmed'/'borrowed' could transition to
--      'returned', which would have stranded anything this job flagged).
--   3. An hourly pg_cron job runs the sweep. The scheduling is guarded so a
--      project without pg_cron enabled still applies the rest of the migration.

-- 1. The sweep -------------------------------------------------------------

create or replace function public.flag_overdue_borrow_records()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record record;
  v_count integer := 0;
begin
  for v_record in
    select id, borrower_id, department_id, expected_return_date, status
    from public.borrow_records
    where status in ('confirmed', 'borrowed')
      and expected_return_date is not null
      and expected_return_date < now()
    for update
  loop
    update public.borrow_records
    set status = 'overdue'
    where id = v_record.id;

    if v_record.borrower_id is not null then
      insert into public.notifications (profile_id, department_id, title, message, tone)
      values (
        v_record.borrower_id,
        v_record.department_id,
        'Borrowed item overdue',
        'Your borrow request #' || v_record.id || ' is overdue. It was due on '
          || to_char(v_record.expected_return_date, 'Mon DD, YYYY')
          || '. Please return it as soon as possible.',
        'danger'
      );
    end if;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, description)
    values (
      null, -- system actor: no human triggered this
      'borrow_overdue_flagged',
      'borrow_records',
      v_record.id,
      jsonb_build_object('status', v_record.status),
      jsonb_build_object('status', 'overdue'),
      'Borrow record #' || v_record.id || ' automatically flagged overdue (due '
        || to_char(v_record.expected_return_date, 'YYYY-MM-DD') || ')'
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Only the service role (and the owner, which is how the cron job runs) may
-- call the sweep directly; clients never invoke it.
revoke all on function public.flag_overdue_borrow_records() from public, anon, authenticated;
grant execute on function public.flag_overdue_borrow_records() to service_role;

-- 2. Let overdue items be returned ----------------------------------------

create or replace function public.transition_borrow_record(
  p_record_id bigint,
  p_new_status text,
  p_actor_id uuid
)
returns public.borrow_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.borrow_records;
  v_old_status text;
  v_actor_role text;
  v_actor_department uuid;
  v_equipment_status text;
begin
  select role, department_id into v_actor_role, v_actor_department
  from public.profiles
  where id = p_actor_id;

  if v_actor_role is null then
    raise exception 'Actor not found' using errcode = 'P0001';
  end if;

  select * into v_record
  from public.borrow_records
  where id = p_record_id
  for update;

  if not found then
    raise exception 'Borrow record not found' using errcode = 'P0002';
  end if;

  if not (
    v_actor_role = 'super_admin'
    or (v_actor_role = 'department_admin' and v_record.department_id is not distinct from v_actor_department)
  ) then
    raise exception 'Not authorized to update this borrow record' using errcode = '42501';
  end if;

  if p_new_status not in ('confirmed', 'rejected', 'returned') then
    raise exception 'Unknown status %', p_new_status using errcode = '22023';
  end if;

  if not (
    (v_record.status = 'pending' and p_new_status in ('confirmed', 'rejected'))
    -- 'overdue' added: an automatically flagged item must still be returnable.
    or (v_record.status in ('confirmed', 'borrowed', 'overdue') and p_new_status = 'returned')
  ) then
    raise exception 'Cannot move borrow record from % to %', v_record.status, p_new_status using errcode = '22023';
  end if;

  if p_new_status = 'confirmed' and v_record.equipment_id is not null then
    select status into v_equipment_status from public.equipment where id = v_record.equipment_id;
    if v_equipment_status is distinct from 'available' then
      raise exception 'Equipment is not available' using errcode = '22023';
    end if;
  end if;

  v_old_status := v_record.status;

  update public.borrow_records
  set
    status = p_new_status,
    approved_by = case when p_new_status in ('confirmed', 'rejected') then p_actor_id else approved_by end,
    actual_return_date = case when p_new_status = 'returned' then now() else actual_return_date end
  where id = p_record_id
  returning * into v_record;

  if v_record.equipment_id is not null then
    if p_new_status = 'confirmed' then
      update public.equipment set status = 'borrowed' where id = v_record.equipment_id;
    elsif p_new_status = 'returned' then
      -- Equipment stays 'borrowed' while a record is overdue, so this same
      -- guarded update releases both on-time and overdue returns.
      update public.equipment set status = 'available' where id = v_record.equipment_id and status = 'borrowed';
    end if;
  end if;

  if v_record.borrower_id is not null then
    insert into public.notifications (profile_id, department_id, title, message, tone)
    values (
      v_record.borrower_id,
      v_record.department_id,
      'Borrow request ' || p_new_status,
      'Your borrow request #' || v_record.id || ' was marked ' || p_new_status || '.',
      case p_new_status
        when 'returned' then 'success'
        when 'rejected' then 'danger'
        else 'info'
      end
    );
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, description)
  values (
    p_actor_id,
    'borrow_status_change',
    'borrow_records',
    v_record.id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status),
    'Borrow record #' || v_record.id || ' moved from ' || v_old_status || ' to ' || p_new_status
  );

  return v_record;
end;
$$;

revoke all on function public.transition_borrow_record(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.transition_borrow_record(bigint, text, uuid) to service_role;

-- 3. Schedule the hourly sweep --------------------------------------------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if exists (select 1 from cron.job where jobname = 'flag-overdue-borrows') then
      perform cron.unschedule('flag-overdue-borrows');
    end if;
    perform cron.schedule('flag-overdue-borrows', '0 * * * *', 'select public.flag_overdue_borrow_records();');
  else
    raise notice 'pg_cron not available - overdue sweep function created but not scheduled. Enable pg_cron and re-run, or trigger the function from an external scheduler.';
  end if;
exception
  when others then
    raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
