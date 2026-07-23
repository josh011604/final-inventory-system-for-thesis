-- Bug fix: transition_borrow_record authorized any department_admin over
-- their own department's records, and any super_admin over everything, with
-- no check that the approver wasn't also the borrower. A department admin
-- (or super admin) could therefore submit a borrow request and then approve
-- or reject it themselves, bypassing the entire point of an approval step.
-- The client-side mirror of this guard is isSelfBorrowRequest() in
-- src/backend/lib/borrowing.ts.

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
