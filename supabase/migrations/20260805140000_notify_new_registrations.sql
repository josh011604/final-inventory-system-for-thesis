-- notify_profile_change only fired on UPDATE, so registration (the INSERT
-- that creates a profiles row — either self-registration via handle_new_user,
-- landing as status='inactive' pending approval, or an admin creating an
-- account outright via the create-student edge function, landing straight at
-- status='active') never produced a notification for anyone. Extend the same
-- function to also handle INSERT, and widen its trigger to fire on both.
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
  if tg_op = 'INSERT' then
    if new.status = 'inactive' then
      -- Self-registered, awaiting an admin's approval. Route like every other
      -- "needs an approver" alert in this app: profile_id null + department_id
      -- set reaches that department's admin (notify_facility_reservation does
      -- the same); a department-less signup goes to every active super admin
      -- individually instead, since the null-profile_id RLS branch requires a
      -- non-null department_id.
      if new.department_id is not null then
        insert into public.notifications (department_id, title, message, tone)
        values (
          new.department_id,
          'New registration awaiting approval',
          new.full_name || ' registered as ' || new.role || ' and is awaiting account activation.',
          'info'
        );
      else
        insert into public.notifications (profile_id, title, message, tone)
        select id, 'New registration awaiting approval',
          new.full_name || ' registered as ' || new.role || ' and is awaiting account activation.',
          'info'
        from public.profiles
        where role = 'super_admin' and status = 'active';
      end if;
    else
      -- Admin-created and already active (create-student) — no approval step,
      -- so welcome the new user instead of alerting anyone to approve them.
      insert into public.notifications (profile_id, title, message, tone)
      values (
        new.id,
        'Welcome to the system',
        'Your account has been created. You can now sign in and use the system.',
        'success'
      );
    end if;
    return new;
  end if;

  -- tg_op = 'UPDATE' — unchanged from the existing function.
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
after insert or update on public.profiles
for each row execute function public.notify_profile_change();
