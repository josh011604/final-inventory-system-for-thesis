// Pure borrow-availability rules shared by the Borrowing screen and the
// Inventory screen's per-item Borrow button, so both agree on exactly which
// items can be requested and how many units are still free.
//
// The authoritative check still lives in the borrow-status edge function; this
// is the client-side mirror that drives what the UI offers.

// `quantity` is how many physical units this one request is for. It is optional
// here and defaults to 1 so older single-unit callers and test fixtures keep
// working unchanged.
export type BorrowRecordLike = { equipment_id: number; status: string; quantity?: number | null }
export type BorrowableItem = { id: number; quantity: number | null; status: string }

// A request in any of these states is holding a physical unit. 'pending' is
// deliberately excluded: it has not been approved, so it reserves nothing.
export const ACTIVE_BORROW_STATUSES = new Set(['confirmed', 'borrowed', 'return_requested', 'overdue'])

// Total units out per item — the SUM of each active request's quantity, not a
// row count, so a single multi-unit request removes as many units as it holds.
//
// NOTE: `equipment.quantity` is now decremented directly when a borrow is
// approved (see the sync_equipment_stock_on_borrow trigger), so this count is
// NOT what makes an item unavailable any more. It only exists to reconstruct
// the item's ORIGINAL stock for display ("3 of 10 left") and for the low-stock
// ratio, since the on-hand number alone can't say what "full" was.
export function unitsOutByEquipmentId(records: readonly BorrowRecordLike[]): Map<number, number> {
	const counts = new Map<number, number>()
	for (const record of records) {
		if (ACTIVE_BORROW_STATUSES.has(record.status)) {
			counts.set(record.equipment_id, (counts.get(record.equipment_id) ?? 0) + Math.max(record.quantity ?? 1, 1))
		}
	}
	return counts
}

// Units on the shelf right now. `equipment.quantity` IS the on-hand stock: the
// database subtracts the borrowed amount when a request is approved and adds it
// back on return, so nothing needs subtracting here.
export function freeUnits(item: BorrowableItem): number {
	return Math.max(item.quantity ?? 0, 0)
}

// The item's full stock — what is on the shelf plus what is out on loan. Only
// meaningful for display; the borrowed half is reconstructed from the borrow
// records the caller can see, so a user whose RLS hides other departments'
// requests may see a smaller total. Availability never depends on it.
export function totalUnits(item: BorrowableItem, unitsOut: ReadonlyMap<number, number>): number {
	return freeUnits(item) + (unitsOut.get(item.id) ?? 0)
}

// Statuses that take an item out of service entirely: no unit can be borrowed
// no matter how much stock is on hand. 'available' and 'borrowed' are absent on
// purpose — for multi-unit stock 'borrowed' only means *some* units are out, so
// the item stays borrowable as long as free units remain.
export const OUT_OF_SERVICE_STATUSES = new Set(['maintenance', 'damaged', 'lost', 'disposed'])

// An item is borrowable when it is in service and at least one unit is on hand.
export function isBorrowable(item: BorrowableItem): boolean {
	return !OUT_OF_SERVICE_STATUSES.has(item.status) && freeUnits(item) > 0
}

// Why a given item cannot be borrowed right now — null when it can be.
export function borrowBlockedReason(item: BorrowableItem, unitsOut: ReadonlyMap<number, number>): string | null {
	if (OUT_OF_SERVICE_STATUSES.has(item.status)) return `This item is marked ${item.status.replace('_', ' ')}.`
	if (freeUnits(item) === 0) {
		// Nothing on the shelf either way, but the reason differs: the stock is
		// out on loan (and will come back) or the item simply has none left.
		return (unitsOut.get(item.id) ?? 0) > 0 ? 'Every unit of this item is currently out on loan.' : 'This item is out of stock.'
	}
	return null
}

// Reorder point for the Inventory "low stock" warning. An item is low when it
// still has free units to lend but they have fallen to a small fraction of its
// total stock — a soft heads-up to restock, distinct from the hard 'unavailable'
// state (which is zero free units, handled by displayStatus/borrowBlockedReason).
export const LOW_STOCK_RATIO = 0.2

// True when an in-service item is running low: it has at least one free unit but
// no more than LOW_STOCK_RATIO of its total stock remains free. The `free < total`
// guard means a fully-stocked item never flags — including single-unit items,
// which are either fully available or already 'unavailable', never "low".
export function isLowStock(item: BorrowableItem, unitsOut: ReadonlyMap<number, number>): boolean {
	if (OUT_OF_SERVICE_STATUSES.has(item.status)) return false
	const total = totalUnits(item, unitsOut)
	const free = freeUnits(item)
	if (free === 0 || free >= total) return false
	return free <= Math.max(1, Math.floor(total * LOW_STOCK_RATIO))
}

