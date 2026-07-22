import { useState } from 'react'
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
import type { FacilityReservationRow, FacilityRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'
import { getErrorMessage } from '@/backend/lib/errors'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

const availabilityTone: Record<string, 'success' | 'warning' | 'info' | 'muted'> = {
	available: 'success',
	reserved: 'warning',
	in_use: 'info',
	under_maintenance: 'muted',
}

const reservationTone: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
	pending: 'warning',
	approved: 'success',
	rejected: 'danger',
	cancelled: 'muted',
}

// 'HH:MM:SS' (or 'HH:MM') → '1:00 PM'
function formatTime(value: string) {
	const [hourText, minute] = value.split(':')
	const hour = Number(hourText)
	const period = hour >= 12 ? 'PM' : 'AM'
	const twelve = hour % 12 === 0 ? 12 : hour % 12
	return `${twelve}:${minute} ${period}`
}

export default function FacilitiesPage({ user }: { user: SchoolUser }) {
	const { data, isLoading } = useFacilities()
	const { data: departments } = useDepartments()
	const { data: reservations, isLoading: reservationsLoading } = useFacilityReservations()
	const createFacility = useCreateFacility()
	const createReservation = useCreateFacilityReservation()
	const updateReservation = useUpdateFacilityReservationStatus()

	const canManage = user.role === 'super_admin' || user.role === 'department_admin'
	const canApprove = canManage
	// Staff, deans, and admins may reserve; students borrow items but not rooms.
	const canReserve = user.role === 'super_admin' || user.role === 'department_admin' || user.role === 'staff'
	const today = new Date().toLocaleDateString('en-CA')

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

	const availableFacilities = data?.filter((facility) => facility.current_availability === 'available') ?? []
	const canOpenReserve = canReserve && availableFacilities.length > 0

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
				department_id: departmentId || null,
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
		if (!facility) {
			setReserveError('Please choose an available facility.')
			return
		}
		// Every field is required — no partially filled requests.
		if (!reservedDate || !startTime || !endTime || !purpose.trim()) {
			setReserveError('Please complete all fields before submitting.')
			return
		}
		if (reservedDate < today) {
			setReserveError('The reservation date cannot be in the past.')
			return
		}
		if (endTime <= startTime) {
			setReserveError('The end time must be later than the start time.')
			return
		}
		// Purpose must describe the use in words — reject any digits.
		if (/\d/.test(purpose)) {
			setReserveError('The purpose cannot contain numbers.')
			return
		}

		// Soft overlap guard: block a window that collides with an existing
		// pending/approved reservation for the same facility on the same day.
		const clash = (reservations ?? []).some(
			(row) =>
				row.facility_id === facility.id &&
				row.reserved_date === reservedDate &&
				(row.status === 'pending' || row.status === 'approved') &&
				startTime < row.end_time.slice(0, 5) &&
				endTime > row.start_time.slice(0, 5),
		)
		if (clash) {
			setReserveError('That time window overlaps an existing reservation for this facility. Please pick another slot.')
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
			})
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
						render: (row) => <StatusChip tone={availabilityTone[row.current_availability] ?? 'muted'}>{row.current_availability.replace('_', ' ')}</StatusChip>,
					},
					...(canReserve
						? [
								{
									header: 'Reserve',
									render: (row: FacilityRow) =>
										row.current_availability === 'available' ? (
											<Button size="sm" variant="secondary" onClick={() => openReserveFor(row.id)}>
												Reserve
											</Button>
										) : (
											<span className="text-text-muted">—</span>
										),
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
				searchKeys={['status', 'purpose']}
				emptyMessage={canReserve ? 'No reservation requests yet.' : 'No reservation requests to review.'}
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
							canApprove && row.status === 'pending' ? (
								<div className="flex gap-2">
									<Button size="sm" variant="secondary" onClick={() => runReservationStatus(row.id, 'approved', true)}>
										Approve
									</Button>
									<Button size="sm" variant="danger" onClick={() => runReservationStatus(row.id, 'rejected', true)}>
										Reject
									</Button>
								</div>
							) : row.status === 'pending' && row.requester_id === user.id ? (
								<Button size="sm" variant="danger" onClick={() => runReservationStatus(row.id, 'cancelled', false)} disabled={updateReservation.isPending}>
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
					<p className="text-xs text-text-muted">Your request starts as pending and must be approved by the facility's department admin or a super admin.</p>
					<Button type="submit" className="w-full" disabled={createReservation.isPending}>
						{createReservation.isPending ? 'Submitting…' : 'Submit Reservation'}
					</Button>
				</form>
			</Modal>
		</div>
	)
}
