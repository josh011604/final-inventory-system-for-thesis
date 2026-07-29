import { useMemo, useState } from 'react'
import { Package, Building2 } from 'lucide-react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import StatusChip from '@/components/ui/StatusChip'
import { useBorrowRecords, useFacilityReservations } from '@/backend/lib/supabase/queries'
import { statusTone, formatDate } from '@/frontend/features/borrowing/borrowDisplay'
import { reservationTone, formatTime } from '@/frontend/features/facilities/facilityDisplay'
import type { SchoolUser } from '@/backend/types/school'

const selectClass = 'rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text-primary outline-none transition focus:border-primary'

type ActivityType = 'item' | 'facility'

type ActivityEntry = {
	id: string
	type: ActivityType
	name: string
	dateLabel: string
	endLabel: string
	status: string
	sortMs: number
}

// Union of every status either source can have — drives the status filter.
const ALL_STATUSES = ['pending', 'confirmed', 'borrowed', 'return_requested', 'returned', 'overdue', 'rejected', 'approved', 'cancelled']

// Combined read-only feed of the current user's own borrow requests and
// facility reservations, newest first. Both hooks are RLS-scoped to what the
// user is allowed to see (their department's rows too), so filter down to
// "mine" client-side same as BorrowHistoryPage does for borrow records.
export default function ActivityHistoryCard({ user }: { user: SchoolUser }) {
	const { data: borrowRecords, isLoading: borrowLoading, error: borrowError } = useBorrowRecords()
	const { data: reservations, isLoading: reservationsLoading, error: reservationsError } = useFacilityReservations()

	const [typeFilter, setTypeFilter] = useState<'all' | ActivityType>('all')
	const [statusFilter, setStatusFilter] = useState('all')

	const entries = useMemo<ActivityEntry[]>(() => {
		const items: ActivityEntry[] = (borrowRecords ?? [])
			.filter((row) => row.borrower_id === user.id)
			.map((row) => ({
				id: `item-${row.id}`,
				type: 'item',
				name: row.equipment?.equipment_name ?? '—',
				dateLabel: formatDate(row.borrowed_date),
				endLabel: row.actual_return_date ? formatDate(row.actual_return_date) : row.expected_return_date ? formatDate(row.expected_return_date) : '—',
				status: row.status,
				sortMs: new Date(row.borrowed_date ?? row.created_at).getTime(),
			}))

		const facilityEntries: ActivityEntry[] = (reservations ?? [])
			.filter((row) => row.requester_id === user.id)
			.map((row) => ({
				id: `facility-${row.id}`,
				type: 'facility',
				name: row.facilities?.name ?? '—',
				dateLabel: `${new Date(row.reserved_date).toLocaleDateString()} · ${formatTime(row.start_time)}`,
				endLabel: formatTime(row.end_time),
				status: row.status,
				sortMs: new Date(`${row.reserved_date}T${row.start_time}`).getTime(),
			}))

		return [...items, ...facilityEntries].sort((a, b) => b.sortMs - a.sortMs)
	}, [borrowRecords, reservations, user.id])

	const filteredEntries = entries.filter(
		(entry) => (typeFilter === 'all' || entry.type === typeFilter) && (statusFilter === 'all' || entry.status === statusFilter),
	)

	return (
		<EntityTablePage<ActivityEntry>
			title="Activity History"
			subtitle={`${entries.length} total records`}
			rows={filteredEntries}
			isLoading={borrowLoading || reservationsLoading}
			error={borrowError || reservationsError}
			searchKeys={['name']}
			emptyMessage="No borrowing or reservation history yet."
			action={
				<div className="flex flex-wrap gap-2">
					<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | ActivityType)} className={selectClass}>
						<option value="all">All Types</option>
						<option value="item">Items</option>
						<option value="facility">Facilities</option>
					</select>
					<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectClass}>
						<option value="all">All Statuses</option>
						{ALL_STATUSES.map((status) => (
							<option key={status} value={status}>
								{status.replace('_', ' ')}
							</option>
						))}
					</select>
				</div>
			}
			columns={[
				{
					header: 'Type',
					render: (entry) =>
						entry.type === 'item' ? (
							<span className="inline-flex items-center gap-1.5 text-text-muted">
								<Package className="h-4 w-4" /> Item
							</span>
						) : (
							<span className="inline-flex items-center gap-1.5 text-text-muted">
								<Building2 className="h-4 w-4" /> Facility
							</span>
						),
				},
				{ header: 'Name', render: (entry) => <span className="font-medium text-text-primary">{entry.name}</span> },
				{ header: 'Date', render: (entry) => entry.dateLabel },
				{ header: 'Return/End Date', render: (entry) => entry.endLabel },
				{
					header: 'Status',
					render: (entry) => (
						<StatusChip tone={(entry.type === 'item' ? statusTone[entry.status] : reservationTone[entry.status]) ?? 'muted'}>
							{entry.status.replace('_', ' ')}
						</StatusChip>
					),
				},
			]}
		/>
	)
}
