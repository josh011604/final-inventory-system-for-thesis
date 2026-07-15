-- Backend guard: a borrow request's expected return date may not be in the
-- past. Enforced on INSERT only, so status transitions (which never change the
-- date) can still process items that later became overdue. A CHECK constraint
-- can't be used here because current_date is not immutable.

create or replace function public.enforce_borrow_return_not_past()
returns trigger
language plpgsql
as $$
begin
  if new.expected_return_date is not null and new.expected_return_date::date < current_date then
    raise exception 'Expected return date cannot be in the past' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_borrow_return_not_past on public.borrow_records;
create trigger trg_borrow_return_not_past
before insert on public.borrow_records
for each row execute function public.enforce_borrow_return_not_past();
