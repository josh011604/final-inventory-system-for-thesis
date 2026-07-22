import { describe, expect, it } from 'vitest'
import {
	activeBooking,
	facilityBookingsOn,
	facilityReserveBlockedReason,
	findReservationClash,
	reservationAutoApproves,
	toMinutes,
	validateReservation,
	windowsOverlap,
} from '@/backend/lib/reservations'
import type { ExistingReservation } from '@/backend/lib/reservations'

const TODAY = '2026-07-22'

// Postgres hands back 'HH:MM:SS'; the time input produces 'HH:MM'. Existing rows
// are written in the Postgres shape on purpose so the tests cover the mismatch.
const reservation = (overrides: Partial<ExistingReservation> = {}): ExistingReservation => ({
	facility_id: 1,
	reserved_date: '2026-07-25',
	start_time: '09:00:00',
	end_time: '11:00:00',
	status: 'approved',
	...overrides,
})

const draft = (overrides: Record<string, unknown> = {}) => ({
	facilityId: 1,
	reservedDate: '2026-07-25',
	startTime: '13:00',
	endTime: '14:00',
	purpose: 'Practical exam',
	...overrides,
})

describe('windowsOverlap', () => {
	it('treats intervals as half-open so back-to-back bookings do not clash', () => {
		expect(windowsOverlap('09:00', '10:00', '10:00', '11:00')).toBe(false)
		expect(windowsOverlap('10:00', '11:00', '09:00', '10:00')).toBe(false)
	})

	it('detects partial overlap from either side', () => {
		expect(windowsOverlap('09:30', '10:30', '09:00', '10:00')).toBe(true)
		expect(windowsOverlap('08:30', '09:30', '09:00', '10:00')).toBe(true)
	})

	it('detects full containment in both directions', () => {
		expect(windowsOverlap('09:15', '09:45', '09:00', '10:00')).toBe(true)
		expect(windowsOverlap('08:00', '11:00', '09:00', '10:00')).toBe(true)
	})

	it('compares HH:MM against HH:MM:SS correctly', () => {
		// A naive string compare would read '9:00' vs '09:00:00' inconsistently;
		// minutes-since-midnight makes the two formats commensurable.
		expect(windowsOverlap('09:30', '10:30', '09:00:00', '10:00:00')).toBe(true)
		expect(windowsOverlap('10:00', '11:00', '09:00:00', '10:00:00')).toBe(false)
	})
})

describe('findReservationClash', () => {
	it('ignores rejected and cancelled rows, which release the slot', () => {
		const existing = [reservation({ status: 'rejected' }), reservation({ status: 'cancelled' })]
		expect(findReservationClash(existing, { facilityId: 1, reservedDate: '2026-07-25', startTime: '09:00', endTime: '11:00' })).toBeNull()
	})

	it('blocks against a pending row, which still holds the slot', () => {
		const existing = [reservation({ status: 'pending' })]
		expect(findReservationClash(existing, { facilityId: 1, reservedDate: '2026-07-25', startTime: '10:00', endTime: '12:00' })).not.toBeNull()
	})

	it('scopes the clash to the same facility and the same date', () => {
		const existing = [reservation()]
		expect(findReservationClash(existing, { facilityId: 2, reservedDate: '2026-07-25', startTime: '09:00', endTime: '11:00' })).toBeNull()
		expect(findReservationClash(existing, { facilityId: 1, reservedDate: '2026-07-26', startTime: '09:00', endTime: '11:00' })).toBeNull()
	})

	it('returns null when no facility is chosen yet', () => {
		expect(findReservationClash([reservation()], { facilityId: null, reservedDate: '2026-07-25', startTime: '09:00', endTime: '11:00' })).toBeNull()
	})
})

