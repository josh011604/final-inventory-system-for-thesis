-- Security bug: "borrow insert scoped" checked only who could insert
-- (borrower_id = auth.uid(), or an admin), never what status the new row could
-- have. Every real request rule - unit availability, the borrow cap, the
-- duplicate-pending guard, the date window - lives only in the borrow-status
-- edge function, so any authenticated client could bypass all of it (and skip
-- approval entirely) by calling
--   supabase.from('borrow_records').insert({ ..., status: 'confirmed' })
-- directly instead of going through the edge function. The sibling
-- facility_reservations table already guards against exactly this
-- (20260722120000: "... and status = 'pending'"); borrow_records never got the
-- same fix. This closes that gap the same way.

drop policy if exists "borrow insert scoped" on public.borrow_records;
create policy "borrow insert scoped"
on public.borrow_records
for insert
to authenticated
with check (
  (borrower_id = auth.uid() or public.is_department_admin() or public.is_super_admin())
  and status = 'pending'
);
