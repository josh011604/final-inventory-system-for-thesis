import { describe, expect, it } from 'vitest'
import { borrowBlockedReason, borrowPenaltyReason, borrowScopeReason, canApproveBorrow, canReturnBorrow, displayStatus, freeUnits, isBorrowable, isBorrowOverdue, isLowStock, isSelfBorrowRequest, totalUnits, unitsOutByEquipmentId } from '@/backend/lib/borrowing'

const item = (overrides: Partial<{ id: number; quantity: number | null; status: string }> = {}) => ({
	id: 1,
	quantity: 3,
	status: 'available',
	...overrides,
})

describe('unitsOutByEquipmentId', () => {
	it('counts only records that are holding a physical unit', () => {
		const counts = unitsOutByEquipmentId([
			{ equipment_id: 1, status: 'confirmed' },
			{ equipment_id: 1, status: 'borrowed' },
			{ equipment_id: 1, status: 'overdue' },
			{ equipment_id: 1, status: 'return_requested' },
			// These release (or never held) the unit:
			{ equipment_id: 1, status: 'pending' },
			{ equipment_id: 1, status: 'returned' },
			{ equipment_id: 1, status: 'rejected' },
		])
		expect(counts.get(1)).toBe(4)
	})

	it('does not count a pending request, which reserves nothing until approved', () => {
		expect(unitsOutByEquipmentId([{ equipment_id: 7, status: 'pending' }]).get(7)).toBeUndefined()
	})

	it('keeps each item separate', () => {
		const counts = unitsOutByEquipmentId([
			{ equipment_id: 1, status: 'borrowed' },
			{ equipment_id: 2, status: 'borrowed' },
			{ equipment_id: 2, status: 'overdue' },
		])
		expect(counts.get(1)).toBe(1)
		expect(counts.get(2)).toBe(2)
	})
})

// equipment.quantity is the ON-HAND stock: the database already subtracted every
// approved borrow's units from it, so freeUnits reads it directly and must NOT
// subtract the units-out map a second time.
describe('freeUnits', () => {
	it('reads the on-hand quantity without deducting units out again', () => {
		expect(freeUnits(item({ quantity: 3 }))).toBe(3)
	})

	it('treats a missing quantity as no stock', () => {
		expect(freeUnits(item({ quantity: null }))).toBe(0)
	})

	it('never goes negative', () => {
		expect(freeUnits(item({ quantity: -2 }))).toBe(0)
	})
})

describe('totalUnits', () => {
	it('adds the units out on loan back onto the on-hand stock', () => {
		// 7 left on the shelf + 3 out on loan = the item's original 10.
		expect(totalUnits(item({ quantity: 7 }), new Map([[1, 3]]))).toBe(10)
	})

	it('equals the on-hand stock when nothing is out', () => {
		expect(totalUnits(item({ quantity: 4 }), new Map())).toBe(4)
	})

	it('is unaffected by counts for other items', () => {
		expect(totalUnits(item({ id: 1, quantity: 2 }), new Map([[99, 5]]))).toBe(2)
	})
})

describe('isBorrowable / borrowBlockedReason', () => {
	it('allows an available item with stock on hand', () => {
		expect(isBorrowable(item())).toBe(true)
		expect(borrowBlockedReason(item(), new Map())).toBeNull()
	})

	it('blocks an item whose stock is all out on loan', () => {
		// Nothing on the shelf, 3 units out → they are coming back.
		const unitsOut = new Map([[1, 3]])
		expect(isBorrowable(item({ quantity: 0 }))).toBe(false)
		expect(borrowBlockedReason(item({ quantity: 0 }), unitsOut)).toMatch(/currently out on loan/i)
	})

	it.each(['maintenance', 'damaged', 'lost', 'disposed'])('blocks an out-of-service item marked %s', (status) => {
		expect(isBorrowable(item({ status }))).toBe(false)
		expect(borrowBlockedReason(item({ status }), new Map())).toContain(status)
	})

	it('keeps a partly-loaned item borrowable while stock remains', () => {
		// 2 left on the shelf, 1 out; the coarse equipment status may still read
		// 'borrowed' from an earlier full loan-out, which must not block it.
		expect(isBorrowable(item({ quantity: 2, status: 'borrowed' }))).toBe(true)
		expect(borrowBlockedReason(item({ quantity: 2, status: 'borrowed' }), new Map([[1, 1]]))).toBeNull()
	})

	it('blocks an out-of-stock item and says so', () => {
		// Nothing on the shelf and nothing out on loan → there is none to lend.
		expect(isBorrowable(item({ quantity: 0 }))).toBe(false)
		expect(borrowBlockedReason(item({ quantity: 0 }), new Map())).toMatch(/out of stock/i)
	})
})

