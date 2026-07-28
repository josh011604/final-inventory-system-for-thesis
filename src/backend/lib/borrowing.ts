// Pure borrow-availability rules shared by the Borrowing screen and the
// Inventory screen's per-item Borrow button, so both agree on exactly which
// items can be requested and how many units are still free.
//
// The authoritative check still lives in the borrow-status edge function; this
// is the client-side mirror that drives what the UI offers.

export type BorrowRecordLike = { equipment_id: number; status: string }
export type BorrowableItem = { id: number; quantity: number | null; status: string }

// A request in any of these states is holding a physical unit. 'pending' is
// deliberately excluded: it has not been approved, so it reserves nothing.
export const ACTIVE_BORROW_STATUSES = new Set(['confirmed', 'borrowed', 'return_requested', 'overdue'])

export function unitsOutByEquipmentId(records: readonly BorrowRecordLike[]): Map<number, number> {
	const counts = new Map<number, number>()
	for (const record of records) {
		if (ACTIVE_BORROW_STATUSES.has(record.status)) {
			counts.set(record.equipment_id, (counts.get(record.equipment_id) ?? 0) + 1)
		}
	}
	return counts
}

export function freeUnits(item: BorrowableItem, unitsOut: ReadonlyMap<number, number>): number {
	return Math.max((item.quantity ?? 1) - (unitsOut.get(item.id) ?? 0), 0)
}

// Statuses that take an item out of service entirely: no unit can be borrowed
// no matter how much stock is on hand. 'available' and 'borrowed' are absent on
// purpose — for multi-unit stock 'borrowed' only means *some* units are out, so
// the item stays borrowable as long as free units remain.
export const OUT_OF_SERVICE_STATUSES = new Set(['maintenance', 'damaged', 'lost', 'disposed'])

// An item is borrowable when it is in service and at least one unit is free.
export function isBorrowable(item: BorrowableItem, unitsOut: ReadonlyMap<number, number>): boolean {
	return !OUT_OF_SERVICE_STATUSES.has(item.status) && freeUnits(item, unitsOut) > 0
}

// Why a given item cannot be borrowed right now — null when it can be.
export function borrowBlockedReason(item: BorrowableItem, unitsOut: ReadonlyMap<number, number>): string | null {
	if (OUT_OF_SERVICE_STATUSES.has(item.status)) return `This item is marked ${item.status.replace('_', ' ')}.`
	if (freeUnits(item, unitsOut) === 0) {
		// A zero stock and a fully-loaned-out stock both leave no free units,
		// but the reason the button is disabled is different for each.
		return (item.quantity ?? 1) === 0 ? 'This item is out of stock.' : 'Every unit of this item is currently out on loan.'
	}
	return null
}

// The status to show in the Inventory list. Availability is driven by free units,
// not the coarse equipment status: an item with stock left reads 'available' even
// while some of its units are out on loan, and only reads 'unavailable' once every
// unit is gone. Out-of-service statuses (maintenance, damaged…) are shown as-is.
export function displayStatus(item: BorrowableItem, unitsOut: ReadonlyMap<number, number>): string {
	if (OUT_OF_SERVICE_STATUSES.has(item.status)) return item.status
	return freeUnits(item, unitsOut) === 0 ? 'unavailable' : 'available'
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

// Mirrors the enforce_borrow_department_scope database trigger
// (20260719130000) so the UI never offers a request the server will reject.
// A department-less item is the central Supply Office pool, open to everyone
// except students; anything else must match the borrower's own department.
export function borrowScopeReason(item: ScopedItem, borrower: Borrower): string | null {
	if (item.department_id === null) {
		return borrower.role === 'student' ? 'Students can only request items from their own department.' : null
	}
	if (item.department_id !== borrower.departmentId) {
		return 'You can only request items from your own department.'
	}
	return null
}
