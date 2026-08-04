-- Approval belongs to the department that owns the item.
--
-- Until now transition_borrow_record granted the super admin blanket authority
-- over every borrow record:
--
--   v_actor_role = 'super_admin'
--   or (v_actor_role = 'department_admin' and v_record.department_id is not distinct from v_actor_department)
--   or (v_actor_role = 'staff' and v_borrower_role = 'student' and ...)
--
-- So a BSCS faculty member borrowing a BSCS item could be cleared by the super
-- admin, even though the item is BSCS's property and never passed through the
-- Supply Office. The department that owns the stock should be the one that
-- decides, and the super admin owns exactly one pool: the Supply Office
-- (department_id is null).
--
-- New rule for APPROVE / REJECT:
--
--   * department_id is null  (Supply Office) -> super admin only. No department
--     admin's department can equal null, so they were already excluded.
--   * department_id is set   (e.g. BSCS)     -> that department's admin, plus
--     that department's faculty when the borrower is one of its students.
--     The super admin is NOT an approver here.
--
-- RETURNING is deliberately left alone: marking an item handed back records a
-- physical fact rather than deciding anything, and removing the super admin
-- there would leave a record no one can close whenever a department admin is
-- unavailable. Authority for 'returned' therefore stays as it was.
--
-- The select policy (20260729200000) is also unchanged on purpose — the super
-- admin keeps READ access to every borrow record, because the dashboard, the
-- reports page and the audit trail are system-wide views. They can see a BSCS
-- request; they simply cannot act on it. The client mirrors this in
-- canApproveBorrow() so Approve/Reject never render for a record this function
-- would reject.
--
-- Everything below the authority check is byte-identical to 20260729190000:
-- the approver/returner stamping (including the 'rejected' branch), the
-- borrower notification, and the audit_logs entry.

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
  v_borrower_role text;
  v_equipment_status text;
  v_is_approval boolean;
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

  select role into v_borrower_role from public.profiles where id = v_record.borrower_id;

  -- Validated before the authority check so v_is_approval is trustworthy.
  if p_new_status not in ('confirmed', 'rejected', 'returned') then
    raise exception 'Unknown status %', p_new_status using errcode = '22023';
  end if;

  v_is_approval := p_new_status in ('confirmed', 'rejected');

  if not (
    (
      v_actor_role = 'super_admin'
      -- Approving: Supply Office stock only. Returning: system-wide, as before.
      and (not v_is_approval or v_record.department_id is null)
    )
    or (v_actor_role = 'department_admin' and v_record.department_id is not distinct from v_actor_department)
    -- Faculty may act on a student's request scoped to their own department.
    or (v_actor_role = 'staff' and v_borrower_role = 'student' and v_record.department_id is not distinct from v_actor_department)
  ) then
    -- Name the actual reason for the one case that is newly forbidden,
    -- otherwise a super admin sees a flat "not authorized" on a system they
    -- administer and reasonably assumes it is a bug.
    if v_is_approval and v_actor_role = 'super_admin' and v_record.department_id is not null then
      raise exception 'This item belongs to a department. Only that department''s administrator or faculty can approve the request.'
        using errcode = '42501';
    end if;
    raise exception 'Not authorized to update this borrow record' using errcode = '42501';
  end if;

  -- An approver may never approve or reject their own request.
  if v_is_approval and v_record.borrower_id = p_actor_id then
    raise exception 'You cannot approve or reject your own borrow request' using errcode = '42501';
  end if;

  if not (
    (v_record.status = 'pending' and p_new_status in ('confirmed', 'rejected'))
    or (v_record.status in ('confirmed', 'borrowed', 'overdue') and p_new_status = 'returned')
  ) then
    raise exception 'Cannot move borrow record from % to %', v_record.status, p_new_status using errcode = '22023';
  end if;

  if p_new_status = 'confirmed' and v_record.equipment_id is not null then
    select status into v_equipment_status from public.equipment where id = v_record.equipment_id;
    if v_equipment_status in ('maintenance', 'damaged', 'lost', 'disposed') then
      raise exception 'Equipment is not available' using errcode = '22023';
    end if;
  end if;

  v_old_status := v_record.status;

  -- trg_borrow_stock_sync fires on this update: it moves equipment.quantity by
  -- the record's own quantity and refreshes the item's coarse status.
  update public.borrow_records
  set
    status = p_new_status,
    approved_by = case when p_new_status in ('confirmed', 'rejected') then p_actor_id else approved_by end,
    approved_at = case when p_new_status in ('confirmed', 'rejected') then now() else approved_at end,
    approved_by_name = case when p_new_status in ('confirmed', 'rejected') then v_actor_name else approved_by_name end,
    -- The authority that cleared it, not just the person: an audit trail has to
    -- survive the approver later changing role or leaving.
    approved_by_role = case when p_new_status in ('confirmed', 'rejected') then v_actor_role else approved_by_role end,
    returned_by = case when p_new_status = 'returned' then p_actor_id else returned_by end,
    returned_by_name = case when p_new_status = 'returned' then v_actor_name else returned_by_name end,
    actual_return_date = case when p_new_status = 'returned' then now() else actual_return_date end
  where id = p_record_id
  returning * into v_record;

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
    jsonb_build_object('status', p_new_status, 'quantity', v_record.quantity),
    'Borrow record #' || v_record.id || ' moved from ' || v_old_status || ' to ' || p_new_status
      || ' (' || v_record.quantity || ' unit' || case when v_record.quantity = 1 then '' else 's' end || ')'
  );

  return v_record;
end;
$$;
