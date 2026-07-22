import type { ReactNode } from 'react'
import Modal from '@/components/ui/Modal'
import StatusChip from '@/components/ui/StatusChip'
import type { FacilityReservationRow } from '@/backend/lib/supabase/queries'
import { formatTime, reservationTone } from '@/frontend/features/facilities/facilityDisplay'

function Row({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-border/60 py-2.5 last:border-b-0">
			<dt className="text-sm text-text-muted">{label}</dt>
			<dd className="text-right text-sm font-medium text-text-primary">{value}</dd>
		</div>
	)
}

function formatDateLong(dateOnly: string) {
	return new Date(`${dateOnly}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateTime(value: string) {
	return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function FacilityReservationDetailsModal({ reservation, onClose }: { reservation: FacilityReservationRow; onClose: () => void }) {
	return (
		<Modal open onClose={onClose} title="Reservation Details">
			<div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-4">
				<div className="min-w-0">
					<p className="truncate font-semibold text-text-primary">{reservation.facilities?.name ?? `Facility #${reservation.facility_id}`}</p>
					<p className="text-xs text-text-muted">{reservation.facilities?.facility_type ?? 'Facility'}</p>
				</div>
				<StatusChip tone={reservationTone[reservation.status] ?? 'muted'}>{reservation.status}</StatusChip>
			</div>

			<dl>
				<Row label="Requested by" value={reservation.requester?.full_name ?? '—'} />
				<Row label="Department" value={reservation.departments?.name ?? 'Central (Super Admin approves)'} />
				<Row label="Date" value={formatDateLong(reservation.reserved_date)} />
				<Row label="Time" value={`${formatTime(reservation.start_time)} – ${formatTime(reservation.end_time)}`} />
				<Row label="Purpose" value={reservation.purpose} />
				<Row
					label="Reviewed by"
					value={reservation.approver?.full_name ?? (reservation.status === 'pending' ? 'Awaiting review' : '—')}
				/>
				<Row label="Requested on" value={formatDateTime(reservation.created_at)} />
				{reservation.updated_at !== reservation.created_at ? <Row label="Last updated" value={formatDateTime(reservation.updated_at)} /> : null}
			</dl>
		</Modal>
	)
}
