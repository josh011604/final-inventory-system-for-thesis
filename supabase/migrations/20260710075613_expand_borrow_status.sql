-- borrow_records.status was missing 'rejected', unlike maintenance_requests
-- (which already allows 'approved'/'rejected'). The spec requires dept admins
-- to be able to reject a borrow request, not just confirm/return it.
alter table public.borrow_records drop constraint if exists borrow_records_status_check;
alter table public.borrow_records add constraint borrow_records_status_check
  check (status in ('pending', 'confirmed', 'rejected', 'borrowed', 'return_requested', 'returned', 'overdue'));
