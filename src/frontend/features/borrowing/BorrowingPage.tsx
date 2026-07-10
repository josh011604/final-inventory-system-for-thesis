import { useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import { useBorrowRecords, useCreateBorrowRecord, useEquipment, useUpdateBorrowRecordStatus } from '@/backend/lib/supabase/queries'
import type { BorrowRecordRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'

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

	const canApprove = user.role === 'super_admin' || user.role === 'department_admin'
	const availableEquipment = equipment?.filter((item) => item.status === 'available') ?? []

	const [open, setOpen] = useState(false)
	const [equipmentId, setEquipmentId] = useState('')
	const [expectedReturnDate, setExpectedReturnDate] = useState('')
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		try {
			await createBorrowRecord.mutateAsync({
				equipment_id: Number(equipmentId),
				borrower_id: user.id,
				created_by: user.id,
				department_id: user.departmentId,
				expected_return_date: expectedReturnDate || null,
				notes: notes || null,
				status: 'pending',
			})
			setEquipmentId('')
			setExpectedReturnDate('')
			setNotes('')
			setOpen(false)
		} catch (mutationError) {
			setError(mutationError instanceof Error ? mutationError.message : 'Failed to submit borrow request.')
		}
	}

	return (
		<>
			<EntityTablePage<BorrowRecordRow>
				title="Borrowing"
				subtitle={`${data?.length ?? 0} requests`}
				rows={data}
				isLoading={isLoading}
				searchKeys={['status']}
				emptyMessage="No borrow requests yet."
				emptyAction={
					<Button size="sm" onClick={() => setOpen(true)} disabled={availableEquipment.length === 0}>
						{availableEquipment.length === 0 ? 'No available equipment yet' : 'Submit the first request'}
					</Button>
				}
				action={
					<Button size="sm" onClick={() => setOpen(true)} disabled={availableEquipment.length === 0}>
						New Request
					</Button>
				}
				columns={[
					{
						header: 'Item',
						render: (row) => (
							<div>
								<p className="font-medium text-text-primary">{row.equipment?.equipment_name ?? '—'}</p>
								<p className="text-xs text-text-muted">{row.borrower?.full_name ?? '—'}</p>
							</div>
						),
					},
					{ header: 'Department', render: (row) => row.departments?.name ?? '—' },
					{ header: 'Due', render: (row) => (row.expected_return_date ? new Date(row.expected_return_date).toLocaleDateString() : '—') },
					{ header: 'Status', render: (row) => <StatusChip tone={statusTone[row.status] ?? 'muted'}>{row.status.replace('_', ' ')}</StatusChip> },
					{
						header: 'Actions',
						render: (row) =>
							canApprove && row.status === 'pending' ? (
								<div className="flex gap-2">
									<Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: row.id, status: 'confirmed', approvedBy: user.id })}>
										Approve
									</Button>
									<Button size="sm" variant="danger" onClick={() => updateStatus.mutate({ id: row.id, status: 'rejected', approvedBy: user.id })}>
										Reject
									</Button>
								</div>
							) : canApprove && (row.status === 'confirmed' || row.status === 'borrowed') ? (
								<Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: row.id, status: 'returned' })}>
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
							{availableEquipment.map((item) => (
								<option key={item.id} value={item.id}>
									{item.equipment_name} ({item.equipment_code})
								</option>
							))}
						</select>
					</div>
					<div>
						<label className={labelClass} htmlFor="borrow-due">
							Expected Return Date
						</label>
						<input id="borrow-due" type="date" value={expectedReturnDate} onChange={(event) => setExpectedReturnDate(event.target.value)} className={inputClass} />
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