describe('isLowStock', () => {
	it('flags an item down to its last units', () => {
		// 1 left on hand of an original 10 → 10% remaining, under the 20% mark.
		expect(isLowStock(item({ quantity: 1 }), new Map([[1, 9]]))).toBe(true)
	})

	it('does not flag an item still comfortably stocked', () => {
		expect(isLowStock(item({ quantity: 8 }), new Map([[1, 2]]))).toBe(false)
	})

	it('does not flag an empty shelf — that is unavailable, not low', () => {
		expect(isLowStock(item({ quantity: 0 }), new Map([[1, 10]]))).toBe(false)
	})

	it('does not flag a fully-stocked item', () => {
		expect(isLowStock(item({ quantity: 10 }), new Map())).toBe(false)
	})
})

describe('displayStatus', () => {
	it('reads available while any unit is on hand', () => {
		expect(displayStatus(item({ quantity: 3 }))).toBe('available')
	})

	it('reports an item with an empty shelf as unavailable', () => {
		expect(displayStatus(item({ quantity: 0 }))).toBe('unavailable')
	})

	it('still reads available when only some units are out on loan', () => {
		// 1 left in stock; a stale 'borrowed' equipment status must not hide that
		// there is still something to lend.
		expect(displayStatus(item({ quantity: 1, status: 'borrowed' }))).toBe('available')
	})

	it.each(['maintenance', 'damaged', 'lost', 'disposed'])('passes an out-of-service status through untouched (%s)', (status) => {
		expect(displayStatus(item({ status }))).toBe(status)
	})
})

// These must stay in lockstep with the enforce_borrow_department_scope trigger
// in supabase/migrations/20260728130000; if they drift, the UI offers requests
// the database will reject. Only students are department-locked now.
describe('borrowScopeReason', () => {
	const DEPT_A = 'aaaaaaaa-0000-0000-0000-000000000000'
	const DEPT_B = 'bbbbbbbb-0000-0000-0000-000000000000'
	const supplyItem = { department_id: null }

	it('allows an item from the borrower’s own department', () => {
		expect(borrowScopeReason({ department_id: DEPT_A }, { role: 'staff', departmentId: DEPT_A })).toBeNull()
	})

	it('lets faculty request another department’s item (approval routed to that department)', () => {
		expect(borrowScopeReason({ department_id: DEPT_B }, { role: 'staff', departmentId: DEPT_A })).toBeNull()
	})

	it.each(['staff', 'department_admin', 'super_admin'])('lets a %s request Supply Office items', (role) => {
		expect(borrowScopeReason(supplyItem, { role, departmentId: DEPT_A })).toBeNull()
	})

	it('keeps students out of the Supply Office pool', () => {
		expect(borrowScopeReason(supplyItem, { role: 'student', departmentId: DEPT_A })).toMatch(/supply office/i)
	})

	// Students may request another department's stock; it is routed to that
	// department for approval. The Supply Office is the only thing they cannot
	// reach — see the Inventory screen (own department only) vs the New Request
	// picker (every department).
	it('lets a student request another department’s item', () => {
		expect(borrowScopeReason({ department_id: DEPT_B }, { role: 'student', departmentId: DEPT_A })).toBeNull()
	})

	it('lets a student request their own department’s item', () => {
		expect(borrowScopeReason({ department_id: DEPT_A }, { role: 'student', departmentId: DEPT_A })).toBeNull()
	})

	it('lets a super admin request department stock (routed to that department’s admin)', () => {
		expect(borrowScopeReason({ department_id: DEPT_A }, { role: 'super_admin', departmentId: null })).toBeNull()
	})
})

