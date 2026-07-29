-- Approver tracking for item history: `approved_by` already recorded who
-- confirmed/rejected a borrow request, but (1) there was no timestamp for
-- that decision distinct from `updated_at` (which a later return overwrites),
-- and (2) nothing recorded who processed the return.
--
-- Names are denormalized onto the row at transition time (same pattern as
-- the audit_logs/notifications text already baked into borrow-status's
-- messages) rather than left as a profiles join: "profiles select own or
-- admin" RLS only lets a caller read their own profile or an admin's, so a
-- student/staff viewer resolving `approver:profiles!...(full_name)` for
-- someone else's approval got `null` back. Storing the name directly makes
-- item history readable by every account type without widening profiles RLS.

alter table public.borrow_records
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by_name text,
  add column if not exists returned_by uuid references public.profiles(id) on delete set null,
  add column if not exists returned_by_name text;

-- Backfill names for existing rows from the id already on record. Historical
-- approved_at is intentionally left null (updated_at was overwritten by any
-- later transition, so there's no reliable source timestamp to backfill from)
-- and the UI falls back to updated_at for rows that predate this migration.
update public.borrow_records br
set approved_by_name = p.full_name
from public.profiles p
where br.approved_by = p.id and br.approved_by_name is null;

-- Best-effort only: pre-existing returned rows never recorded a distinct
-- returner, so assume the same admin handled both steps.
update public.borrow_records
set returned_by = approved_by, returned_by_name = approved_by_name
where status = 'returned' and returned_by is null and approved_by is not null;

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
  v_actor_name text;
  v_equipment_status text;
begin
  select role, department_id, full_name into v_actor_role, v_actor_department, v_actor_name
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

  -- An approver may never approve or reject their own request.
  if p_new_status in ('confirmed', 'rejected') and v_record.borrower_id = p_actor_id then
    raise exception 'You cannot approve or reject your own borrow request' using errcode = '42501';
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
    approved_at = case when p_new_status in ('confirmed', 'rejected') then now() else approved_at end,
    approved_by_name = case when p_new_status in ('confirmed', 'rejected') then v_actor_name else approved_by_name end,
    returned_by = case when p_new_status = 'returned' then p_actor_id else returned_by end,
    returned_by_name = case when p_new_status = 'returned' then v_actor_name else returned_by_name end,
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
