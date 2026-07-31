-- Keep cancelled requests in the borrowing history instead of deleting them.
--
-- The cancel action removed the row outright, so a withdrawn request left no
-- trace anywhere a user can see — only an audit_logs entry, which is super-admin
-- only. That contradicts the requirement that every borrowing transaction stay
-- in the history: a rejected request is retained (status 'rejected') but a
-- cancelled one disappeared, and with it the record that someone had reserved
-- that item at all.
--
-- 'cancelled' is a terminal, non-holding status: it is absent from
-- is_active_borrow_status(), so a pending -> cancelled transition moves no stock
-- (a pending request never held any), and it is absent from the overdue sweep
-- and the "still out" filters. The duplicate-request guard keys off
-- status = 'pending', so a cancelled row does not block re-requesting the item.

alter table public.borrow_records drop constraint if exists borrow_records_status_check;
alter table public.borrow_records add constraint borrow_records_status_check
  check (status in ('pending', 'confirmed', 'rejected', 'borrowed', 'return_requested', 'returned', 'overdue', 'cancelled'));
