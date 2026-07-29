import { describe, expect, it } from 'vitest'
import { borrowBlockedReason, borrowPenaltyReason, borrowScopeReason, canApproveBorrow, canReturnBorrow, displayStatus, freeUnits, isBorrowable, isBorrowOverdue, isSelfBorrowRequest, unitsOutByEquipmentId } from '@/backend/lib/borrowing'

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

describe('freeUnits', () => {
	it('subtracts the units already out', () => {
		expect(freeUnits(item({ quantity: 3 }), new Map([[1, 2]]))).toBe(1)
	})

	it('treats a null quantity as a single unit', () => {
		expect(freeUnits(item({ quantity: null }), new Map())).toBe(1)
		expect(freeUnits(item({ quantity: null }), new Map([[1, 1]]))).toBe(0)
	})

	it('never goes negative when more are out than the recorded quantity', () => {
		expect(freeUnits(item({ quantity: 1 }), new Map([[1, 3]]))).toBe(0)
	})

	it('is unaffected by counts for other items', () => {
		expect(freeUnits(item({ id: 1, quantity: 2 }), new Map([[99, 5]]))).toBe(2)
	})
})

describe('isBorrowable / borrowBlockedReason', () => {
	it('allows an available item with a free unit', () => {
		expect(isBorrowable(item(), new Map())).toBe(true)
		expect(borrowBlockedReason(item(), new Map())).toBeNull()
	})

	it('blocks an item whose units are all out', () => {
		const unitsOut = new Map([[1, 3]])
		expect(isBorrowable(item({ quantity: 3 }), unitsOut)).toBe(false)
		expect(borrowBlockedReason(item({ quantity: 3 }), unitsOut)).toMatch(/currently out on loan/i)
	})

	it.each(['maintenance', 'damaged', 'lost', 'disposed'])('blocks an out-of-service item marked %s', (status) => {
		expect(isBorrowable(item({ status }), new Map())).toBe(false)
		expect(borrowBlockedReason(item({ status }), new Map())).toContain(status)
	})

	it('keeps a partly-loaned item borrowable while stock remains', () => {
		// 3 in stock, 1 already out → 2 free, so it can still be borrowed even
		// though the coarse equipment status may read 'borrowed'.
		const unitsOut = new Map([[1, 1]])
		expect(isBorrowable(item({ quantity: 3, status: 'borrowed' }), unitsOut)).toBe(true)
		expect(borrowBlockedReason(item({ quantity: 3, status: 'borrowed' }), unitsOut)).toBeNull()
	})

	it('blocks an out-of-stock item and says so', () => {
		expect(isBorrowable(item({ quantity: 0 }), new Map())).toBe(false)
		expect(borrowBlockedReason(item({ quantity: 0 }), new Map())).toMatch(/out of stock/i)
	})
})

describe('displayStatus', () => {
	it('keeps the raw status when a unit is free', () => {
		expect(displayStatus(item({ quantity: 3 }), new Map([[1, 1]]))).toBe('available')
	})

	it('reports an available item with zero stock as unavailable', () => {
		expect(displayStatus(item({ quantity: 0 }), new Map())).toBe('unavailable')
	})

	it('reports an available item with every unit out on loan as unavailable', () => {
		expect(displayStatus(item({ quantity: 2 }), new Map([[1, 2]]))).toBe('unavailable')
	})

	it('still reads available when only some units are out on loan', () => {
		// 3 in stock, 2 out → 1 free; a 'borrowed' equipment status must not hide
		// that there is still stock to lend.
		expect(displayStatus(item({ quantity: 3, status: 'borrowed' }), new Map([[1, 2]]))).toBe('available')
	})

	it.each(['maintenance', 'damaged', 'lost', 'disposed'])('passes an out-of-service status through untouched (%s)', (status) => {
		expect(displayStatus(item({ status }), new Map())).toBe(status)
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
		expect(borrowScopeReason(supplyItem, { role: 'student', departmentId: DEPT_A })).toMatch(/students can only request/i)
	})

	it('blocks a student from another department’s stock', () => {
		expect(borrowScopeReason({ department_id: DEPT_B }, { role: 'student', departmentId: DEPT_A })).toMatch(/students can only request/i)
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
