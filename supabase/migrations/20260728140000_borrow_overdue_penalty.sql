-- Overdue-borrow penalty: a member who is still holding an item past its return
-- date cannot borrow anything else until they return it. This is enforced at the
-- database layer so it holds no matter which path inserts the request (the
-- borrow-status edge function, the auto-approve path, or a direct table insert).
--
-- Scope: applies to department admins, faculty (role 'staff'), and students. The
-- super admin is exempt. Mirrors borrowPenaltyReason() in
-- src/backend/lib/borrowing.ts, which greys out the UI for the same reason.
--
-- "Overdue" here matches the app's rule everywhere else: a record explicitly
-- flagged 'overdue', OR one that is still out (confirmed/borrowed/
-- return_requested) and past its expected_return_date. The hourly sweep only
-- flips the status periodically, so the past-due comparison closes the gap.

create or replace function public.enforce_borrow_overdue_penalty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_has_overdue boolean;
begin
  select role into v_role from public.profiles where id = new.borrower_id;

  -- The super admin is exempt from the penalty.
  if v_role = 'super_admin' then
    return new;
  end if;

  select exists (
    select 1
    from public.borrow_records
    where borrower_id = new.borrower_id
      and (
        status = 'overdue'
        or (
          status in ('confirmed', 'borrowed', 'return_requested')
          and expected_return_date is not null
          and expected_return_date < now()
        )
      )
  ) into v_has_overdue;

  if v_has_overdue then
    raise exception 'You have an overdue borrowed item. Return it before borrowing again.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_borrow_overdue_penalty on public.borrow_records;
create trigger trg_borrow_overdue_penalty
before insert on public.borrow_records
for each row execute function public.enforce_borrow_overdue_penalty();
