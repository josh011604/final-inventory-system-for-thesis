// Pure reservation rules, kept out of the React tree so both the Facilities
// screen and the unit tests exercise exactly the same logic.
//
// Postgres returns a `time` column as 'HH:MM:SS' while `<input type="time">`
// produces 'HH:MM'. Every comparison here normalizes to minutes-since-midnight
// so the two formats can never be compared as mismatched strings.

export type ReservableFacility = {
	current_availability: string
	department_id: string | null
}

export type Reserver = { role: string; departmentId: string | null }

// Why a facility cannot be reserved right now — null when it can be.
//
// current_availability only ever reflects an administrator's explicit choice
// (under_maintenance / in_use) — see 20260723100000. A reservation, even an
// approved one, never blocks the facility here: a single booked hour must not
// make the room look unavailable for the rest of the day. Per-slot conflicts
// are caught separately, by findReservationClash and the database's
// facility_reservations_no_overlap exclusion constraint.
export function facilityReserveBlockedReason(facility: ReservableFacility, user: Reserver): string | null {
	if (facility.current_availability !== 'available') {
		return `This facility is currently ${facility.current_availability.replace('_', ' ')}.`
	}
	// Central (department-less) rooms are open to everyone; the super admin books
	// anything. Otherwise the room must belong to the user's own department —
	// reserving another department's room would also be unverifiable, since RLS
	// hides that room's existing bookings from them.
	if (user.role !== 'super_admin' && facility.department_id !== null && facility.department_id !== user.departmentId) {
		return 'This facility belongs to another department.'
	}
	return null
}

// Mirrors the "facility reservations insert own" RLS policy
// (20260722180000): the person who would ultimately approve a request does
// not need to file it as pending and approve it a moment later.
//
//   - A super admin approves everything, so their own request is final on
//     arrival.
//   - A department admin approves requests for their own department's
//     facilities only, so only those auto-approve; a central (department-less)
//     facility is approved by a super admin, so the department admin's request
//     for one still goes through the normal pending step.
//   - Staff (and, if ever enabled, students) never auto-approve — someone
//     else must review their request.
export function reservationAutoApproves(facility: { department_id: string | null }, user: Reserver): boolean {
	if (user.role === 'super_admin') return true
	if (user.role === 'department_admin' && facility.department_id !== null && facility.department_id === user.departmentId) return true
	return false
}

export type ExistingReservation = {
	facility_id: number
	reserved_date: string
	start_time: string
	end_time: string
	status: string
}

export type ReservationDraft = {
	facilityId: number | null
	reservedDate: string
	startTime: string
	endTime: string
	purpose: string
}

// A pending request already holds the slot; an approved one certainly does.
// Rejected and cancelled rows free it up again.
const BLOCKING_STATUSES = new Set(['pending', 'approved'])

export function toMinutes(value: string): number {
	const [hour, minute] = value.split(':')
	return Number(hour) * 60 + Number(minute)
}

// Half-open intervals: a booking that ends at 10:00 does not clash with one
// starting at 10:00.
export function windowsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
	return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(aEnd) > toMinutes(bStart)
}

export function findReservationClash(
	existing: readonly ExistingReservation[],
	draft: Pick<ReservationDraft, 'facilityId' | 'reservedDate' | 'startTime' | 'endTime'>,
): ExistingReservation | null {
	if (draft.facilityId == null) return null
	return (
		existing.find(
			(row) =>
				row.facility_id === draft.facilityId &&
				row.reserved_date === draft.reservedDate &&
				BLOCKING_STATUSES.has(row.status) &&
				windowsOverlap(draft.startTime, draft.endTime, row.start_time, row.end_time),
		) ?? null
	)
}

// A facility's bookings for one date, soonest first. Only pending and approved
// rows hold a slot (see BLOCKING_STATUSES); shared by the Facilities table's
// per-slot availability display and the Reserve modal's "existing bookings"
// panel, so the two can never disagree about what's booked.
//
// Generic over the caller's row type (rather than fixed to ExistingReservation)
// so a caller with a richer row — e.g. one that also carries `id` for a React
// key — gets that shape back out, not the narrowed minimum this module needs.
export function facilityBookingsOn<T extends ExistingReservation>(reservations: readonly T[], facilityId: number, date: string): T[] {
	return reservations
		.filter((row) => row.facility_id === facilityId && row.reserved_date === date && BLOCKING_STATUSES.has(row.status))
		.sort((a, b) => a.start_time.localeCompare(b.start_time))
}

// Of a facility's bookings for a date, the one actually occupying it right
// now — null if none is. Only an 'approved' booking occupies the room; a
// 'pending' one holds the slot against new conflicts but doesn't mean anyone
// is actually in there yet.
export function activeBooking<T extends ExistingReservation>(dayBookings: readonly T[], nowMinutes: number): T | null {
	return (
		dayBookings.find((row) => row.status === 'approved' && toMinutes(row.start_time) <= nowMinutes && nowMinutes < toMinutes(row.end_time)) ??
		null
	)
}

// Returns a user-facing message, or null when the draft is valid. Order matters:
// the most basic problem is reported first so the user fixes one thing at a time.
export function validateReservation(
	draft: ReservationDraft,
	context: { today: string; existing: readonly ExistingReservation[] },
): string | null {
	if (draft.facilityId == null) return 'Please choose an available facility.'
	if (!draft.reservedDate || !draft.startTime || !draft.endTime || !draft.purpose.trim()) {
		return 'Please complete all fields before submitting.'
	}
	if (draft.reservedDate < context.today) return 'The reservation date cannot be in the past.'
	if (toMinutes(draft.endTime) <= toMinutes(draft.startTime)) {
		return 'The end time must be later than the start time.'
	}
	// Purpose must describe the use in words — reject any digits.
	if (/\d/.test(draft.purpose)) return 'The purpose cannot contain numbers.'

	const clash = findReservationClash(context.existing, draft)
	if (clash) {
		return `That time window overlaps an existing ${clash.status} reservation (${clash.start_time.slice(0, 5)}–${clash.end_time.slice(0, 5)}). Please pick another slot.`
	}
	return null
}
