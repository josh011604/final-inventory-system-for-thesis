import EntityTablePage from '@/components/ui/EntityTablePage'
import StatusChip from '@/components/ui/StatusChip'
import { useBorrowCandidates } from '@/frontend/features/borrowing/useBorrowCandidates'
import { statusTone, formatDate } from '@/frontend/features/borrowing/borrowDisplay'
import { useBorrowRecords } from '@/backend/lib/supabase/queries'
import type { BorrowRecordRow } from '@/backend/lib/supabase/queries'
import type { Role, SchoolUser } from '@/backend/types/school'
import { roleLabels } from '@/backend/lib/rbac'

// Stored role value -> the label users see ('staff' displays as "Faculty").
// Falls back to the raw value for a role the labels map does not know.
function roleLabel(role: string | null): string {
	if (!role) return 'Unknown role'
	return roleLabels[role as Role] ?? role
}

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
				{ header: 'Qty', render: (row) => row.quantity ?? 1 },
				{ header: 'Borrowed', render: (row) => formatDate(row.borrowed_date ?? row.created_at) },
				{ header: 'Due', render: (row) => formatDate(row.expected_return_date) },
				{
					// Name, authority and timestamp together — an approval record that
					// only says "who" is not enough to audit after the fact.
					header: 'Approved by',
					render: (row) =>
						row.approved_by_name ? (
							<span>
								<span className="block text-text-primary">{row.approved_by_name}</span>
								<span className="block text-xs text-text-muted">
									{roleLabel(row.approved_by_role)}
									{row.approved_at ? ` · ${formatDate(row.approved_at)}` : ''}
								</span>
							</span>
						) : (
							'—'
						),
				},
				{
					header: 'Returned',
					render: (row) =>
						row.actual_return_date ? (
							<span>
								<span className="block text-text-primary">{formatDate(row.actual_return_date)}</span>
								{row.returned_by_name ? <span className="block text-xs text-text-muted">by {row.returned_by_name}</span> : null}
							</span>
						) : (
							'—'
						),
				},
				{
					// Both ends of the item's condition: what it was when it went out,
					// and what it came back as (blank until returned).
					header: 'Condition',
					render: (row) => (
						<span>
							<span className="block text-text-primary">{row.condition_before ?? '—'}</span>
							{row.condition_after ? <span className="block text-xs text-text-muted">returned: {row.condition_after}</span> : null}
						</span>
					),
				},
				{ header: 'Status', render: (row) => <StatusChip tone={statusTone[row.status] ?? 'muted'}>{row.status.replace('_', ' ')}</StatusChip> },
			]}
		/>
	)
}
