import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, Eye } from 'lucide-react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import EquipmentHistoryModal from '@/frontend/features/inventory/EquipmentHistoryModal'
import EquipmentEditModal from '@/frontend/features/inventory/EquipmentEditModal'
import BorrowRequestModal from '@/frontend/features/borrowing/BorrowRequestModal'
import { useBorrowRecords, useCreateEquipment, useDepartments, useEquipment, useFacilities } from '@/backend/lib/supabase/queries'
import type { EquipmentRow } from '@/backend/lib/supabase/queries'
import { borrowBlockedReason, borrowPenaltyReason, borrowScopeReason, displayStatus, freeUnits, isLowStock, totalUnits, unitsOutByEquipmentId } from '@/backend/lib/borrowing'
import type { SchoolUser } from '@/backend/types/school'
import { getErrorMessage } from '@/backend/lib/errors'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

const statusTone: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
	available: 'success',
	unavailable: 'muted',
	borrowed: 'info',
	maintenance: 'warning',
	damaged: 'danger',
	lost: 'danger',
	disposed: 'muted',
}

// Sentinel department-select value meaning "no department" — i.e. the central
// Main Supply pool owned by the super admin.
const MAIN_SUPPLY = 'main-supply'

// Inventory tab keys that are not a department id.
const ALL_TAB = 'all'
const SUPPLY_TAB = 'supply'

const steps = ['Basic Info', 'Location', 'Condition & Review']

