import { useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import EquipmentHistoryModal from '@/frontend/features/inventory/EquipmentHistoryModal'
import { useCreateEquipment, useDepartments, useEquipment, useFacilities } from '@/backend/lib/supabase/queries'
import type { EquipmentRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

const statusTone: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
	available: 'success',
	borrowed: 'info',
	maintenance: 'warning',
	damaged: 'danger',
	lost: 'danger',
	disposed: 'muted',
}

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
	const { data, isLoading } = useEquipment()
	const { data: departments } = useDepartments()
	const { data: facilities } = useFacilities()
	const createEquipment = useCreateEquipment()

	const canManage = user.role === 'super_admin' || user.role === 'department_admin'
	const [open, setOpen] = useState(false)
	const [historyItem, setHistoryItem] = useState<EquipmentRow | null>(null)
	const [step, setStep] = useState(0)
	const [equipmentCode, setEquipmentCode] = useState('')
	const [equipmentName, setEquipmentName] = useState('')
	const [category, setCategory] = useState('')
	const [departmentId, setDepartmentId] = useState(user.role === 'department_admin' ? user.departmentId ?? '' : '')
	const [facilityId, setFacilityId] = useState('')
	const [quantity, setQuantity] = useState('1')
	const [condition, setCondition] = useState('Excellent')
	const [error, setError] = useState<string | null>(null)

	const facilityOptions = facilities?.filter((facility) => !departmentId || facility.department_id === departmentId) ?? []
	const departmentName = departments?.find((dept) => dept.id === departmentId)?.name
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
				department_id: departmentId || null,
				facility_id: facilityId ? Number(facilityId) : null,
				quantity: Number(quantity) || 1,
				condition,
				status: 'available',
			})
			closeModal()
		} catch (mutationError) {
			setError(mutationError instanceof Error ? mutationError.message : 'Failed to create equipment.')
		}
	}

	return (
		<>
			<EntityTablePage<EquipmentRow>
				title="Inventory Items"
				subtitle={`${data?.length ?? 0} items · click a row for its history`}
				rows={data}
				isLoading={isLoading}
				searchKeys={['equipment_code', 'equipment_name', 'category', 'status']}
				emptyMessage="No inventory items recorded yet."
				emptyAction={canManage ? <Button size="sm" onClick={() => setOpen(true)}>Add the first item</Button> : null}
				action={canManage ? <Button size="sm" onClick={() => setOpen(true)}>Add Item</Button> : undefined}
				onRowClick={(row) => setHistoryItem(row)}
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
					{ header: 'Department', render: (row) => row.departments?.name ?? '—' },
					{ header: 'Facility', render: (row) => row.facilities?.name ?? '—' },
					{ header: 'Qty', render: (row) => row.quantity },
					{ header: 'Status', render: (row) => <StatusChip tone={statusTone[row.status] ?? 'muted'}>{row.status}</StatusChip> },
					{
						header: 'History',
						render: () => (
							<span className="text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">View →</span>
						),
					},
				]}
			/>

			{historyItem ? <EquipmentHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} /> : null}

			<Modal open={open} onClose={closeModal} title="Add Inventory Item">
				<StepIndicator current={step} />

				{error ? <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

				{step === 0 ? (
					<form className="space-y-4" onSubmit={handleNext}>
						<div>
							<label className={labelClass} htmlFor="eq-code">
								Asset Code
							</label>
							<input id="eq-code" value={equipmentCode} onChange={(event) => setEquipmentCode(event.target.value)} className={inputClass} placeholder="ASSET-CS-004" required />
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
								Quantity
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
