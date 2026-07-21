import { useEffect, useRef, useState } from 'react'
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
	const [itemSearch, setItemSearch] = useState('')
	const [itemDropdownOpen, setItemDropdownOpen] = useState(false)
	const itemPickerRef = useRef<HTMLDivElement>(null)
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

	// New Request search: filters the item picker by name or asset code so
	// dean/admin users (and everyone else) can find an item instantly instead
	// of scrolling a long dropdown.
	const searchTerm = itemSearch.trim().toLowerCase()
	const matchesSearch = (item: { equipment_name: string; equipment_code: string }) =>
		!searchTerm || item.equipment_name.toLowerCase().includes(searchTerm) || item.equipment_code.toLowerCase().includes(searchTerm)
	const filteredMainSupply = mainSupplyAvailable.filter(matchesSearch)
	const filteredDepartmentAvailable = departmentAvailable.filter(matchesSearch)
	const hasSearchResults = filteredMainSupply.length + filteredDepartmentAvailable.length > 0

	const selectItem = (id: number, label: string) => {
		setEquipmentId(String(id))
		setItemSearch(label)
		setItemDropdownOpen(false)
	}

	useEffect(() => {
		if (!itemDropdownOpen) return

		const handlePointerDown = (event: PointerEvent) => {
			if (itemPickerRef.current && !itemPickerRef.current.contains(event.target as Node)) {
				setItemDropdownOpen(false)
			}
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setItemDropdownOpen(false)
		}

		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [itemDropdownOpen])

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
		if (!equipmentId) {
			setError('Please select an item to borrow.')
			return
		}
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
			setItemSearch('')
			setItemDropdownOpen(false)
			setExpectedReturnDate('')
			setNotes('')
			setOpen(false)
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to submit borrow request.'))
		}
	}

	const closeRequestModal = () => {
		setOpen(false)
		setItemSearch('')
		setItemDropdownOpen(false)
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

			<Modal open={open} onClose={closeRequestModal} title="New Borrow Request">
				<form className="space-y-4" onSubmit={handleSubmit}>
					{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
					<div className="relative" ref={itemPickerRef}>
						<label className={labelClass} htmlFor="borrow-item-search">
							Item
						</label>
						<input
							id="borrow-item-search"
							type="text"
							autoComplete="off"
							value={itemSearch}
							onChange={(event) => {
								setItemSearch(event.target.value)
								setEquipmentId('')
								setItemDropdownOpen(true)
							}}
							onFocus={() => setItemDropdownOpen(true)}
							className={inputClass}
							placeholder="Search by item name or asset code…"
						/>
						{itemDropdownOpen ? (
							<div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
								{!hasSearchResults ? (
									<p className="px-3 py-2 text-sm text-text-muted">No items match your search</p>
								) : (
									<>
										{filteredMainSupply.length > 0 ? (
											<div>
												<p className="bg-bg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
													Supply Office · {filteredMainSupply.length} available
												</p>
												{filteredMainSupply.map((item) => (
													<button
														key={item.id}
														type="button"
														onClick={() => selectItem(item.id, `${item.equipment_name} (${item.equipment_code})`)}
														className="block w-full px-3 py-2 text-left text-sm text-text-primary transition hover:bg-primary-light"
													>
														{item.equipment_name} ({item.equipment_code}) · {item.available_units} of {item.quantity} free
													</button>
												))}
											</div>
										) : null}
										{filteredDepartmentAvailable.length > 0 ? (
											<div>
												<p className="bg-bg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
													{user.department || 'My Department'} · {filteredDepartmentAvailable.length} available
												</p>
												{filteredDepartmentAvailable.map((item) => (
													<button
														key={item.id}
														type="button"
														onClick={() => selectItem(item.id, `${item.equipment_name} (${item.equipment_code})`)}
														className="block w-full px-3 py-2 text-left text-sm text-text-primary transition hover:bg-primary-light"
													>
														{item.equipment_name} ({item.equipment_code}) · {freeUnits(item)} of {item.quantity} free
													</button>
												))}
											</div>
										) : null}
									</>
								)}
							</div>
						) : null}
						<p className="mt-1.5 text-xs text-text-muted">
							{mainSupplyAvailable.length > 0
								? 'Supply Office requests are approved by the Super Admin; department items by your department admin.'
								: 'Requests are approved by your department admin.'}
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
