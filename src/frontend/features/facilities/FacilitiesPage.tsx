import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import {
	useCreateFacility,
	useCreateFacilityReservation,
	useDepartments,
	useFacilities,
	useFacilityReservations,
	useUpdateFacilityReservationStatus,
} from '@/backend/lib/supabase/queries'
import FacilityReservationDetailsModal from '@/frontend/features/facilities/FacilityReservationDetailsModal'
import type { FacilityReservationRow, FacilityRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'
import { getErrorMessage } from '@/backend/lib/errors'
import { activeBooking, facilityBookingsOn, facilityReserveBlockedReason, reservationAutoApproves, toMinutes, validateReservation } from '@/backend/lib/reservations'
import { availabilityTone, formatTime, reservationTone } from '@/frontend/features/facilities/facilityDisplay'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

// Sentinel for the department <select>: distinct from '' (the disabled
// placeholder) so a real, non-empty value can still mean "no department".
// "facilities admin write" RLS only lets a super_admin insert with
// department_id null — see 20260722200000/20260722180000 — so a department
// admin, locked to their own department below, never sees this option.
const CENTRAL_FACILITY = '__central__'

export default function FacilitiesPage({ user }: { user: SchoolUser }) {
	const { data, isLoading, error: facilitiesError } = useFacilities()
	const { data: departments } = useDepartments()
	const { data: reservations, isLoading: reservationsLoading, error: reservationsError } = useFacilityReservations()
	const createFacility = useCreateFacility()
	const createReservation = useCreateFacilityReservation()
	const updateReservation = useUpdateFacilityReservationStatus()

	const canManage = user.role === 'super_admin' || user.role === 'department_admin'
	const canApprove = canManage
	// Staff, deans, and admins may reserve; students borrow items but not rooms.
	const canReserve = user.role === 'super_admin' || user.role === 'department_admin' || user.role === 'staff'

	// A reservation's "Booked"/"Available" state is computed live (see
	// facilityBookingsOn/activeBooking) rather than stored, so it must be
	// re-evaluated as the clock moves — not just when something else causes a
	// re-render — or a room reserved e.g. 8-9am keeps reading "Booked" all day
	// to anyone who leaves this page open past 9am.
	const [now, setNow] = useState(() => new Date())
	useEffect(() => {
		const interval = setInterval(() => setNow(new Date()), 30_000)
		return () => clearInterval(interval)
	}, [])
	const today = now.toLocaleDateString('en-CA')
	const nowMinutes = now.getHours() * 60 + now.getMinutes()

	// --- Add Facility modal ---
	const [open, setOpen] = useState(false)
	const [name, setName] = useState('')
	const [facilityType, setFacilityType] = useState('')
	const [departmentId, setDepartmentId] = useState(user.role === 'department_admin' ? user.departmentId ?? '' : '')
	const [capacity, setCapacity] = useState('0')
	const [error, setError] = useState<string | null>(null)

	// --- Reserve Facility modal ---
	const [reserveOpen, setReserveOpen] = useState(false)
	const [reserveFacilityId, setReserveFacilityId] = useState('')
	const [reservedDate, setReservedDate] = useState('')
	const [startTime, setStartTime] = useState('')
	const [endTime, setEndTime] = useState('')
	const [purpose, setPurpose] = useState('')
	const [reserveError, setReserveError] = useState<string | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	const [detailsReservation, setDetailsReservation] = useState<FacilityReservationRow | null>(null)

	// One rule drives both the picker and the per-row Reserve button, so the
	// table can never offer a room the modal would refuse (or vice versa).
	const availableFacilities = data?.filter((facility) => facilityReserveBlockedReason(facility, user) === null) ?? []
	const canOpenReserve = canReserve && availableFacilities.length > 0

	// The clash guard below can only see reservations this user is allowed to
	// read. For a central facility that is nobody's department, a non-super-admin
	// sees none of them — so the database exclusion constraint is the real
	// authority and its rejection is surfaced verbatim on submit.
	const visibleReservations = reservations ?? []

	const reserveFacility = availableFacilities.find((row) => String(row.id) === reserveFacilityId)
	// Existing bookings for the chosen facility and date, shown in the modal so
	// the user can see what time is actually still open before picking a slot.
	const dayBookings = reserveFacility ? facilityBookingsOn(visibleReservations, reserveFacility.id, reservedDate) : []
	// A non-super-admin cannot see every booking on a central facility (the
	// select policy scopes those to the requester and super admins), so the
	// list above may be incomplete for one. The database exclusion constraint
	// is still the real authority and catches what this list cannot show.
	const dayBookingsMayBeIncomplete = Boolean(reserveFacility) && reserveFacility?.department_id === null && user.role !== 'super_admin'
	const willAutoApprove = reserveFacility ? reservationAutoApproves(reserveFacility, user) : false

	const openReserveFor = (facilityId?: number) => {
		setReserveError(null)
		setReserveFacilityId(facilityId ? String(facilityId) : '')
		setReservedDate('')
		setStartTime('')
		setEndTime('')
		setPurpose('')
		setReserveOpen(true)
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		try {
			await createFacility.mutateAsync({
				name,
				facility_type: facilityType,
				department_id: departmentId === CENTRAL_FACILITY ? null : departmentId || null,
				capacity: Number(capacity) || 0,
			})
			setName('')
			setFacilityType('')
			setCapacity('0')
			setOpen(false)
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to create facility.'))
		}
	}

	const handleReserve = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setReserveError(null)

		const facility = availableFacilities.find((row) => String(row.id) === reserveFacilityId)
		const message = validateReservation(
			{
				facilityId: facility?.id ?? null,
				reservedDate,
				startTime,
				endTime,
				purpose,
			},
			{ today, existing: visibleReservations },
		)
		if (message || !facility) {
			setReserveError(message ?? 'Please choose an available facility.')
			return
		}

		try {
			await createReservation.mutateAsync({
				facility_id: facility.id,
				requester_id: user.id,
				department_id: facility.department_id,
				reserved_date: reservedDate,
				start_time: startTime,
				end_time: endTime,
				purpose: purpose.trim(),
				// An admin reserving a facility they themselves would approve is
				// approved on arrival — see reservationAutoApproves.
				...(reservationAutoApproves(facility, user) ? { status: 'approved' as const, approved_by: user.id } : {}),
			})
			// Clear the draft so the next open starts clean even if it is reopened
			// through a path that does not reset (e.g. the browser restoring state).
			setReserveFacilityId('')
			setReservedDate('')
			setStartTime('')
			setEndTime('')
			setPurpose('')
			setReserveOpen(false)
		} catch (mutationError) {
			setReserveError(getErrorMessage(mutationError, 'Failed to submit reservation request.'))
		}
	}

	const runReservationStatus = (id: number, status: string, withApprover: boolean) => {
		setActionError(null)
		updateReservation.mutate(
			{ id, status, ...(withApprover ? { approverId: user.id } : {}) },
			{ onError: (mutationError) => setActionError(getErrorMessage(mutationError, 'Failed to update reservation.')) },
		)
	}

	return (
		<div className="space-y-6">
			{actionError ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{actionError}</div> : null}

			<EntityTablePage<FacilityRow>
				title="Facilities"
				subtitle={`${data?.length ?? 0} facilities`}
				rows={data}
				isLoading={isLoading}
				error={facilitiesError}
				searchKeys={['name', 'facility_type']}
				emptyMessage="No facilities recorded yet."
				emptyAction={canManage ? <Button size="sm" onClick={() => setOpen(true)}>Add the first facility</Button> : null}
				action={
					<div className="flex flex-wrap gap-2">
						{canReserve ? (
							<Button size="sm" variant="secondary" onClick={() => openReserveFor()} disabled={!canOpenReserve}>
								{canOpenReserve ? 'Reserve Facility' : 'None available'}
							</Button>
						) : null}
						{canManage ? <Button size="sm" onClick={() => setOpen(true)}>Add Facility</Button> : null}
					</div>
				}
				columns={[
					{ header: 'Name', render: (row) => <span className="font-medium text-text-primary">{row.name}</span> },
					{ header: 'Type', render: (row) => row.facility_type },
					{ header: 'Department', render: (row) => row.departments?.name ?? '—' },
					{ header: 'Capacity', render: (row) => row.capacity },
					{
						header: 'Availability',
						render: (row) => {
							// An administrator's explicit state always wins — a reservation
							// never overrides "under maintenance" or "in use".
							if (row.current_availability !== 'available') {
								return <StatusChip tone={availabilityTone[row.current_availability] ?? 'muted'}>{row.current_availability.replace('_', ' ')}</StatusChip>
							}

							const todaysBookings = facilityBookingsOn(visibleReservations, row.id, today)
							const current = activeBooking(todaysBookings, nowMinutes)
							if (current) {
								return (
									<div>
										<StatusChip tone="warning">Reserved</StatusChip>
										<p className="mt-1 text-xs text-text-muted">Until {formatTime(current.end_time)}</p>
									</div>
								)
							}

							// Available right now — but say so specifically, listing any
							// other booked windows today rather than a blanket "reserved"
							// for the whole day when only a slice of it is actually taken.
							// Already-ended windows (e.g. an 8-10am booking once it's 1pm)
							// are dropped here — they're history, not a reason to expect the
							// room to be booked "today" from this point on.
							const upcomingBookings = todaysBookings.filter((booking) => toMinutes(booking.end_time) > nowMinutes)
							return (
								<div>
									<StatusChip tone="success">Available</StatusChip>
									{upcomingBookings.length > 0 ? (
										<p className="mt-1 text-xs text-text-muted">
											Booked today: {upcomingBookings.map((booking) => `${formatTime(booking.start_time)}–${formatTime(booking.end_time)}`).join(', ')}
										</p>
									) : null}
								</div>
							)
						},
					},
					...(canReserve
						? [
								{
									header: 'Reserve',
									render: (row: FacilityRow) => {
										const blocked = facilityReserveBlockedReason(row, user)
										return (
											<Button
												size="sm"
												variant="secondary"
												disabled={Boolean(blocked)}
												title={blocked ?? 'Reserve this facility'}
												onClick={() => openReserveFor(row.id)}
											>
												Reserve
											</Button>
										)
									},
								},
							]
						: []),
				]}
			/>

			<EntityTablePage<FacilityReservationRow>
				title="Facility Reservations"
				subtitle={`${reservations?.length ?? 0} requests`}
				rows={reservations}
				isLoading={reservationsLoading}
				error={reservationsError}
				searchKeys={['status', 'purpose']}
				emptyMessage={canReserve ? 'No reservation requests yet.' : 'No reservation requests to review.'}
				onRowClick={(row) => setDetailsReservation(row)}
				columns={[
					{
						header: 'Facility',
						render: (row) => (
							<div>
								<p className="font-medium text-text-primary">{row.facilities?.name ?? `Facility #${row.facility_id}`}</p>
								<p className="text-xs text-text-muted">{row.requester?.full_name ?? '—'}</p>
							</div>
						),
					},
					{ header: 'Department', render: (row) => row.departments?.name ?? '—' },
					{ header: 'Date', render: (row) => new Date(`${row.reserved_date}T00:00:00`).toLocaleDateString() },
					{ header: 'Time', render: (row) => `${formatTime(row.start_time)} – ${formatTime(row.end_time)}` },
					{ header: 'Purpose', render: (row) => <span className="text-text-muted">{row.purpose}</span> },
					{ header: 'Status', render: (row) => <StatusChip tone={reservationTone[row.status] ?? 'muted'}>{row.status}</StatusChip> },
					{
						header: 'Actions',
						render: (row) =>
							// Own requests offer Cancel, never Approve — an admin must not
							// rubber-stamp their own booking just because they hold the role.
							// Every button here stops propagation so it doesn't also open
							// the row's details modal.
							canApprove && row.status === 'pending' && row.requester_id !== user.id ? (
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="secondary"
										onClick={(event) => {
											event.stopPropagation()
											runReservationStatus(row.id, 'approved', true)
										}}
										disabled={updateReservation.isPending}
									>
										Approve
									</Button>
									<Button
										size="sm"
										variant="danger"
										onClick={(event) => {
											event.stopPropagation()
											runReservationStatus(row.id, 'rejected', true)
										}}
										disabled={updateReservation.isPending}
									>
										Reject
									</Button>
								</div>
							) : row.status === 'pending' && row.requester_id === user.id ? (
								<Button
									size="sm"
									variant="danger"
									onClick={(event) => {
										event.stopPropagation()
										runReservationStatus(row.id, 'cancelled', false)
									}}
									disabled={updateReservation.isPending}
								>
									Cancel
								</Button>
							) : (
								<span className="text-text-muted">—</span>
							),
					},
				]}
			/>

			<Modal open={open} onClose={() => setOpen(false)} title="Add Facility">
				<form className="space-y-4" onSubmit={handleSubmit}>
					{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
					<div>
						<label className={labelClass} htmlFor="facility-name">
							Name
						</label>
						<input id="facility-name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} required />
					</div>
					<div>
						<label className={labelClass} htmlFor="facility-type">
							Type
						</label>
						<input id="facility-type" value={facilityType} onChange={(event) => setFacilityType(event.target.value)} className={inputClass} placeholder="Laboratory, Classroom, Office…" required />
					</div>
					<div>
						<label className={labelClass} htmlFor="facility-department">
							Department
						</label>
						<select
							id="facility-department"
							value={departmentId}
							onChange={(event) => setDepartmentId(event.target.value)}
							className={inputClass}
							disabled={user.role === 'department_admin'}
							required
						>
							<option value="" disabled>
								Select department
							</option>
							{user.role === 'super_admin' ? (
								<option value={CENTRAL_FACILITY}>Central (no department — you approve its reservations)</option>
							) : null}
							{departments?.map((dept) => (
								<option key={dept.id} value={dept.id}>
									{dept.name}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className={labelClass} htmlFor="facility-capacity">
							Capacity
						</label>
						<input id="facility-capacity" type="number" min={0} value={capacity} onChange={(event) => setCapacity(event.target.value)} className={inputClass} />
					</div>
					<Button type="submit" className="w-full" disabled={createFacility.isPending}>
						{createFacility.isPending ? 'Creating…' : 'Create Facility'}
					</Button>
				</form>
			</Modal>

			<Modal open={reserveOpen} onClose={() => setReserveOpen(false)} title="Reserve a Facility">
				<form className="space-y-4" onSubmit={handleReserve}>
					{reserveError ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{reserveError}</div> : null}
					<div>
						<label className={labelClass} htmlFor="reserve-facility">
							Facility
						</label>
						<select id="reserve-facility" value={reserveFacilityId} onChange={(event) => setReserveFacilityId(event.target.value)} className={inputClass} required>
							<option value="" disabled>
								Select an available facility
							</option>
							{availableFacilities.map((facility) => (
								<option key={facility.id} value={facility.id}>
									{facility.name} — {facility.facility_type}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className={labelClass} htmlFor="reserve-date">
							Date
						</label>
						<input id="reserve-date" type="date" min={today} value={reservedDate} onChange={(event) => setReservedDate(event.target.value)} className={inputClass} required />
					</div>

					{reserveFacility && reservedDate ? (
						<div className="rounded-lg border border-border bg-bg p-3">
							<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Existing bookings on this date</p>
							{dayBookings.length === 0 ? (
								<p className="text-sm text-text-muted">No bookings yet — the whole day is open.</p>
							) : (
								<ul className="space-y-1.5">
									{dayBookings.map((booking) => (
										<li key={booking.id} className="flex items-center justify-between gap-3 text-sm">
											<span className="text-text-primary">
												{formatTime(booking.start_time)} – {formatTime(booking.end_time)}
											</span>
											<StatusChip tone={reservationTone[booking.status] ?? 'muted'}>{booking.status}</StatusChip>
										</li>
									))}
								</ul>
							)}
							{dayBookingsMayBeIncomplete ? (
								<p className="mt-2 text-xs text-text-muted">
									You may not see every booking on this shared facility — a conflicting time is still blocked automatically when you submit.
								</p>
							) : null}
						</div>
					) : null}

					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label className={labelClass} htmlFor="reserve-start">
								Start Time
							</label>
							<input id="reserve-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={inputClass} required />
						</div>
						<div>
							<label className={labelClass} htmlFor="reserve-end">
								End Time
							</label>
							<input id="reserve-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={inputClass} required />
						</div>
					</div>
					<div>
						<label className={labelClass} htmlFor="reserve-purpose">
							Purpose
						</label>
						<input
							id="reserve-purpose"
							value={purpose}
							onChange={(event) => setPurpose(event.target.value.replace(/[0-9]/g, ''))}
							className={inputClass}
							placeholder="e.g. Practical exam, seminar, org meeting"
							required
						/>
						<p className="mt-1.5 text-xs text-text-muted">Letters only — numbers are not allowed.</p>
					</div>
					{willAutoApprove ? (
						<p className="text-xs text-success">
							You approve reservations for this facility, so this one is confirmed as soon as you submit — no separate review step.
						</p>
					) : (
						<p className="text-xs text-text-muted">Your request starts as pending and must be approved by the facility's department admin or a super admin.</p>
					)}
					<Button type="submit" className="w-full" disabled={createReservation.isPending}>
						{createReservation.isPending ? 'Submitting…' : willAutoApprove ? 'Confirm Reservation' : 'Submit Reservation'}
					</Button>
				</form>
			</Modal>

			{detailsReservation ? <FacilityReservationDetailsModal reservation={detailsReservation} onClose={() => setDetailsReservation(null)} /> : null}
		</div>
	)
}