// Mirrors the authorization block in transition_borrow_record (migration
// 20260728130000): who may approve/return which requests.
describe('canApproveBorrow / canReturnBorrow', () => {
	const DEPT_A = 'aaaaaaaa-0000-0000-0000-000000000000'
	const DEPT_B = 'bbbbbbbb-0000-0000-0000-000000000000'
	const studentReq = { department_id: DEPT_A, borrower_id: 'stu', borrower_role: 'student' }
	const staffReq = { department_id: DEPT_A, borrower_id: 'fac', borrower_role: 'staff' }

	it('lets faculty approve a student request in their own department', () => {
		expect(canApproveBorrow(studentReq, { id: 'me', role: 'staff', departmentId: DEPT_A })).toBe(true)
	})

	it('does not let faculty approve a student request from another department', () => {
		expect(canApproveBorrow(studentReq, { id: 'me', role: 'staff', departmentId: DEPT_B })).toBe(false)
	})

	it('does not let faculty approve another faculty member’s request', () => {
		expect(canApproveBorrow(staffReq, { id: 'me', role: 'staff', departmentId: DEPT_A })).toBe(false)
	})

	it('lets a department admin approve their own department’s requests', () => {
		expect(canApproveBorrow(staffReq, { id: 'me', role: 'department_admin', departmentId: DEPT_A })).toBe(true)
		expect(canApproveBorrow(staffReq, { id: 'me', role: 'department_admin', departmentId: DEPT_B })).toBe(false)
	})

	it('never lets an approver approve their own request', () => {
		expect(canApproveBorrow({ ...staffReq, borrower_id: 'me' }, { id: 'me', role: 'department_admin', departmentId: DEPT_A })).toBe(false)
	})

	it('allows returning your own (auto-approved) borrow even though approving it is blocked', () => {
		const own = { department_id: DEPT_A, borrower_id: 'me', borrower_role: 'department_admin' }
		expect(canApproveBorrow(own, { id: 'me', role: 'department_admin', departmentId: DEPT_A })).toBe(false)
		expect(canReturnBorrow(own, { id: 'me', role: 'department_admin', departmentId: DEPT_A })).toBe(true)
	})

	it('gives students no approval authority', () => {
		expect(canApproveBorrow(studentReq, { id: 'me', role: 'student', departmentId: DEPT_A })).toBe(false)
	})

	// A Supply Office request carries department_id = null, which no department
	// admin's department can ever equal — so it lands with the super admin alone.
	// (Read RLS keeps it out of their Borrowing list entirely; this is the
	// second, independent guard.)
	describe('a Supply Office request', () => {
		const supplyReq = { department_id: null, borrower_id: 'fac', borrower_role: 'staff' }

		it('is approvable by the super admin', () => {
			expect(canApproveBorrow(supplyReq, { id: 'me', role: 'super_admin', departmentId: null })).toBe(true)
		})

		it('is not approvable by any department admin', () => {
			expect(canApproveBorrow(supplyReq, { id: 'me', role: 'department_admin', departmentId: DEPT_A })).toBe(false)
			expect(canApproveBorrow(supplyReq, { id: 'me', role: 'department_admin', departmentId: DEPT_B })).toBe(false)
		})

		it('is not approvable by faculty', () => {
			expect(canApproveBorrow(supplyReq, { id: 'me', role: 'staff', departmentId: DEPT_A })).toBe(false)
		})
	})

	// Faculty may borrow from a department they do not belong to; the request is
	// scoped to the ITEM's department, so it is that department's admin who
	// clears it — not the admin of the faculty member's own department.
	it('routes a cross-department faculty request to the item’s department admin', () => {
		const crossDeptReq = { department_id: DEPT_B, borrower_id: 'fac', borrower_role: 'staff' }
		expect(canApproveBorrow(crossDeptReq, { id: 'me', role: 'department_admin', departmentId: DEPT_B })).toBe(true)
		expect(canApproveBorrow(crossDeptReq, { id: 'me', role: 'department_admin', departmentId: DEPT_A })).toBe(false)
	})

	// Faculty authority is conditional on the borrower being a student, so an
	// unreadable borrower profile silently removes the Approve button. This is
	// why the role is denormalized onto borrow_records.borrower_role at write
	// time (migration 20260729180000) instead of joined from profiles, which RLS
	// hides — without it, faculty could never clear their department's student
	// requests.
	it('cannot judge faculty authority when the borrower’s role is unknown', () => {
		const unknownBorrower = { department_id: DEPT_A, borrower_id: 'stu', borrower_role: null }
		expect(canApproveBorrow(unknownBorrower, { id: 'me', role: 'staff', departmentId: DEPT_A })).toBe(false)
		// A department admin's authority does not depend on the borrower's role,
		// so their button is unaffected.
		expect(canApproveBorrow(unknownBorrower, { id: 'me', role: 'department_admin', departmentId: DEPT_A })).toBe(true)
	})
})

