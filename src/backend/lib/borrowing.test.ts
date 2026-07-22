import { describe, expect, it } from 'vitest'
import { borrowBlockedReason, borrowScopeReason, freeUnits, isBorrowable, unitsOutByEquipmentId } from '@/backend/lib/borrowing'

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

	it.each(['maintenance', 'damaged', 'lost', 'disposed', 'borrowed'])('blocks an item marked %s', (status) => {
		expect(isBorrowable(item({ status }), new Map())).toBe(false)
		expect(borrowBlockedReason(item({ status }), new Map())).toContain(status)
	})
})

// These must stay in lockstep with the enforce_borrow_department_scope trigger
// in supabase/migrations/20260719130000; if they drift, the UI offers requests
// the database will reject.
describe('borrowScopeReason', () => {
	const DEPT_A = 'aaaaaaaa-0000-0000-0000-000000000000'
	const DEPT_B = 'bbbbbbbb-0000-0000-0000-000000000000'
	const supplyItem = { department_id: null }

	it('allows an item from the borrower’s own department', () => {
		expect(borrowScopeReason({ department_id: DEPT_A }, { role: 'staff', departmentId: DEPT_A })).toBeNull()
	})

	it('blocks an item belonging to another department', () => {
		expect(borrowScopeReason({ department_id: DEPT_B }, { role: 'staff', departmentId: DEPT_A })).toMatch(/your own department/i)
	})

	it.each(['staff', 'department_admin', 'super_admin'])('lets a %s request Supply Office items', (role) => {
		expect(borrowScopeReason(supplyItem, { role, departmentId: DEPT_A })).toBeNull()
	})

	it('keeps students out of the Supply Office pool', () => {
		expect(borrowScopeReason(supplyItem, { role: 'student', departmentId: DEPT_A })).toMatch(/students can only request/i)
	})

	it('blocks a super admin from department stock, since they have no department', () => {
		// The super admin's department is null, so the trigger's
		// "distinct from" comparison rejects every department-owned item.
		expect(borrowScopeReason({ department_id: DEPT_A }, { role: 'super_admin', departmentId: null })).toMatch(/your own department/i)
	})
})
