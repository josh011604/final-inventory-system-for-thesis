import { useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import { useBorrowRecords, useCreateBorrowRecord, useEquipment, useMainSupplyEquipment, useRunOverdueCheck, useUpdateBorrowRecordStatus } from '@/backend/lib/supabase/queries'
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

	// New Request draws from both sources at once: the Supply Office (Main
	// Supply / super-admin central inventory, served by an edge function so it
	// works for every role regardless of RLS) and the borrower's own department.
	const { data: mainSupply } = useMainSupplyEquipment()
	const mainSupplyAvailable = mainSupply?.filter((item) => item.status === 'available') ?? []
	const departmentAvailable = user.departmentId
		? equipment?.filter((item) => item.department_id === user.departmentId && item.status === 'available') ?? []
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

	const runStatusChange = (id: number, status: string) => {
		setActionError(null)
		updateStatus.mutate(
			{ id, status },
			{ onError: (mutationError) => setActionError(getErrorMessage(mutationError, 'Failed to update borrow request.')) },
		)
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		if (expectedReturnDate && expectedReturnDate < today) {
			setError('The expected return date cannot be in the past. Please choose today or a future date.')
			return
		}
		try {
			await createBorrowRecord.mutateAsync({
				equipment_id: Number(equipmentId),
				borrower_id: user.id,
				created_by: user.id,
				// Main Supply items have no department, so the request carries no
				// department and only the super admin can approve it.
				department_id: availableEquipment.find((item) => String(item.id) === equipmentId)?.department_id ?? null,
				expected_return_date: expectedReturnDate || null,
				notes: notes || null,
				status: 'pending',
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
								<Button size="sm" variant="secondary" onClick={() => runStatusChange(row.id, 'returned')}>
									Mark Returned
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
											{item.equipment_name} ({item.equipment_code})
										</option>
									))}
								</optgroup>
							) : null}
							{departmentAvailable.length > 0 ? (
								<optgroup label={`${user.department || 'My Department'} · ${departmentAvailable.length} available`}>
									{departmentAvailable.map((item) => (
										<option key={item.id} value={item.id}>
											{item.equipment_name} ({item.equipment_code})
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
		</>
	)
}