// Mirrors the self-approval guard added to transition_borrow_record; if these
// drift, the UI offers an approve/reject action the database will reject.
describe('isSelfBorrowRequest', () => {
	const ADMIN_ID = 'admin-0000-0000-0000-000000000000'
	const OTHER_ID = 'other-0000-0000-0000-000000000000'

	it('flags a request where the approver is also the borrower', () => {
		expect(isSelfBorrowRequest({ borrower_id: ADMIN_ID }, ADMIN_ID)).toBe(true)
	})

	it('allows a request from someone else', () => {
		expect(isSelfBorrowRequest({ borrower_id: OTHER_ID }, ADMIN_ID)).toBe(false)
	})

	it('allows a request with no recorded borrower', () => {
		expect(isSelfBorrowRequest({ borrower_id: null }, ADMIN_ID)).toBe(false)
	})
})

// Mirrors enforce_borrow_overdue_penalty (migration 20260728140000): a member
// holding an overdue item is blocked from borrowing until they return it.
describe('isBorrowOverdue / borrowPenaltyReason', () => {
	const NOW = new Date('2026-07-29T00:00:00Z').getTime()
	const PAST = '2026-07-20T00:00:00Z'
	const FUTURE = '2026-08-10T00:00:00Z'
	const ME = 'me-0000'
	const OTHER = 'other-0000'

	it('treats an explicitly flagged record as overdue', () => {
		expect(isBorrowOverdue({ status: 'overdue', expected_return_date: FUTURE }, NOW)).toBe(true)
	})

	it('treats a still-out record past its due date as overdue', () => {
		expect(isBorrowOverdue({ status: 'borrowed', expected_return_date: PAST }, NOW)).toBe(true)
		expect(isBorrowOverdue({ status: 'confirmed', expected_return_date: FUTURE }, NOW)).toBe(false)
	})

	it('does not treat a returned or pending record as overdue', () => {
		expect(isBorrowOverdue({ status: 'returned', expected_return_date: PAST }, NOW)).toBe(false)
		expect(isBorrowOverdue({ status: 'pending', expected_return_date: PAST }, NOW)).toBe(false)
	})

	it('blocks a student/faculty/dept-admin who holds an overdue item', () => {
		const records = [{ borrower_id: ME, status: 'overdue', expected_return_date: FUTURE }]
		for (const role of ['student', 'staff', 'department_admin']) {
			expect(borrowPenaltyReason(records, { id: ME, role }, NOW)).toMatch(/overdue/i)
		}
	})

	it('exempts the super admin from the penalty', () => {
		const records = [{ borrower_id: ME, status: 'overdue', expected_return_date: FUTURE }]
		expect(borrowPenaltyReason(records, { id: ME, role: 'super_admin' }, NOW)).toBeNull()
	})

	it('only penalizes the user’s own overdue items', () => {
		const records = [{ borrower_id: OTHER, status: 'overdue', expected_return_date: FUTURE }]
		expect(borrowPenaltyReason(records, { id: ME, role: 'student' }, NOW)).toBeNull()
	})

	it('lets a clear user borrow', () => {
		const records = [{ borrower_id: ME, status: 'borrowed', expected_return_date: FUTURE }]
		expect(borrowPenaltyReason(records, { id: ME, role: 'staff' }, NOW)).toBeNull()
	})
})
