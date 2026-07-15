import { useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import { useBorrowRecords, useCancelBorrowRecord, useCreateBorrowRecord, useEquipment, useMainSupplyEquipment, useRunOverdueCheck, useUpdateBorrowRecordStatus } from '@/backend/lib/supabase/queries'
import type { BorrowRecordRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'
import { getErrorMessage } from '@/backend/lib/errors'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

const statusTone: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
	pending: 'warning',
	confirmed: 'info',
	borrowed: 'info',
	return_requested: 'warning',
	returned: 'success',
	overdue: 'danger',
	rejected: 'danger',
}

export default function BorrowingPage({ user }: { user: SchoolUser }) {
	const { data, isLoading } = useBorrowRecords()
	const { data: equipment } = useEquipment()
	const createBorrowRecord = useCreateBorrowRecord()
	const updateStatus = useUpdateBorrowRecordStatus()
	const runOverdueCheck = useRunOverdueCheck()

	const canApprove = user.role === 'super_admin' || user.role === 'department_admin'
	// Local-time YYYY-MM-DD; used as the date input's min and for validation.
	const today = new Date().toLocaleDateString('en-CA')

	const [open, setOpen] = useState(false)
	const [equipmentId, setEquipmentId] = useState('')
	const [expectedReturnDate, setExpectedReturnDate] = useState('')
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)
	const [overdueMessage, setOverdueMessage] = useState<string | null>(null)
	// Return flow: which record is being returned, and in what condition.
	const [returnTarget, setReturnTarget] = useState<BorrowRecordRow | null>(null)
	const [returnCondition, setReturnCondition] = useState('Good')

	// New Request draws from both sources at once: the Supply Office (Main
	// Supply / super-admin central inventory, served by an edge function so it
	// works for every role regardless of RLS) and the borrower's own department.
	const { data: mainSupply } = useMainSupplyEquipment()
	const mainSupplyAvailable = mainSupply?.filter((item) => item.status === 'available' && item.available_units > 0) ?? []
	// Units out per department item, counted from the borrow records this user
	// can see (department scoping already covers the whole department).
	const activeStatuses = new Set(['confirmed', 'borrowed', 'return_requested', 'overdue'])
	const unitsOutById = new Map<number, number>()
	for (const record of data ?? []) {
		if (activeStatuses.has(record.status)) {
			unitsOutById.set(record.equipment_id, (unitsOutById.get(record.equipment_id) ?? 0) + 1)
		}
	}
	const freeUnits = (item: { id: number; quantity: number }) => Math.max((item.quantity ?? 1) - (unitsOutById.get(item.id) ?? 0), 0)
	const departmentAvailable = user.departmentId
		? equipment?.filter((item) => item.department_id === user.departmentId && item.status === 'available' && freeUnits(item) > 0) ?? []
		: []
	const availableEquipment = [...mainSupplyAvailable, ...departmentAvailable]
	const canRequest = availableEquipment.length > 0
	// Staff can't read Supply Office equipment rows directly, so the joined
	// equipment name on their own requests may be RLS-hidden — recover it here.
	const mainSupplyNameById = new Map((mainSupply ?? []).map((item) => [item.id, item.equipment_name]))

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

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		if (expectedReturnDate && expectedReturnDate < today) {
			setError('The expected return date cannot be in the past. Please choose today or a future date.')
			return
		}
		try {
			// The borrow-status function enforces the full rule set server-side
			// (date window, unit availability, duplicate guard, borrow cap) and
			// notifies the right approvers.
			await createBorrowRecord.mutateAsync({
				equipment_id: Number(equipmentId),
				expected_return_date: expectedReturnDate || null,
				notes: notes || null,
			})
			setEquipmentId('')
			setExpectedReturnDate('')
			setNotes('')
			setOpen(false)
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to submit borrow request.'))
		}
	}

	return (
		<>
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
				searchKeys={['status']}
				emptyMessage="No borrow requests yet."
				emptyAction={
					<Button size="sm" onClick={() => setOpen(true)} disabled={!canRequest}>
						{canRequest ? 'Submit the first request' : 'No items available to request'}
					</Button>
				}
				action={
					<div className="flex flex-wrap gap-2">
						{user.role === 'super_admin' ? (
							<Button size="sm" variant="secondary" onClick={handleOverdueCheck} disabled={runOverdueCheck.isPending}>
								{runOverdueCheck.isPending ? 'Checking…' : 'Check Overdue Now'}
							</Button>
						) : null}
						<Button size="sm" onClick={() => setOpen(true)} disabled={!canRequest}>
							New Request
						</Button>
					</div>
				}
				columns={[
					{
						header: 'Item',
						render: (row) => (
							<div>
								<p className="font-medium text-text-primary">{row.equipment?.equipment_name ?? mainSupplyNameById.get(row.equipment_id) ?? '—'}</p>
								<p className="text-xs text-text-muted">{row.borrower?.full_name ?? '—'}</p>
							</div>
						),
					},
					{ header: 'Department', render: (row) => row.departments?.name ?? 'Supply Office' },
					{ header: 'Due', render: (row) => (row.expected_return_date ? new Date(row.expected_return_date).toLocaleDateString() : '—') },
					{ header: 'Status', render: (row) => <StatusChip tone={statusTone[row.status] ?? 'muted'}>{row.status.replace('_', ' ')}</StatusChip> },
					{
						header: 'Actions',
						render: (row) =>
							canApprove && row.status === 'pending' ? (
								<div className="flex gap-2">
									<Button size="sm" variant="secondary" onClick={() => runStatusChange(row.id, 'confirmed')}>
										Approve
									</Button>
									<Button size="sm" variant="danger" onClick={() => runStatusChange(row.id, 'rejected')}>
										Reject
									</Button>
								</div>
							) : canApprove && (row.status === 'confirmed' || row.status === 'borrowed' || row.status === 'overdue') ? (
								<Button size="sm" variant="secondary" onClick={() => { setReturnCondition('Good'); setReturnTarget(row) }}>
									Mark Returned
								</Button>
							) : row.status === 'pending' && row.borrower_id === user.id ? (
								<Button size="sm" variant="danger" onClick={() => runCancel(row.id)} disabled={cancelRequest.isPending}>
									{cancelRequest.isPending ? 'Cancelling…' : 'Cancel'}
								</Button>
							) : (
								'—'
							),
					},
				]}
			/>

			<Modal open={open} onClose={() => setOpen(false)} title="New Borrow Request">
				<form className="space-y-4" onSubmit={handleSubmit}>
					{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
					<div>
						<label className={labelClass} htmlFor="borrow-equipment">
							Item
						</label>
						<select id="borrow-equipment" value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} className={inputClass} required>
							<option value="" disabled>
								Select an item
							</option>
							{mainSupplyAvailable.length > 0 ? (
								<optgroup label={`Supply Office · ${mainSupplyAvailable.length} available`}>
									{mainSupplyAvailable.map((item) => (
										<option key={item.id} value={item.id}>
											{item.equipment_name} ({item.equipment_code}) · {item.available_units} of {item.quantity} free
										</option>
									))}
								</optgroup>
							) : null}
							{departmentAvailable.length > 0 ? (
								<optgroup label={`${user.department || 'My Department'} · ${departmentAvailable.length} available`}>
									{departmentAvailable.map((item) => (
										<option key={item.id} value={item.id}>
											{item.equipment_name} ({item.equipment_code}) · {freeUnits(item)} of {item.quantity} free
										</option>
									))}
								</optgroup>
							) : null}
						</select>
						<p className="mt-1.5 text-xs text-text-muted">
							Supply Office requests are approved by the Super Admin; department items by your department admin.
						</p>
					</div>
					<div>
						<label className={labelClass} htmlFor="borrow-due">
							Expected Return Date
						</label>
						<input id="borrow-due" type="date" min={today} value={expectedReturnDate} onChange={(event) => setExpectedReturnDate(event.target.value)} className={inputClass} />
					</div>
					<div>
						<label className={labelClass} htmlFor="borrow-notes">
							Notes
						</label>
						<input id="borrow-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder="Optional" />
					</div>
					<Button type="submit" className="w-full" disabled={createBorrowRecord.isPending}>
						{createBorrowRecord.isPending ? 'Submitting…' : 'Submit Request'}
					</Button>
				</form>
			</Modal>

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
