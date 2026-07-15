-- Production hardening: fix the notifications "mark as read" RLS gap, add a
-- full audit trail for direct table writes, and index hot foreign-key / filter
-- columns.

-- 1. Notifications could never be marked read -------------------------------
-- notifications had a SELECT policy but no UPDATE policy, so the client's
-- "mark as read" update matched zero rows under RLS and silently reverted.
-- Allow a user to update notifications they are already scoped to see (their
-- own, or their department's).
drop policy if exists "notifications update scoped" on public.notifications;
create policy "notifications update scoped"
on public.notifications
for update
to authenticated
using (
  profile_id = auth.uid()
  or department_id = public.current_user_department_id()
  or public.is_super_admin()
)
with check (
  profile_id = auth.uid()
  or department_id = public.current_user_department_id()
  or public.is_super_admin()
);

-- 2. Audit trail for direct table writes ------------------------------------
-- The borrow/maintenance status functions already log to audit_logs. This adds
-- the same coverage for catalog, asset, facility, department, and account
-- writes, so the Audit Logs page reflects every change. entity_id holds the
-- numeric id when the table has one; uuid-keyed rows keep their id inside the
-- captured JSON. Runs as SECURITY DEFINER so it can write audit_logs.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  v_id text := coalesce(v_new->>'id', v_old->>'id');
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, description)
  values (
    auth.uid(),
    lower(tg_op) || '_' || tg_table_name,
    tg_table_name,
    case when v_id ~ '^[0-9]+$' then v_id::bigint else null end,
    v_old,
    v_new,
    initcap(lower(tg_op)) || ' on ' || tg_table_name || coalesce(' #' || v_id, '')
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Full insert/update/delete auditing on the management tables.
drop trigger if exists trg_audit_equipment on public.equipment;
create trigger trg_audit_equipment after insert or update or delete on public.equipment
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_facilities on public.facilities;
create trigger trg_audit_facilities after insert or update or delete on public.facilities
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_departments on public.departments;
create trigger trg_audit_departments after insert or update or delete on public.departments
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_categories on public.categories;
create trigger trg_audit_categories after insert or update or delete on public.categories
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_suppliers on public.suppliers;
create trigger trg_audit_suppliers after insert or update or delete on public.suppliers
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles after insert or update or delete on public.profiles
for each row execute function public.audit_row_change();

-- Insert-only for borrow/maintenance: their status changes are already logged
-- by the transition functions, so we only capture creation events here.
drop trigger if exists trg_audit_borrow_insert on public.borrow_records;
create trigger trg_audit_borrow_insert after insert on public.borrow_records
for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_maintenance_insert on public.maintenance_requests;
create trigger trg_audit_maintenance_insert after insert on public.maintenance_requests
for each row execute function public.audit_row_change();

-- 3. Indexes on foreign keys and hot filter columns -------------------------
create index if not exists idx_profiles_department on public.profiles(department_id);
create index if not exists idx_facilities_department on public.facilities(department_id);
create index if not exists idx_equipment_department on public.equipment(department_id);
create index if not exists idx_equipment_facility on public.equipment(facility_id);
create index if not exists idx_equipment_status on public.equipment(status);
create index if not exists idx_equipment_category on public.equipment(category_id);
create index if not exists idx_equipment_supplier on public.equipment(supplier_id);
create index if not exists idx_borrow_equipment on public.borrow_records(equipment_id);
create index if not exists idx_borrow_borrower on public.borrow_records(borrower_id);
create index if not exists idx_borrow_department on public.borrow_records(department_id);
create index if not exists idx_borrow_status on public.borrow_records(status);
create index if not exists idx_maintenance_equipment on public.maintenance_requests(equipment_id);
create index if not exists idx_maintenance_department on public.maintenance_requests(department_id);
create index if not exists idx_maintenance_requester on public.maintenance_requests(requester_id);
create index if not exists idx_maintenance_status on public.maintenance_requests(status);
create index if not exists idx_notifications_profile on public.notifications(profile_id);
create index if not exists idx_notifications_department on public.notifications(department_id);
create index if not exists idx_audit_actor on public.audit_logs(actor_id);
create index if not exists idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);
create index if not exists idx_login_logs_profile on public.login_logs(profile_id);