describe('facilityBookingsOn', () => {
	it('returns only the given facility and date, soonest first', () => {
		const bookings = [
			reservation({ facility_id: 1, reserved_date: '2026-07-25', start_time: '13:00:00', end_time: '14:00:00' }),
			reservation({ facility_id: 1, reserved_date: '2026-07-25', start_time: '08:00:00', end_time: '09:00:00' }),
			reservation({ facility_id: 2, reserved_date: '2026-07-25' }), // other facility
			reservation({ facility_id: 1, reserved_date: '2026-07-26' }), // other date
		]
		const result = facilityBookingsOn(bookings, 1, '2026-07-25')
		expect(result.map((r) => r.start_time)).toEqual(['08:00:00', '13:00:00'])
	})

	it('excludes rejected and cancelled rows, which release the slot', () => {
		const bookings = [reservation({ status: 'rejected' }), reservation({ status: 'cancelled' })]
		expect(facilityBookingsOn(bookings, 1, '2026-07-25')).toEqual([])
	})

	it('includes pending rows — they still hold the slot even though they are not occupying it yet', () => {
		const bookings = [reservation({ status: 'pending' })]
		expect(facilityBookingsOn(bookings, 1, '2026-07-25')).toHaveLength(1)
	})
})

describe('activeBooking', () => {
	// 8:00 AM–9:00 AM and 1:00 PM–3:00 PM, so the gaps (10:00 AM–12:00 PM and
	// the rest of the afternoon) are exactly the scenario this exists for: a
	// facility booked in the morning must not read as occupied at 10 AM.
	const morning = reservation({ start_time: '08:00:00', end_time: '09:00:00', status: 'approved' })
	const afternoon = reservation({ start_time: '13:00:00', end_time: '15:00:00', status: 'approved' })
	const dayBookings = [morning, afternoon]

	it('finds the booking whose window contains the current time', () => {
		expect(activeBooking(dayBookings, toMinutes('08:30'))).toBe(morning)
		expect(activeBooking(dayBookings, toMinutes('14:00'))).toBe(afternoon)
	})

	it('returns null during a gap between bookings — the room reads available there', () => {
		expect(activeBooking(dayBookings, toMinutes('10:00'))).toBeNull()
		expect(activeBooking(dayBookings, toMinutes('16:00'))).toBeNull()
		expect(activeBooking(dayBookings, toMinutes('07:00'))).toBeNull()
	})

	it('is half-open: exactly at the end time, the room is already free', () => {
		expect(activeBooking(dayBookings, toMinutes('09:00'))).toBeNull()
	})

	it('exactly at the start time, the room is already occupied', () => {
		expect(activeBooking(dayBookings, toMinutes('08:00'))).toBe(morning)
	})

	it('a merely pending booking never counts as occupying the room', () => {
		const pendingOnly = [reservation({ start_time: '08:00:00', end_time: '09:00:00', status: 'pending' })]
		expect(activeBooking(pendingOnly, toMinutes('08:30'))).toBeNull()
	})
})

// Mirrors the sync_facility_availability trigger in 20260722160000: an approved
// booking flips the facility to 'reserved', and only 'available' is bookable.
describe('facilityReserveBlockedReason', () => {
	const DEPT_A = 'aaaaaaaa-0000-0000-0000-000000000000'
	const DEPT_B = 'bbbbbbbb-0000-0000-0000-000000000000'
	const staff = { role: 'staff', departmentId: DEPT_A }

	it('allows an available facility in the user’s own department', () => {
		expect(facilityReserveBlockedReason({ current_availability: 'available', department_id: DEPT_A }, staff)).toBeNull()
	})

	it('blocks a facility that is already reserved', () => {
		expect(facilityReserveBlockedReason({ current_availability: 'reserved', department_id: DEPT_A }, staff)).toMatch(/currently reserved/i)
	})

	it.each(['reserved', 'in_use', 'under_maintenance'])('blocks a facility marked %s', (status) => {
		expect(facilityReserveBlockedReason({ current_availability: status, department_id: DEPT_A }, staff)).not.toBeNull()
	})

	it('blocks another department’s facility even when it is available', () => {
		expect(facilityReserveBlockedReason({ current_availability: 'available', department_id: DEPT_B }, staff)).toMatch(/another department/i)
	})

	it('lets anyone book a central, department-less facility', () => {
		expect(facilityReserveBlockedReason({ current_availability: 'available', department_id: null }, staff)).toBeNull()
	})

	it('lets the super admin book any department’s available facility', () => {
		const superAdmin = { role: 'super_admin', departmentId: null }
		expect(facilityReserveBlockedReason({ current_availability: 'available', department_id: DEPT_B }, superAdmin)).toBeNull()
		// …but not one that is already taken.
		expect(facilityReserveBlockedReason({ current_availability: 'reserved', department_id: DEPT_B }, superAdmin)).toMatch(/currently reserved/i)
	})
})

