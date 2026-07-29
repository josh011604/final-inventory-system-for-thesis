-- Borrow workflow overhaul: multi-unit requests, role-aware approval routing,
-- cross-department faculty borrowing, and faculty approval of student requests.
--
-- Summary of the rules this migration encodes (the borrow-status edge function
-- mirrors the same rules for friendlier errors and for the auto-approve path):
--
--   * Multi-unit: a single request may be for N units of an item (e.g. 10
--     chairs). Availability is measured in units, not request count.
--   * Auto-approve (handled in the edge function): a super admin borrowing a
--     Supply Office item, or a department admin borrowing their own
--     department's item, is confirmed immediately with no approval step.
--   * Faculty (role 'staff') may now borrow ANY department's items, not just
--     their own department + Supply Office. A cross-department request is
--     routed to the admin of the department the item belongs to.
--   * Faculty may APPROVE a student's request for an item in their own
--     department (either the faculty member or the department admin can clear
--     it). Faculty and admin requests still require an admin.
--   * Only students stay department-locked (own department only, no Supply
--     Office), matching the existing product rule.

-- 1. Multi-unit quantity on each borrow request. Defaults to 1 so every existing
--    row and single-unit request keeps its current meaning.
alter table public.borrow_records
  add column if not exists quantity integer not null default 1;

alter table public.borrow_records
  drop constraint if exists borrow_records_quantity_positive;
alter table public.borrow_records
  add constraint borrow_records_quantity_positive check (quantity >= 1);

-- 2. Department scope for new requests: only students are locked to their own
--    department. Everyone else may request Supply Office items or any
--    department's items (cross-department requests are approved by that
--    department's admin). Replaces the own-department-only rule from
--    20260719130000.
create or replace function public.enforce_borrow_department_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	v_equipment_department uuid;
	v_borrower_role text;
	v_borrower_department uuid;
begin
	select department_id into v_equipment_department from public.equipment where id = new.equipment_id;
	select role, department_id into v_borrower_role, v_borrower_department from public.profiles where id = new.borrower_id;

	if v_borrower_role = 'student' then
		-- Students: own department only, never Supply Office (null department).
		if v_equipment_department is null or v_equipment_department is distinct from v_borrower_department then
			raise exception 'Students can only request items from their own department' using errcode = '42501';
		end if;
	end if;

	return new;
end;
$$;

drop trigger if exists trg_borrow_department_scope on public.borrow_records;
create trigger trg_borrow_department_scope
before insert on public.borrow_records
for each row execute function public.enforce_borrow_department_scope();

-- 3. Equipment visibility: faculty need to browse other departments' items to
--    borrow them, so every non-student may read all equipment. Students still
--    see only their own department's items — which also hides Supply Office
--    (null department) inventory from them, as required. Replaces the
--    own-department + null-department rule from 20260714130000.
drop policy if exists "equipment scoped select" on public.equipment;
create policy "equipment scoped select"
on public.equipment
for select
to authenticated
using (
  public.current_user_role() in ('super_admin', 'department_admin', 'staff')
  or department_id = public.current_user_department_id()
);

-- 4. Approval authorization: add faculty as an approver of student requests in
--    their own department. Otherwise identical to 20260723120000 (self-approval
--    guard, transition graph, equipment cascade, notification, audit log).
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
  v_borrower_role text;
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

  select role into v_borrower_role from public.profiles where id = v_record.borrower_id;

  if not (
    v_actor_role = 'super_admin'
    or (v_actor_role = 'department_admin' and v_record.department_id is not distinct from v_actor_department)
    -- Faculty may act on a student's request scoped to their own department.
    or (v_actor_role = 'staff' and v_borrower_role = 'student' and v_record.department_id is not distinct from v_actor_department)
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