function StepIndicator({ current }: { current: number }) {
	return (
		<div className="mb-6 flex items-center">
			{steps.map((step, index) => (
				<div key={step} className="flex flex-1 items-center last:flex-none">
					<div className="flex flex-col items-center gap-1">
						<div
							className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${
								index < current
									? 'border-accent bg-accent text-white'
									: index === current
										? 'border-primary bg-primary text-white'
										: 'border-border bg-surface text-text-muted'
							}`}
						>
							{index < current ? '✓' : index + 1}
						</div>
						<span className={`whitespace-nowrap text-xs ${index === current ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>{step}</span>
					</div>
					{index < steps.length - 1 ? <div className={`mx-2 h-0.5 flex-1 ${index < current ? 'bg-accent' : 'bg-border'}`} /> : null}
				</div>
			))}
		</div>
	)
}

export default function InventoryPage({ user }: { user: SchoolUser }) {
	const { data, isLoading, error: loadError } = useEquipment()
	const { data: departments } = useDepartments()
	const { data: facilities } = useFacilities()
	const { data: borrowRecords } = useBorrowRecords()
	const createEquipment = useCreateEquipment()

	const canManage = user.role === 'super_admin' || user.role === 'department_admin'

	// Adding an item is always allowed for an admin, but EDITING one is scoped by
	// the "equipment admin write" policy to your own department (a super admin
	// excepted). Now that other departments' items are browsable here, the Edit
	// button has to be gated per row — otherwise it opens a form whose save the
	// database rejects.
	const canEditItem = (row: EquipmentRow) =>
		user.role === 'super_admin' || (user.role === 'department_admin' && row.department_id === user.departmentId)

	// Inventory is browsable across departments, one tab per department, so an
	// item belonging to another department can be found and borrowed here
	// directly; Borrowing → New Request is the second route to the same thing.
	//
	// The tabs are derived from the rows the query actually returned rather than
	// from a role check, because equipment RLS has already applied the rule: a
	// student may read every DEPARTMENTAL item but no Supply Office stock, while
	// faculty, department admins and the super admin read both. So a Supply
	// Office tab simply never materialises for a student.
	const departmentTabs = useMemo(() => {
		// Tabs are labelled with the department's SHORT name (BSCS, MIDWIFERY,
		// FISHERIES…) — the full names are far too long for a one-row control.
		// short_name is a required column that the Departments screen already
		// collects, so the label is editable there rather than guessed from the
		// full name here. The full name is kept for the subtitle, which has room.
		const shortNameById = new Map((departments ?? []).map((dept) => [dept.id, dept.short_name]))
		const byId = new Map<string, { short: string; full: string }>()
		// Counts come from the inventory data itself, so they track additions,
		// deletions and transfers without anything extra to keep in sync.
		const counts = new Map<string, number>()
		let supplyCount = 0
		for (const item of data ?? []) {
			if (item.department_id === null) {
				supplyCount += 1
				continue
			}
			if (!byId.has(item.department_id)) {
				const full = item.departments?.name ?? 'Unnamed department'
				byId.set(item.department_id, { short: shortNameById.get(item.department_id)?.trim() || full, full })
			}
			counts.set(item.department_id, (counts.get(item.department_id) ?? 0) + 1)
		}
		const hasSupply = supplyCount > 0
		// Your own department first — it is still the one you work with daily —
		// then the rest alphabetically by the label actually shown.
		const sorted = [...byId.entries()].sort(([aId, a], [bId, b]) => {
			if (user.departmentId) {
				if (aId === user.departmentId) return -1
				if (bId === user.departmentId) return 1
			}
			return a.short.localeCompare(b.short)
		})
		return { departments: sorted, hasSupply, counts, supplyCount, total: (data ?? []).length }
	}, [data, departments, user.departmentId])

	// Open on your own department; a super admin (who has none) opens on All.
	const [activeTab, setActiveTab] = useState<string>(user.departmentId ?? ALL_TAB)
	// The chosen tab can vanish — the last item in a department is deleted, or the
	// data has not loaded yet — so fall back rather than showing an empty table.
	const tabIsAvailable =
		activeTab === ALL_TAB ||
		(activeTab === SUPPLY_TAB && departmentTabs.hasSupply) ||
		departmentTabs.departments.some(([id]) => id === activeTab)
	const effectiveTab = tabIsAvailable ? activeTab : ALL_TAB

	const visibleItems = useMemo(() => {
		if (!data) return undefined
		if (effectiveTab === ALL_TAB) return data
		if (effectiveTab === SUPPLY_TAB) return data.filter((item) => item.department_id === null)
		return data.filter((item) => item.department_id === effectiveTab)
	}, [data, effectiveTab])

	// The subtitle has room for the department's full name even though the tab
	// itself is abbreviated.
	const activeTabLabel =
		effectiveTab === ALL_TAB
			? 'All items'
			: effectiveTab === SUPPLY_TAB
				? 'Supply Office'
				: departmentTabs.departments.find(([id]) => id === effectiveTab)?.[1].full ?? 'All items'

	// Per-item Borrow: how many units of each item are already out on an active
	// loan, so a row only offers Borrow when a unit is genuinely free. The
	// borrow-status edge function re-checks all of this server-side.
	const unitsOut = unitsOutByEquipmentId(borrowRecords ?? [])
	// Overdue-borrow penalty: if this user is still holding an overdue item, every
	// Borrow button is disabled until they return it (super admin is exempt).
	const penaltyReason = borrowPenaltyReason(borrowRecords ?? [], user)
	const [borrowItem, setBorrowItem] = useState<EquipmentRow | null>(null)

	const [open, setOpen] = useState(false)
	const [historyItem, setHistoryItem] = useState<EquipmentRow | null>(null)
	const [editItem, setEditItem] = useState<EquipmentRow | null>(null)
	const [step, setStep] = useState(0)
	const [equipmentCode, setEquipmentCode] = useState('')
	const [equipmentName, setEquipmentName] = useState('')
	const [category, setCategory] = useState('')
	const [departmentId, setDepartmentId] = useState(user.role === 'department_admin' ? user.departmentId ?? '' : '')
	const [facilityId, setFacilityId] = useState('')
	const [quantity, setQuantity] = useState('1')
	const [condition, setCondition] = useState('Excellent')
	const [error, setError] = useState<string | null>(null)

	// Main Supply items live in central (department-less) facilities like the
	// Supply Office; department items pick from their department's facilities.
	const facilityOptions =
		facilities?.filter((facility) =>
			departmentId === MAIN_SUPPLY ? facility.department_id === null : !departmentId || facility.department_id === departmentId,
		) ?? []
	const departmentName = departmentId === MAIN_SUPPLY ? 'Main Supply (Central Inventory)' : departments?.find((dept) => dept.id === departmentId)?.name
	const facilityName = facilityOptions.find((facility) => String(facility.id) === facilityId)?.name

	const resetForm = () => {
		setStep(0)
		setEquipmentCode('')
		setEquipmentName('')
		setCategory('')
		setFacilityId('')
		setQuantity('1')
		setCondition('Excellent')
		setError(null)
	}

	const closeModal = () => {
		setOpen(false)
		resetForm()
	}

	const handleNext = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setStep((current) => Math.min(current + 1, steps.length - 1))
	}

	const handleBack = () => setStep((current) => Math.max(current - 1, 0))

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		try {
			await createEquipment.mutateAsync({
				equipment_code: equipmentCode,
				equipment_name: equipmentName,
				category,
				department_id: departmentId === MAIN_SUPPLY ? null : departmentId || null,
				facility_id: facilityId ? Number(facilityId) : null,
				quantity: Number(quantity) || 1,
				condition,
				status: 'available',
			})
			closeModal()
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to create equipment.'))
		}
	}

	// One pill per department the user can see, plus Supply Office for those who
	// get it and an All view for searching across everything at once.
	const tabs: { key: string; label: string; title?: string; count: number }[] = [
		{ key: ALL_TAB, label: 'All', count: departmentTabs.total },
		...departmentTabs.departments.map(([id, names]) => ({
			key: id,
			label: names.short,
			// The full name on hover, so an unfamiliar abbreviation is still
			// identifiable without leaving the page.
			title: names.full,
			count: departmentTabs.counts.get(id) ?? 0,
		})),
		...(departmentTabs.hasSupply ? [{ key: SUPPLY_TAB, label: 'Supply', title: 'Supply Office', count: departmentTabs.supplyCount }] : []),
	]

	// The filled capsule behind the active tab is a single element that slides,
	// rather than a background on each button, so switching departments animates
	// instead of cutting. It is measured from the live button, which keeps it
	// correct as the counts change the label widths.
	const tabRefs = useRef(new Map<string, HTMLButtonElement>())
	const trackRef = useRef<HTMLDivElement>(null)
	const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

	useLayoutEffect(() => {
		const active = tabRefs.current.get(effectiveTab)
		if (!active) {
			setIndicator(null)
			return
		}
		const measure = () => setIndicator({ left: active.offsetLeft, width: active.offsetWidth })
		measure()
		// Re-measure when the label reflows (font swap, count going 9 -> 10) or the
		// rail itself is resized, so the capsule never drifts off its tab.
		const observer = new ResizeObserver(measure)
		observer.observe(active)
		if (trackRef.current) observer.observe(trackRef.current)
		return () => observer.disconnect()
	}, [effectiveTab, tabs.length])

	// Rendered into EntityTablePage's toolbar row so the filters and the search
	// box share one line. Hidden when there is only one group to switch between.
	const departmentFilter =
		tabs.length > 2 ? (
			<div>
				<p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Departments</p>
				{/* A single segmented control: one row that scrolls sideways rather
				    than wrapping, so the toolbar keeps a predictable height however
				    many departments exist. h-12 = the p-1 padding plus an h-10 tab. */}
				<div
					className="no-scrollbar inline-flex h-12 max-w-full items-center overflow-x-auto rounded-full border border-border bg-surface p-1 shadow-sm"
					role="group"
					aria-label="Filter inventory by department"
				>
					<div ref={trackRef} className="relative flex w-max items-center gap-1">
						{indicator ? (
							<span
								aria-hidden
								className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[transform,width] duration-200 ease-out"
								style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
							/>
						) : null}
						{tabs.map((tab) => {
							const selected = tab.key === effectiveTab
							return (
								<button
									key={tab.key}
									ref={(element) => {
										if (element) tabRefs.current.set(tab.key, element)
										else tabRefs.current.delete(tab.key)
									}}
									type="button"
									aria-pressed={selected}
									title={tab.title}
									aria-label={tab.title ? `${tab.title} · ${tab.count} items` : undefined}
									onClick={() => setActiveTab(tab.key)}
									className={`relative z-10 flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
										selected
											? // Until the capsule has been measured it cannot be shown, so
												// the active tab carries the fill itself — white-on-white
												// would otherwise be invisible for that first frame.
												`font-semibold text-white ${indicator ? '' : 'bg-primary'}`
											: 'font-medium text-text-muted hover:bg-primary-light hover:text-primary'
									}`}
								>
									{tab.label}
									<span className={selected ? 'text-white/70' : 'text-text-muted/80'}>({tab.count})</span>
								</button>
							)
						})}
					</div>
				</div>
			</div>
		) : null

	return (
		<>
			<EntityTablePage<EquipmentRow>
				toolbar={departmentFilter}
				title="Inventory Items"
				subtitle={`${activeTabLabel} · ${visibleItems?.length ?? 0} items`}
				rows={visibleItems}
				isLoading={isLoading}
				error={loadError}
				searchKeys={['equipment_code', 'equipment_name', 'category', 'status']}
				emptyMessage="No inventory items recorded yet."
				emptyAction={canManage ? <Button size="sm" onClick={() => setOpen(true)}>Add the first item</Button> : null}
				action={canManage ? <Button size="sm" onClick={() => setOpen(true)}>Add Item</Button> : undefined}
				columns={[
					{
						header: 'Asset',
						render: (row) => (
							<div>
								<p className="font-medium text-text-primary">{row.equipment_code}</p>
								<p className="text-xs text-text-muted">{row.equipment_name}</p>
							</div>
						),
					},
					{ header: 'Department', render: (row) => row.departments?.name ?? 'Main Supply' },
					{ header: 'Facility', render: (row) => row.facilities?.name ?? '—' },
					{
						header: 'Available',
						render: (row) => {
							// `free` is the stored on-hand quantity — approving a borrow for N
							// units has already subtracted N from it in the database. `total`
							// adds back what is out on loan, purely so the row can show the
							// item's full stock alongside it.
							const free = freeUnits(row)
							const total = totalUnits(row, unitsOut)
							const low = isLowStock(row, unitsOut)
							return (
								<span className="inline-flex items-center gap-1.5">
									<span className={free === 0 ? 'text-text-muted' : 'text-text-primary'}>
										{free} / {total}
									</span>
									{low ? (
										<span
											className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning ring-1 ring-inset ring-warning/25"
											title={`Low stock — only ${free} of ${total} unit${free === 1 ? '' : 's'} left`}
										>
											<AlertTriangle className="h-3 w-3" aria-hidden />
											Low stock
										</span>
									) : null}
								</span>
							)
						},
					},
					{
						header: 'Status',
						render: (row) => {
							// Show the real availability, not the raw DB status: an item with no
							// free units reads as 'unavailable' so the chip matches the Borrow button.
							const label = displayStatus(row)
							return <StatusChip tone={statusTone[label] ?? 'muted'}>{label}</StatusChip>
						},
					},
					{
						header: 'Borrow',
						render: (row) => {
							// Availability alone decides whether the button is clickable: if the
							// item shows 'available' (has a free unit), it can be clicked. A
							// department-scope mismatch no longer disables it — the request just
							// surfaces the server's "not your department" error after clicking.
							// The overdue penalty overrides everything: it disables every row.
							const blocked = penaltyReason ?? borrowBlockedReason(row, unitsOut)
							const scopeHint = blocked ? null : borrowScopeReason(row, user)
							return (
								<Button
									size="sm"
									variant={blocked ? 'secondary' : 'primary'}
									disabled={Boolean(blocked)}
									title={blocked ?? scopeHint ?? 'Request this item'}
									onClick={() => setBorrowItem(row)}
								>
									Borrow
								</Button>
							)
						},
					},
					{
						// The only way into an item's history. The row itself is not
						// clickable, so this stays permanently visible rather than
						// appearing on hover — a hidden control would be the sole
						// entry point to the timeline and nobody would find it.
						header: 'History',
						render: (row) => (
							<button
								type="button"
								onClick={() => setHistoryItem(row)}
								className="inline-flex items-center justify-center rounded-lg border border-border p-1.5 text-primary transition hover:border-primary hover:bg-primary-light"
								title={`View history for ${row.equipment_name}`}
								aria-label={`View history for ${row.equipment_name}`}
							>
								<Eye className="h-4 w-4" />
							</button>
						),
					},
					...(canManage
						? [
								{
									header: 'Actions',
									// Only for items this admin may actually write. A department
									// admin browsing another department's tab gets no Edit button,
									// because "equipment admin write" would reject the save.
									render: (row: EquipmentRow) =>
										canEditItem(row) ? (
											<Button
												size="sm"
												variant="secondary"
												onClick={() => setEditItem(row)}
											>
												Edit
											</Button>
										) : (
											<span className="text-text-muted">—</span>
										),
								},
							]
						: []),
				]}
			/>

			{historyItem ? <EquipmentHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} /> : null}
			{editItem ? <EquipmentEditModal item={editItem} facilities={facilities} onClose={() => setEditItem(null)} /> : null}
			<BorrowRequestModal
				open={borrowItem !== null}
				onClose={() => setBorrowItem(null)}
				user={user}
				presetItem={
					borrowItem
						? {
								id: borrowItem.id,
								equipment_code: borrowItem.equipment_code,
								equipment_name: borrowItem.equipment_name,
								quantity: totalUnits(borrowItem, unitsOut),
								freeUnits: freeUnits(borrowItem),
								source: borrowItem.department_id === null ? 'supply' : 'department',
								departmentName: borrowItem.departments?.name ?? undefined,
							}
						: null
				}
			/>

			<Modal open={open} onClose={closeModal} title="Add Inventory Item">
				<StepIndicator current={step} />

				{error ? <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

				{step === 0 ? (
					<form className="space-y-4" onSubmit={handleNext}>
						<div>
							<label className={labelClass} htmlFor="eq-code">
								Asset Code
							</label>
							<input id="eq-code" value={equipmentCode} onChange={(event) => setEquipmentCode(event.target.value)} className={inputClass} placeholder="Unique code, e.g. ASSET-MS-001" required />
						</div>
						<div>
							<label className={labelClass} htmlFor="eq-name">
								Name
							</label>
							<input id="eq-name" value={equipmentName} onChange={(event) => setEquipmentName(event.target.value)} className={inputClass} required />
						</div>
						<div>
							<label className={labelClass} htmlFor="eq-category">
								Category
							</label>
							<input id="eq-category" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} placeholder="Computing, AV Equipment…" />
						</div>
						<Button type="submit" className="w-full">
							Next: Location
						</Button>
					</form>
				) : step === 1 ? (
					<form className="space-y-4" onSubmit={handleNext}>
						<div>
							<label className={labelClass} htmlFor="eq-department">
								Department
							</label>
							<select
								id="eq-department"
								value={departmentId}
								onChange={(event) => {
									setDepartmentId(event.target.value)
									setFacilityId('')
								}}
								className={inputClass}
								disabled={user.role === 'department_admin'}
								required
							>
								<option value="" disabled>
									Select department
								</option>
								{user.role === 'super_admin' ? <option value={MAIN_SUPPLY}>Main Supply (Central Inventory)</option> : null}
								{departments?.map((dept) => (
									<option key={dept.id} value={dept.id}>
										{dept.name}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className={labelClass} htmlFor="eq-facility">
								Facility
							</label>
							<select id="eq-facility" value={facilityId} onChange={(event) => setFacilityId(event.target.value)} className={inputClass}>
								<option value="">Unassigned</option>
								{facilityOptions.map((facility) => (
									<option key={facility.id} value={facility.id}>
										{facility.name}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className={labelClass} htmlFor="eq-quantity">
								Quantity in stock
							</label>
							<input id="eq-quantity" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputClass} />
						</div>
						<div className="flex gap-2">
							<Button type="button" variant="secondary" className="flex-1" onClick={handleBack}>
								Back
							</Button>
							<Button type="submit" className="flex-1">
								Next: Review
							</Button>
						</div>
					</form>
				) : (
					<form className="space-y-4" onSubmit={handleSubmit}>
						<div>
							<label className={labelClass} htmlFor="eq-condition">
								Condition
							</label>
							<select id="eq-condition" value={condition} onChange={(event) => setCondition(event.target.value)} className={inputClass}>
								{['Excellent', 'Good', 'Fair', 'Damaged'].map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</div>

						<div className="rounded-lg border border-border bg-bg p-4">
							<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Review</p>
							<dl className="space-y-1.5 text-sm">
								<div className="flex justify-between gap-3">
									<dt className="text-text-muted">Asset Code</dt>
									<dd className="font-medium text-text-primary">{equipmentCode || '—'}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className="text-text-muted">Name</dt>
									<dd className="font-medium text-text-primary">{equipmentName || '—'}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className="text-text-muted">Department</dt>
									<dd className="font-medium text-text-primary">{departmentName ?? '—'}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className="text-text-muted">Facility</dt>
									<dd className="font-medium text-text-primary">{facilityName ?? 'Unassigned'}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt className="text-text-muted">Quantity</dt>
									<dd className="font-medium text-text-primary">{quantity}</dd>
								</div>
							</dl>
						</div>

						<div className="flex gap-2">
							<Button type="button" variant="secondary" className="flex-1" onClick={handleBack}>
								Back
							</Button>
							<Button type="submit" className="flex-1" disabled={createEquipment.isPending}>
								{createEquipment.isPending ? 'Creating…' : 'Create Item'}
							</Button>
						</div>
					</form>
				)}
			</Modal>
		</>
	)
}