// Mirrors the "facility reservations insert own" RLS policy in
// 20260722180000: if this drifts from the SQL, the UI could either offer an
// auto-approve the database will reject, or fail to offer one it would allow.
describe('reservationAutoApproves', () => {
	const DEPT_A = 'aaaaaaaa-0000-0000-0000-000000000000'
	const DEPT_B = 'bbbbbbbb-0000-0000-0000-000000000000'

	it('always auto-approves for the super admin', () => {
		expect(reservationAutoApproves({ department_id: DEPT_A }, { role: 'super_admin', departmentId: null })).toBe(true)
		expect(reservationAutoApproves({ department_id: null }, { role: 'super_admin', departmentId: null })).toBe(true)
	})

	it('auto-approves a department admin booking their own department’s facility', () => {
		expect(reservationAutoApproves({ department_id: DEPT_A }, { role: 'department_admin', departmentId: DEPT_A })).toBe(true)
	})

	it('does not auto-approve a department admin booking another department’s facility', () => {
		expect(reservationAutoApproves({ department_id: DEPT_B }, { role: 'department_admin', departmentId: DEPT_A })).toBe(false)
	})

	it('does not auto-approve a department admin booking a central facility — that is the super admin’s to approve', () => {
		expect(reservationAutoApproves({ department_id: null }, { role: 'department_admin', departmentId: DEPT_A })).toBe(false)
	})

	it('never auto-approves for staff', () => {
		expect(reservationAutoApproves({ department_id: DEPT_A }, { role: 'staff', departmentId: DEPT_A })).toBe(false)
		expect(reservationAutoApproves({ department_id: null }, { role: 'staff', departmentId: DEPT_A })).toBe(false)
	})
})

describe('validateReservation', () => {
	const context = { today: TODAY, existing: [] as ExistingReservation[] }

	it('accepts a well-formed draft', () => {
		expect(validateReservation(draft(), context)).toBeNull()
	})

	it('requires a facility', () => {
		expect(validateReservation(draft({ facilityId: null }), context)).toMatch(/choose an available facility/i)
	})

	it.each([
		['reservedDate', ''],
		['startTime', ''],
		['endTime', ''],
		['purpose', '   '],
	])('requires %s', (field, value) => {
		expect(validateReservation(draft({ [field]: value }), context)).toMatch(/complete all fields/i)
	})

	it('rejects a date in the past but allows today', () => {
		expect(validateReservation(draft({ reservedDate: '2026-07-21' }), context)).toMatch(/cannot be in the past/i)
		expect(validateReservation(draft({ reservedDate: TODAY }), context)).toBeNull()
	})

	it('rejects an end time at or before the start time', () => {
		expect(validateReservation(draft({ startTime: '14:00', endTime: '14:00' }), context)).toMatch(/later than the start time/i)
		expect(validateReservation(draft({ startTime: '14:00', endTime: '13:00' }), context)).toMatch(/later than the start time/i)
	})

	it('rejects a purpose containing digits', () => {
		expect(validateReservation(draft({ purpose: 'Exam for 3rd year' }), context)).toMatch(/cannot contain numbers/i)
	})

	it('reports the conflicting window when the slot is taken', () => {
		const message = validateReservation(draft({ startTime: '10:00', endTime: '12:00' }), {
			today: TODAY,
			existing: [reservation()],
		})
		expect(message).toMatch(/overlaps an existing approved reservation \(09:00–11:00\)/)
	})

	it('checks the basics before the clash, so the first fix is the obvious one', () => {
		// An empty end time must not be reported as an overlap.
		expect(validateReservation(draft({ endTime: '' }), { today: TODAY, existing: [reservation()] })).toMatch(/complete all fields/i)
	})
})
