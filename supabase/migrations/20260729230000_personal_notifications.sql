-- Notifications become personal: you see what happened to YOUR account, plus
-- what you personally have to act on.
--
-- The old policy was
--
--   profile_id = auth.uid()
--   or department_id = public.current_user_department_id()
--   or public.is_super_admin()
--
-- so the middle clause handed every member of a department the whole
-- department's notification feed — a faculty member read the department admin's
-- approval queue, and students read both — while the last clause gave the super
-- admin every notification in the system, for every user. The inbox was
-- effectively shared.
--
-- What the rows actually mean:
--   * profile_id set        — addressed to that one person (borrow approved,
--                             item returned, overdue, account changes).
--   * profile_id null +
--     department_id set     — "a request in this department needs an approver",
--                             raised by notify_facility_reservation.
--
-- So the rule below is: your own rows always, plus the department's unaddressed
-- approval alerts only if you are that department's admin. Central (Supply
-- Office) approvals are already inserted per super admin with profile_id set, so
-- super admins keep receiving those through the first clause.

drop policy if exists "notifications scoped select" on public.notifications;
create policy "notifications scoped select"
on public.notifications
for select
to authenticated
using (
  profile_id = auth.uid()
  or (
    profile_id is null
    and department_id is not null
    and department_id = public.current_user_department_id()
    and public.current_user_role() = 'department_admin'
  )
);

-- Same reach for marking read, or a user could clear notifications that are not
-- theirs. This also makes the "mark all as read" mutation correct by
-- construction: it updates every unread row it can see, which is now only ever
-- the caller's own.
drop policy if exists "notifications update scoped" on public.notifications;
create policy "notifications update scoped"
on public.notifications
for update
to authenticated
using (
  profile_id = auth.uid()
  or (
    profile_id is null
    and department_id is not null
    and department_id = public.current_user_department_id()
    and public.current_user_role() = 'department_admin'
  )
)
with check (
  profile_id = auth.uid()
  or (
    profile_id is null
    and department_id is not null
    and department_id = public.current_user_department_id()
    and public.current_user_role() = 'department_admin'
  )
);

-- Account activity, so "what happened to my account" is in the same place as
-- the borrowing notifications rather than only in the super-admin audit log.
--
-- Only the listed columns raise a notification: profiles is also written by
-- background maintenance (the PII encryption backfill, updated_at touches), and
-- notifying on any change at all would turn those into a burst of noise for
-- every account at once.
create or replace function public.notify_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_message text;
  v_tone text := 'info';
begin
  if new.status is distinct from old.status then
    if new.status = 'active' then
      v_title := 'Account activated';
      v_message := 'Your account has been activated. You can now sign in and use the system.';
      v_tone := 'success';
    else
      v_title := 'Account deactivated';
      v_message := 'Your account has been deactivated. Contact an administrator if you believe this is a mistake.';
      v_tone := 'warning';
    end if;
  elsif new.role is distinct from old.role then
    v_title := 'Role changed';
    v_message := 'Your account role is now ' || new.role || '.';
  elsif new.department_id is distinct from old.department_id then
    v_title := 'Department changed';
    v_message := 'Your department assignment was updated.';
  elsif new.full_name is distinct from old.full_name
     or new.email is distinct from old.email
     or new.phone is distinct from old.phone
     or new.position is distinct from old.position
     or new.profile_picture_url is distinct from old.profile_picture_url then
    v_title := 'Profile updated';
    v_message := 'Your profile details were updated.';
  else
    return new;
  end if;

  insert into public.notifications (profile_id, department_id, title, message, tone)
  values (new.id, new.department_id, v_title, v_message, v_tone);

  return new;
end;
$$;

drop trigger if exists trg_notify_profile_change on public.profiles;
create trigger trg_notify_profile_change
after update on public.profiles
for each row execute function public.notify_profile_change();

-- A password lives in auth.users, which the app cannot trigger on, and clients
-- cannot insert notifications directly (there is no insert policy — every
-- notification comes from a definer function). This is the narrow way in: it
-- writes one fixed message, always for the caller, and takes no arguments, so
-- it cannot be used to write to anyone else or to forge content.
create or replace function public.notify_password_changed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.notifications (profile_id, title, message, tone)
  values (
    auth.uid(),
    'Password changed',
    'Your password was changed. If this was not you, contact an administrator immediately.',
    'warning'
  );
end;
$$;

revoke all on function public.notify_password_changed() from public, anon;
grant execute on function public.notify_password_changed() to authenticated;
