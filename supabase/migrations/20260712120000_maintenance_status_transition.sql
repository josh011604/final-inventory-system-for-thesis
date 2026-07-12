-- Server-side ownership of maintenance request status transitions.
--
-- Previously the client updated maintenance_requests.status directly, and the
-- "maintenance write scoped" policy allowed the requester to update their own
-- row for *any* column — so a self-service staff account could bypass the
-- UI's canManage gating and mark their own request "completed" straight
-- through a raw REST/Supabase call. Status changes now happen only through
-- this security-definer function (called from the maintenance-status edge
-- function using the service-role key), which validates the actor's
-- role/department, enforces a fixed transition graph, and atomically cascades
-- the equipment status + a notification + an audit log entry in one go.

create or replace function public.transition_maintenance_request(
  p_request_id bigint,
  p_new_status text,
  p_actor_id uuid
)
returns public.maintenance_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.maintenance_requests;
  v_old_status text;
  v_actor_role text;
  v_actor_department uuid;
begin
  select role, department_id into v_actor_role, v_actor_department
  from public.profiles
  where id = p_actor_id;

  if v_actor_role is null then
    raise exception 'Actor not found' using errcode = 'P0001';
  end if;

  select * into v_request
  from public.maintenance_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Maintenance request not found' using errcode = 'P0002';
  end if;

  if not (
    v_actor_role = 'super_admin'
    or (v_actor_role = 'department_admin' and v_request.department_id is not distinct from v_actor_department)
  ) then
    raise exception 'Not authorized to update this maintenance request' using errcode = '42501';
  end if;

  if p_new_status not in ('approved', 'rejected', 'in_progress', 'completed') then
    raise exception 'Unknown status %', p_new_status using errcode = '22023';
  end if;

  if not (
    (v_request.status = 'pending' and p_new_status in ('approved', 'rejected'))
    or (v_request.status = 'approved' and p_new_status = 'in_progress')
    or (v_request.status = 'in_progress' and p_new_status = 'completed')
  ) then
    raise exception 'Cannot move maintenance request from % to %', v_request.status, p_new_status using errcode = '22023';
  end if;

  v_old_status := v_request.status;

  update public.maintenance_requests
  set status = p_new_status
  where id = p_request_id
  returning * into v_request;

  if v_request.equipment_id is not null then
    if p_new_status = 'in_progress' then
      update public.equipment set status = 'maintenance' where id = v_request.equipment_id;
    elsif p_new_status in ('completed', 'rejected') then
      update public.equipment set status = 'available' where id = v_request.equipment_id and status = 'maintenance';
    end if;
  end if;

  if v_request.requester_id is not null then
    insert into public.notifications (profile_id, department_id, title, message, tone)
    values (
      v_request.requester_id,
      v_request.department_id,
      'Maintenance request ' || p_new_status,
      'Your maintenance request #' || v_request.id || ' was marked ' || replace(p_new_status, '_', ' ') || '.',
      case p_new_status
        when 'completed' then 'success'
        when 'rejected' then 'danger'
        else 'info'
      end
    );
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, description)
  values (
    p_actor_id,
    'maintenance_status_change',
    'maintenance_requests',
    v_request.id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status),
    'Maintenance request #' || v_request.id || ' moved from ' || v_old_status || ' to ' || p_new_status
  );

  return v_request;
end;
$$;

revoke all on function public.transition_maintenance_request(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.transition_maintenance_request(bigint, text, uuid) to service_role;

-- Status transitions now go exclusively through transition_maintenance_request(),
-- executed with elevated privilege from the maintenance-status edge function —
-- so direct client updates to maintenance_requests are no longer allowed.
-- Clients may still insert new requests and read what they're scoped to see.
drop policy if exists "maintenance write scoped" on public.maintenance_requests;

drop policy if exists "maintenance insert scoped" on public.maintenance_requests;
create policy "maintenance insert scoped"
on public.maintenance_requests
for insert
to authenticated
with check (requester_id = auth.uid() or public.is_department_admin() or public.is_super_admin());
