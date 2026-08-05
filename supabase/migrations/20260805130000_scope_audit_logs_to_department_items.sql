-- Department admins get a scoped "Item Logs" view (frontend: a dedicated
-- sidebar page, separate from the super-admin-only Audit Logs page). They may
-- only read equipment audit rows for their own department — never other
-- entity types, never another department's equipment, never department-less
-- (Supply Office) equipment. Scoped via the department_id captured inside
-- new_values/old_values rather than joining to equipment, since audit_logs
-- has no department_id column of its own and the equipment row referenced by
-- entity_id may since have been deleted.
drop policy if exists "audit logs admin only" on public.audit_logs;
create policy "audit logs scoped"
on public.audit_logs
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.is_department_admin()
    and entity_type = 'equipment'
    and coalesce(new_values->>'department_id', old_values->>'department_id') = public.current_user_department_id()::text
  )
);
