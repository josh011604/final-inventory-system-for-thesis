-- Attribute service-role writes to the person they were made for.
--
-- audit_row_change() stamps every audited row with auth.uid(). That is correct
-- for ordinary client writes, but it is NULL whenever a row is written with the
-- service-role key, and the audit entry then shows no actor at all ("System").
--
-- This bites the auto-approved borrow path. A department admin borrowing their
-- own department's item (or a super admin taking a Supply Office item) skips
-- the pending step, so the borrow-status edge function has to insert the record
-- with the service-role client — the "borrow insert scoped" policy pins every
-- client insert to status 'pending', so the caller's own JWT cannot create a
-- row that is already 'confirmed'. The result was that the borrow the admin
-- approved for themselves was logged against nobody, even though the record's
-- own approved_by column named them correctly.
--
-- The fix is to fall back to the row's own record of who it belongs to:
-- created_by, then requester_id, then borrower_id. Every one of those is a
-- profiles(id), the same thing actor_id holds. When auth.uid() is present it
-- still wins, so no ordinary client write changes attribution.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else null end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else null end;
  v_row jsonb := coalesce(v_new, v_old);
  v_id text := coalesce(v_new->>'id', v_old->>'id');
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, description)
  values (
    -- auth.uid() first: a normal client write is always attributed to the
    -- signed-in user. The fallbacks only apply to service-role writes, which
    -- would otherwise be recorded with no actor.
    coalesce(
      auth.uid(),
      nullif(v_row->>'created_by', '')::uuid,
      nullif(v_row->>'requester_id', '')::uuid,
      nullif(v_row->>'borrower_id', '')::uuid
    ),
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