// The status to show in the Inventory list. Availability is driven by on-hand
// stock, not the coarse equipment status: an item with stock left reads
// 'available' even while some of its units are out on loan, and only reads
// 'unavailable' once the shelf is empty. Out-of-service statuses (maintenance,
// damaged…) are shown as-is.
export function displayStatus(item: BorrowableItem): string {
	if (OUT_OF_SERVICE_STATUSES.has(item.status)) return item.status
	return freeUnits(item) === 0 ? 'unavailable' : 'available'
}

export type ScopedItem = { department_id: string | null }
export type Borrower = { role: string; departmentId: string | null }

export type ApprovableRecord = { borrower_id: string | null }

// An approver (department admin or super admin) must never be the same person
// as the borrower — otherwise they could rubber-stamp their own request,
// defeating the entire point of requiring approval. Mirrors a matching guard
// in the transition_borrow_record SQL function.
export function isSelfBorrowRequest(record: ApprovableRecord, actorId: string): boolean {
	return record.borrower_id === actorId
}

// Mirrors the enforce_borrow_department_scope database trigger so the UI never
// offers a request the server will reject. Every role may request any
// DEPARTMENT's items — a cross-department request is routed to that item's
// department admin. The one remaining restriction is that STUDENTS may not
// request from the central Supply Office pool (items with no department), which
// stays super-admin business.
export function borrowScopeReason(item: ScopedItem, borrower: Borrower): string | null {
	if (borrower.role !== 'student') return null
	if (item.department_id === null) {
		return 'Students cannot request Supply Office items.'
	}
	return null
}

// Who may approve/reject/return a given borrow request — the client mirror of
// the authorization block in transition_borrow_record(). An approver may never
// act on their own request. Beyond that:
//   * super admin  — any request;
//   * department admin — any request scoped to their own department;
//   * staff/faculty — only a STUDENT's request scoped to their own department
//     (so a faculty member can clear student borrows for items in their dept,
//     but faculty and admin requests still need an admin).
export type ApprovableBorrow = { department_id: string | null; borrower_id: string | null; borrower_role: string | null }
export type BorrowApprover = { id: string; role: string; departmentId: string | null }

// Does this actor have authority over this record at all, ignoring the
// self-approval rule? This is the role-and-department scope shared by both
// approving and returning.
export function hasBorrowAuthority(record: ApprovableBorrow, actor: BorrowApprover): boolean {
	if (actor.role === 'super_admin') return true
	if (actor.role === 'department_admin') return record.department_id === actor.departmentId
	if (actor.role === 'staff') return record.borrower_role === 'student' && record.department_id === actor.departmentId
	return false
}

// Approve / reject: authority AND not the actor's own request (an approver may
// never rubber-stamp themselves — matches transition_borrow_record).
export function canApproveBorrow(record: ApprovableBorrow, actor: BorrowApprover): boolean {
	return record.borrower_id !== actor.id && hasBorrowAuthority(record, actor)
}

// Mark returned: authority is enough — returning your own (auto-approved) borrow
// is allowed, so there is no self-block here.
export function canReturnBorrow(record: ApprovableBorrow, actor: BorrowApprover): boolean {
	return hasBorrowAuthority(record, actor)
}

// ---------- Overdue-borrow penalty ----------
// A member holding an item past its return date is barred from borrowing
// anything else until they return it. The super admin is exempt; the rule
// applies to department admins, faculty (staff), and students.

const STILL_OUT_STATUSES = new Set(['confirmed', 'borrowed', 'return_requested'])

// A borrow is overdue when it has been explicitly flagged, or it is still out
// and past its expected return date. Mirrors the rule used on the dashboard and
// in Reports (the hourly sweep only flips the status periodically, so the
// past-due computation catches the gap in between).
export function isBorrowOverdue(record: { status: string; expected_return_date?: string | null }, now: number = Date.now()): boolean {
	if (record.status === 'overdue') return true
	if (!record.expected_return_date) return false
	return STILL_OUT_STATUSES.has(record.status) && new Date(record.expected_return_date).getTime() < now
}

// Roles the overdue penalty applies to. The super admin is intentionally absent.
export const OVERDUE_PENALTY_ROLES = new Set(['department_admin', 'staff', 'student'])

export type OverdueRecord = { borrower_id: string | null; status: string; expected_return_date?: string | null }

// True when this user personally holds at least one overdue item.
export function hasBlockingOverdue(records: readonly OverdueRecord[], userId: string, now: number = Date.now()): boolean {
	return records.some((record) => record.borrower_id === userId && isBorrowOverdue(record, now))
}

// Why a user is barred from borrowing right now under the overdue penalty —
// null when they are clear or exempt. Mirrors the enforce_borrow_overdue_penalty
// database trigger so the UI never offers a request the server will reject.
export function borrowPenaltyReason(records: readonly OverdueRecord[], user: { id: string; role: string }, now: number = Date.now()): string | null {
	if (!OVERDUE_PENALTY_ROLES.has(user.role)) return null
	return hasBlockingOverdue(records, user.id, now)
		? 'You have an overdue item that must be returned before you can borrow again.'
		: null
}
