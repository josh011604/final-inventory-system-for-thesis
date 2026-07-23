import EntityTablePage from '@/components/ui/EntityTablePage'
import StatusChip from '@/components/ui/StatusChip'
import { useBorrowCandidates } from '@/frontend/features/borrowing/useBorrowCandidates'
import { statusTone, formatDate } from '@/frontend/features/borrowing/borrowDisplay'
import { useBorrowRecords } from '@/backend/lib/supabase/queries'
import type { BorrowRecordRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'

// Read-only record of everything this user has borrowed. Students request items
// from the Inventory screen's per-item Borrow button; this screen is where they
// follow what happened to each of those requests.
export default function BorrowHistoryPage({ user }: { user: SchoolUser }) {
	const { data, isLoading, error: loadError } = useBorrowRecords()

	// The borrow select policy also exposes the rest of the user's department, so
	// narrow to this borrower — "items I borrowed", not the department's ledger.
	const myRecords = data?.filter((row) => row.borrower_id === user.id)

	// Supply Office equipment rows are RLS-hidden from non-super-admins, so the
	// joined equipment name can come back null — recover it the same way the
	// Borrowing screen does.
	const { supplyNameById } = useBorrowCandidates(user)

	return (
		<EntityTablePage<BorrowRecordRow>
			title="History"
			subtitle={`${myRecords?.length ?? 0} borrowed items`}
			rows={myRecords}
			isLoading={isLoading}
			error={loadError}
			searchKeys={['status']}
			emptyMessage="You have not borrowed any items yet. Go to Inventory Items and use the Borrow button to request one."
			columns={[
				{
					header: 'Item',
					render: (row) => (
						<span className="font-medium text-text-primary">
							{row.equipment?.equipment_name ?? supplyNameById.get(row.equipment_id) ?? '—'}
						</span>
					),
				},
				{ header: 'Department', render: (row) => row.departments?.name ?? 'Supply Office' },
				{ header: 'Requested', render: (row) => formatDate(row.created_at) },
				{ header: 'Due', render: (row) => formatDate(row.expected_return_date) },
				{ header: 'Returned', render: (row) => formatDate(row.actual_return_date) },
				{ header: 'Condition', render: (row) => row.condition_after ?? '—' },
				{ header: 'Status', render: (row) => <StatusChip tone={statusTone[row.status] ?? 'muted'}>{row.status.replace('_', ' ')}</StatusChip> },
			]}
		/>
	)
}
