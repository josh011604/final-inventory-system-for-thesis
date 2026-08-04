import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useCreateBorrowRecord } from '@/backend/lib/supabase/queries'
import { useBorrowCandidates } from '@/frontend/features/borrowing/useBorrowCandidates'
import type { BorrowCandidate } from '@/frontend/features/borrowing/useBorrowCandidates'
import type { SchoolUser } from '@/backend/types/school'
import { getErrorMessage } from '@/backend/lib/errors'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

const candidateLabel = (item: BorrowCandidate) => `${item.equipment_name} (${item.equipment_code})`

type BorrowRequestModalProps = {
	open: boolean
	onClose: () => void
	user: SchoolUser
	// When set, the modal opens locked to that item — this is what the Inventory
	// screen's per-row Borrow button uses, so the user never has to re-find the
	// item they just clicked. Passed whole rather than looked up by id, because
	// the caller may be showing an item outside this user's own department
	// (the super admin's cross-department inventory view).
	presetItem?: BorrowCandidate | null
	onSubmitted?: () => void
}

export default function BorrowRequestModal({ open, onClose, user, presetItem = null, onSubmitted }: BorrowRequestModalProps) {
	const createBorrowRecord = useCreateBorrowRecord()
	const { supply, department } = useBorrowCandidates(user)

	// Local-time YYYY-MM-DD; used as the date input's min and for validation.
	const today = new Date().toLocaleDateString('en-CA')

	const [equipmentId, setEquipmentId] = useState('')
	const [itemSearch, setItemSearch] = useState('')
	const [itemDropdownOpen, setItemDropdownOpen] = useState(false)
	const itemPickerRef = useRef<HTMLDivElement>(null)
	const [quantity, setQuantity] = useState('1')
	const [expectedReturnDate, setExpectedReturnDate] = useState('')
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)

	const isPreset = presetItem != null
	const presetId = presetItem?.id ?? null

	// Re-seed the form every time the modal opens, so a preset item from a
	// different row never shows the previous row's selection.
	useEffect(() => {
		if (!open) return
		setError(null)
		setQuantity('1')
		setExpectedReturnDate('')
		setNotes('')
		setItemDropdownOpen(false)
		setEquipmentId(presetId != null ? String(presetId) : '')
		setItemSearch('')
	}, [open, presetId])

	// The item currently selected (preset row, or one picked from the dropdown),
	// so the quantity input can cap itself at that item's free units.
	const selectedCandidate = presetItem ?? [...supply, ...department].find((item) => String(item.id) === equipmentId) ?? null
	const maxUnits = Math.max(selectedCandidate?.freeUnits ?? 1, 1)

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

	const searchTerm = itemSearch.trim().toLowerCase()
	// Picking an item writes its label into the search box, so reopening the list
	// to change your mind would otherwise filter by that whole label — which
	// matches no item's name or code, leaving an empty dropdown. Treat "the box
	// still holds exactly what I picked" as not-searching, so browsing back opens
	// the full grouped list. Typing anything else resumes normal filtering.
	const browsingSelection = selectedCandidate != null && searchTerm === candidateLabel(selectedCandidate).toLowerCase()
	const matchesSearch = (item: BorrowCandidate) =>
		!searchTerm || browsingSelection || item.equipment_name.toLowerCase().includes(searchTerm) || item.equipment_code.toLowerCase().includes(searchTerm)
	const filteredSupply = supply.filter(matchesSearch)
	const filteredDepartment = department.filter(matchesSearch)
	const hasSearchResults = filteredSupply.length + filteredDepartment.length > 0

	// Departmental stock is grouped by its owning department rather than listed
	// as one long mixed run — with every department's items offered here, a flat
	// list makes finding another department's item needlessly hard. Your own
	// department comes first (the common case), the rest follow alphabetically,
	// and Supply Office is rendered separately below as the extra pool that
	// faculty, department admins and the super admin get on top. Students see
	// department groups only: useBorrowCandidates never gives them a supply list.
	const departmentGroups = useMemo(() => {
		const groups = new Map<string, BorrowCandidate[]>()
		for (const item of filteredDepartment) {
			const name = item.departmentName?.trim() || 'Other department'
			const existing = groups.get(name)
			if (existing) existing.push(item)
			else groups.set(name, [item])
		}
		const ownDepartment = user.department?.trim()
		return [...groups.entries()].sort(([a], [b]) => {
			if (ownDepartment) {
				if (a === ownDepartment) return -1
				if (b === ownDepartment) return 1
			}
			return a.localeCompare(b)
		})
	}, [filteredDepartment, user.department])

	const selectItem = (item: BorrowCandidate) => {
		setEquipmentId(String(item.id))
		setItemSearch(candidateLabel(item))
		setItemDropdownOpen(false)
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		if (!equipmentId) {
			setError('Please select an item to borrow.')
			return
		}
		const requestedQuantity = Number(quantity)
		if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
			setError('Enter how many units you want to borrow (at least 1).')
			return
		}
		if (requestedQuantity > maxUnits) {
			setError(`Only ${maxUnits} unit${maxUnits === 1 ? '' : 's'} of this item ${maxUnits === 1 ? 'is' : 'are'} available.`)
			return
		}
		// Required for every borrower, whatever their role: without a due date
		// nothing can go overdue, so the overdue sweep, the borrow penalty and the
		// "still out" reports all have nothing to measure against.
		if (!expectedReturnDate) {
			setError('Please choose an expected return date. A borrow request cannot be submitted without one.')
			return
		}
		if (expectedReturnDate < today) {
			setError('The expected return date cannot be in the past. Please choose today or a future date.')
			return
		}
		try {
			// The borrow-status function enforces the full rule set server-side
			// (date window, unit availability, duplicate guard, borrow cap) and
			// notifies the right approvers.
			await createBorrowRecord.mutateAsync({
				equipment_id: Number(equipmentId),
				quantity: requestedQuantity,
				expected_return_date: expectedReturnDate,
				notes: notes || null,
			})
			onSubmitted?.()
			onClose()
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to submit borrow request.'))
		}
	}

	return (
		<Modal open={open} onClose={onClose} title="New Borrow Request">
			<form className="space-y-4" onSubmit={handleSubmit}>
				{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

				{isPreset ? (
					// Locked to the row the user clicked in Inventory.
					<div>
						<span className={labelClass}>Item</span>
						<div className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary">
							<span className="font-medium">{presetItem.equipment_name}</span>{' '}
							<span className="text-text-muted">
								({presetItem.equipment_code}){presetItem.departmentName ? ` · ${presetItem.departmentName}` : ''} · {presetItem.freeUnits} of {presetItem.quantity} free
							</span>
						</div>
					</div>
				) : (
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
										{/* One block per owning department. The header names the
										    department, so the rows below it do not repeat it. */}
										{departmentGroups.map(([departmentName, items]) => (
											<div key={`dept-group-${departmentName}`}>
												<p className="sticky top-0 bg-bg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
													{departmentName}
													{departmentName === user.department?.trim() ? ' (yours)' : ''} · {items.length} available
												</p>
												{items.map((item) => (
													<button
														key={`dept-${item.id}`}
														type="button"
														onClick={() => selectItem(item)}
														className="block w-full px-3 py-2 text-left text-sm text-text-primary transition hover:bg-primary-light"
													>
														{item.equipment_name} ({item.equipment_code}) · {item.freeUnits} of {item.quantity} free
													</button>
												))}
											</div>
										))}
										{/* Last, and only for those who get it: students never receive a
										    supply list, so this block simply never renders for them. */}
										{filteredSupply.length > 0 ? (
											<div>
												<p className="sticky top-0 bg-bg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
													Supply Office · {filteredSupply.length} available
												</p>
												{filteredSupply.map((item) => (
													<button
														key={`supply-${item.id}`}
														type="button"
														onClick={() => selectItem(item)}
														className="block w-full px-3 py-2 text-left text-sm text-text-primary transition hover:bg-primary-light"
													>
														{item.equipment_name} ({item.equipment_code}) · {item.freeUnits} of {item.quantity} free
													</button>
												))}
											</div>
										) : null}
									</>
								)}
							</div>
						) : null}
						<p className="mt-1.5 text-xs text-text-muted">
							{user.role === 'student'
								? // A student may request any department's stock, so the approver is
									// the admin or faculty of the ITEM's department, not always their own.
									"Requests are approved by the admin or faculty of the item's department."
								: supply.length > 0
									? "Supply Office requests are approved by the Super Admin; department items by that department's admin."
									: "Department items are approved by that department's admin."}
						</p>
					</div>
				)}

				<div>
					<label className={labelClass} htmlFor="borrow-quantity">
						Quantity
					</label>
					<input
						id="borrow-quantity"
						type="number"
						min={1}
						max={maxUnits}
						value={quantity}
						onChange={(event) => setQuantity(event.target.value)}
						className={inputClass}
					/>
					<p className="mt-1.5 text-xs text-text-muted">
						{selectedCandidate ? `${maxUnits} unit${maxUnits === 1 ? '' : 's'} available to borrow.` : 'Select an item to set how many units you need.'}
					</p>
				</div>

				<div>
					<label className={labelClass} htmlFor="borrow-due">
						Expected Return Date <span className="text-danger">*</span>
					</label>
					<input
						id="borrow-due"
						type="date"
						min={today}
						value={expectedReturnDate}
						onChange={(event) => setExpectedReturnDate(event.target.value)}
						className={inputClass}
						required
						aria-required="true"
					/>
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
	)
}
