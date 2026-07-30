-- Stock deduction on borrow.
--
-- Before this migration `equipment.quantity` was the item's TOTAL stock and it
-- never changed; how many units were free was computed on the fly as
-- quantity - (units out on active borrows).
--
-- From here on `equipment.quantity` is the number of units ON HAND: approving a
-- borrow for N units subtracts N from it, and returning the request adds N back.
-- The item's original/total stock is no longer stored — it is reconstructed for
-- display as on-hand + units currently out.
--
-- The adjustment lives in a trigger rather than in the borrow-status edge
-- function so it is atomic with the status change and cannot be skipped by any
-- other write path (SQL transition function, overdue sweep, manual fix-ups).

-- 1. On-hand stock can reach zero but must never go negative.
alter table public.equipment
  drop constraint if exists equipment_quantity_non_negative;
alter table public.equipment
  add constraint equipment_quantity_non_negative check (quantity >= 0);

-- 2. The borrow statuses that are holding physical units. 'pending' is absent on
--    purpose: an unapproved request reserves nothing, so it deducts nothing.
create or replace function public.is_active_borrow_status(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status in ('confirmed', 'borrowed', 'return_requested', 'overdue');
$$;

-- 3. Keep equipment.quantity in step with every borrow-record write.
create or replace function public.sync_equipment_stock_on_borrow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_equipment_id bigint;
  v_held_before integer := 0;
  v_held_after integer := 0;
  v_delta integer;
  v_remaining integer;
begin
  v_equipment_id := coalesce(new.equipment_id, old.equipment_id);
  if v_equipment_id is null then
    return coalesce(new, old);
  end if;

  if tg_op <> 'INSERT' and public.is_active_borrow_status(old.status) then
    v_held_before := greatest(coalesce(old.quantity, 1), 1);
  end if;
  if tg_op <> 'DELETE' and public.is_active_borrow_status(new.status) then
    v_held_after := greatest(coalesce(new.quantity, 1), 1);
  end if;

  -- Positive delta = more units leave the shelf; negative = units come back.
  v_delta := v_held_after - v_held_before;
  if v_delta = 0 then
    return coalesce(new, old);
  end if;

  if v_delta > 0 then
    -- The `quantity >= v_delta` predicate is the authoritative oversell guard:
    -- it locks the equipment row, so two approvals racing for the last units
    -- cannot both succeed.
    update public.equipment
    set quantity = quantity - v_delta
    where id = v_equipment_id and quantity >= v_delta
    returning quantity into v_remaining;

    if v_remaining is null then
      raise exception 'Not enough units of this item are in stock' using errcode = '23514';
    end if;
  else
    update public.equipment
    set quantity = quantity + (-v_delta)
    where id = v_equipment_id
    returning quantity into v_remaining;
  end if;

  -- Coarse status cascade: an empty shelf reads 'borrowed', and the item flips
  -- back to 'available' the moment a unit returns. Out-of-service statuses
  -- (maintenance/damaged/lost/disposed) are never overwritten.
  if v_remaining = 0 then
    update public.equipment set status = 'borrowed' where id = v_equipment_id and status = 'available';
  elsif v_remaining > 0 then
    update public.equipment set status = 'available' where id = v_equipment_id and status = 'borrowed';
  end if;

  return coalesce(new, old);
end;
$$;

-- 4. Backfill, then arm the trigger. The backfill converts the old "total stock"
--    numbers into on-hand numbers by subtracting whatever is already out. It is
--    guarded on the trigger not existing yet so re-running this migration is a
--    no-op instead of double-subtracting.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_borrow_stock_sync') then
    update public.equipment e
    set quantity = greatest(e.quantity - out.units, 0)
    from (
      select equipment_id, sum(greatest(coalesce(quantity, 1), 1))::integer as units
      from public.borrow_records
      where public.is_active_borrow_status(status) and equipment_id is not null
      group by equipment_id
    ) as out
    where out.equipment_id = e.id;
  end if;
end
$$;

drop trigger if exists trg_borrow_stock_sync on public.borrow_records;
create trigger trg_borrow_stock_sync
after insert or update or delete on public.borrow_records
for each row execute function public.sync_equipment_stock_on_borrow();

-- 5. transition_borrow_record, definitive version. This migration is dated
--    after 20260729120000_borrow_approver_tracking so that it is the one that
--    survives, and it has to combine three separate lines of change that all
--    replaced this same function:
--
--      * 20260728130000 — faculty (role 'staff') may approve a STUDENT's
--        request scoped to their own department. The approver-tracking version
--        was written from the older function body and does not contain this
--        clause, so applying it alone silently revokes faculty approval.
--      * 20260729120000 — stamps approved_at / approved_by_name / returned_by /
--        returned_by_name so item history can name the approver without a
--        profiles join. Carried over verbatim.
--      * this migration — the equipment.status cascade is gone (the stock
--        trigger above owns it, and only it knows whether any units are left),
--        and the confirm guard no longer demands status = 'available', which is
--        wrong once a partly-loaned item reads 'borrowed'. It now refuses only
--        out-of-service items; running out of units is caught by the trigger.
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

revoke all on function public.transition_borrow_record(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.transition_borrow_record(bigint, text, uuid) to service_role;
