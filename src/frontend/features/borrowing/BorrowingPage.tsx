import { useState } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import BorrowRequestModal from '@/frontend/features/borrowing/BorrowRequestModal'
import { useBorrowCandidates } from '@/frontend/features/borrowing/useBorrowCandidates'
import { statusTone } from '@/frontend/features/borrowing/borrowDisplay'
import { useBorrowRecords, useCancelBorrowRecord, useRunOverdueCheck, useUpdateBorrowRecordStatus } from '@/backend/lib/supabase/queries'
import type { BorrowRecordRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'
import { getErrorMessage } from '@/backend/lib/errors'
import { borrowPenaltyReason, canApproveBorrow, canReturnBorrow, isSelfBorrowRequest } from '@/backend/lib/borrowing'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

export default function BorrowingPage({ user }: { user: SchoolUser }) {
	const { data, isLoading, error: loadError } = useBorrowRecords()
	const updateStatus = useUpdateBorrowRecordStatus()
	const runOverdueCheck = useRunOverdueCheck()

	// The signed-in user as a potential approver; each row is checked against it.
	const approver = { id: user.id, role: user.role, departmentId: user.departmentId }
	// borrower_role is denormalized onto the row (not joined from profiles) so a
	// faculty viewer can actually read it — their Approve button for a student's
	// request depends on it, and the profiles policy hides other users' rows.
	const asRecord = (row: BorrowRecordRow) => ({
		department_id: row.department_id,
		borrower_id: row.borrower_id,
		borrower_role: row.borrower_role ?? null,
	})

	const [open, setOpen] = useState(false)
	const [actionError, setActionError] = useState<string | null>(null)
	const [overdueMessage, setOverdueMessage] = useState<string | null>(null)
	// Return flow: which record is being returned, and in what condition.
	const [returnTarget, setReturnTarget] = useState<BorrowRecordRow | null>(null)
	const [returnCondition, setReturnCondition] = useState('Good')

	// Shared with the Inventory screen's per-item Borrow button so both offer
	// exactly the same set of requestable items.
	const { all: availableEquipment, supplyNameById: mainSupplyNameById } = useBorrowCandidates(user)
	// Overdue-borrow penalty: an unreturned overdue item blocks all new requests
	// (super admin exempt). Takes priority over "nothing available".
	const penaltyReason = borrowPenaltyReason(data ?? [], user)
	const canRequest = availableEquipment.length > 0 && !penaltyReason

	const handleOverdueCheck = () => {
		setActionError(null)
		setOverdueMessage(null)
		runOverdueCheck.mutate(undefined, {
			onSuccess: (result) =>
				setOverdueMessage(
					result.flagged > 0
						? `Flagged ${result.flagged} overdue ${result.flagged === 1 ? 'item' : 'items'}. Borrowers have been notified.`
						: 'No overdue items — every borrowed item is within its return date.',
				),
			onError: (mutationError) =>
				setActionError(getErrorMessage(mutationError, 'Failed to run the overdue check.')),
		})
	}

	const runStatusChange = (id: number, status: string, condition?: string) => {
		setActionError(null)
		updateStatus.mutate(
			{ id, status, condition },
			{ onError: (mutationError) => setActionError(getErrorMessage(mutationError, 'Failed to update borrow request.')) },
		)
	}

	const cancelRequest = useCancelBorrowRecord()
	const runCancel = (id: number) => {
		setActionError(null)
		cancelRequest.mutate(id, {
			onError: (mutationError) => setActionError(getErrorMessage(mutationError, 'Failed to cancel the request.')),
		})
	}

	const confirmReturn = () => {
		if (!returnTarget) return
		runStatusChange(returnTarget.id, 'returned', returnCondition)
		setReturnTarget(null)
		setReturnCondition('Good')
	}

	return (
		<>
			{penaltyReason ? (
				<div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
					{penaltyReason} New requests are disabled until it is returned.
				</div>
			) : null}
			{actionError ? (
				<div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{actionError}</div>
			) : null}
			{overdueMessage ? (
				<div className="mb-4 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-info">{overdueMessage}</div>
			) : null}
			<EntityTablePage<BorrowRecordRow>
				title="Borrowing"
				subtitle={`${data?.length ?? 0} requests`}
				rows={data}
				isLoading={isLoading}
				error={loadError}
				searchKeys={['status']}
				emptyMessage="No borrow requests yet."
				emptyAction={
					<Button size="sm" onClick={() => setOpen(true)} disabled={!canRequest} title={penaltyReason ?? undefined}>
						{canRequest ? 'Submit the first request' : penaltyReason ? 'Return your overdue item first' : 'No items available to request'}
					</Button>
				}
				action={
					<div className="flex flex-wrap gap-2">
						{user.role === 'super_admin' ? (
							<Button size="sm" variant="secondary" onClick={handleOverdueCheck} disabled={runOverdueCheck.isPending}>
								{runOverdueCheck.isPending ? 'Checking…' : 'Check Overdue Now'}
							</Button>
						) : null}
						<Button size="sm" onClick={() => setOpen(true)} disabled={!canRequest} title={penaltyReason ?? undefined}>
							New Request
						</Button>
					</div>
				}
				columns={[
					{
						header: 'Item',
						render: (row) => (
							<div>
								<p className="font-medium text-text-primary">
									{row.equipment?.equipment_name ?? mainSupplyNameById.get(row.equipment_id) ?? '—'}
									{(row.quantity ?? 1) > 1 ? <span className="ml-1.5 text-xs font-semibold text-text-muted">× {row.quantity}</span> : null}
								</p>
								<p className="text-xs text-text-muted">{row.borrower_name ?? '—'}</p>
							</div>
						),
					},
					{ header: 'Department', render: (row) => row.departments?.name ?? 'Supply Office' },
					{ header: 'Qty', render: (row) => row.quantity ?? 1 },
					{ header: 'Due', render: (row) => (row.expected_return_date ? new Date(row.expected_return_date).toLocaleDateString() : '—') },
					{
						// Who approved the request, and when — recorded so a borrow can
						// always be traced back to the person who authorized it. An
						// auto-approved request is stamped with the borrower's own name
						// (they held the approval authority), so it is labelled as such
						// rather than reading like someone rubber-stamped themselves.
						header: 'Approved by',
						render: (row) =>
							row.approved_by_name ? (
								<span>
									<span className="block text-text-primary">
										{row.approved_by_name}
										{row.approved_by && row.approved_by === row.borrower_id ? (
											<span className="ml-1 text-xs font-normal text-text-muted">· auto</span>
										) : null}
									</span>
									<span className="block text-xs text-text-muted">
										{row.approved_at ? new Date(row.approved_at).toLocaleDateString() : ''}
									</span>
								</span>
							) : (
								'—'
							),
					},
					{ header: 'Status', render: (row) => <StatusChip tone={statusTone[row.status] ?? 'muted'}>{row.status.replace('_', ' ')}</StatusChip> },
					{
						header: 'Actions',
						render: (row) =>
							// Own pending request always takes priority, even for an approver —
							// otherwise a department/super admin would see Approve/Reject on
							// their own row and could rubber-stamp themselves.
							row.status === 'pending' && isSelfBorrowRequest(row, user.id) ? (
								<Button size="sm" variant="danger" onClick={() => runCancel(row.id)} disabled={cancelRequest.isPending}>
									{cancelRequest.isPending ? 'Cancelling…' : 'Cancel'}
								</Button>
							) : row.status === 'pending' && canApproveBorrow(asRecord(row), approver) ? (
								<div className="flex gap-2">
									<Button size="sm" variant="secondary" onClick={() => runStatusChange(row.id, 'confirmed')}>
										Approve
									</Button>
									<Button size="sm" variant="danger" onClick={() => runStatusChange(row.id, 'rejected')}>
										Reject
									</Button>
								</div>
							) : (row.status === 'confirmed' || row.status === 'borrowed' || row.status === 'overdue') && canReturnBorrow(asRecord(row), approver) ? (
								<Button size="sm" variant="secondary" onClick={() => { setReturnCondition('Good'); setReturnTarget(row) }}>
									Mark Returned
								</Button>
							) : (
								'—'
							),
					},
				]}
			/>

			<BorrowRequestModal open={open} onClose={() => setOpen(false)} user={user} />

			{returnTarget ? (
				<Modal open onClose={() => setReturnTarget(null)} title="Mark as Returned">
					<div className="space-y-4">
						<p className="text-sm text-text-muted">
							Returning <span className="font-medium text-text-primary">{returnTarget.equipment?.equipment_name ?? mainSupplyNameById.get(returnTarget.equipment_id) ?? `request #${returnTarget.id}`}</span>. What
							condition is the item in?
						</p>
						<div>
							<label className={labelClass} htmlFor="return-condition">
								Condition on return
							</label>
							<select id="return-condition" value={returnCondition} onChange={(event) => setReturnCondition(event.target.value)} className={inputClass}>
								{['Excellent', 'Good', 'Fair', 'Damaged'].map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
							{returnCondition === 'Damaged' ? (
								<p className="mt-1.5 text-xs text-danger">
									A damaged return flags the item and automatically opens a high-priority maintenance request.
								</p>
							) : null}
						</div>
						<div className="flex gap-2">
							<Button type="button" variant="secondary" className="flex-1" onClick={() => setReturnTarget(null)}>
								Back
							</Button>
							<Button type="button" className="flex-1" onClick={confirmReturn} disabled={updateStatus.isPending}>
								{updateStatus.isPending ? 'Saving…' : 'Confirm Return'}
							</Button>
						</div>
					</div>
				</Modal>
			) : null}
		</>
	)
}
