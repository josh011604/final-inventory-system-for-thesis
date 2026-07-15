import { useState } from 'react'
import type { FormEvent } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import { useDeleteEquipment, useUpdateEquipment } from '@/backend/lib/supabase/queries'
import type { EquipmentRow, FacilityRow } from '@/backend/lib/supabase/queries'
import { getErrorMessage } from '@/backend/lib/errors'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

// borrowed/maintenance are owned by the borrowing and maintenance workflows;
// admins may only hand-set the states those workflows don't manage.
const MANUAL_STATUSES = ['available', 'damaged', 'lost', 'disposed'] as const
const WORKFLOW_STATUSES = new Set(['borrowed', 'maintenance'])

export default function EquipmentEditModal({
	item,
	facilities,
	onClose,
}: {
	item: EquipmentRow
	facilities: FacilityRow[] | undefined
	onClose: () => void
}) {
	const updateEquipment = useUpdateEquipment()
	const deleteEquipment = useDeleteEquipment()

	const [name, setName] = useState(item.equipment_name)
	const [category, setCategory] = useState(item.category ?? '')
	const [quantity, setQuantity] = useState(String(item.quantity ?? 1))
	const [condition, setCondition] = useState(item.condition ?? 'Good')
	const [value, setValue] = useState(item.value != null ? String(item.value) : '')
	const [facilityId, setFacilityId] = useState(item.facility_id != null ? String(item.facility_id) : '')
	const [status, setStatus] = useState(item.status)
	const [error, setError] = useState<string | null>(null)
	const [confirmingDelete, setConfirmingDelete] = useState(false)

	const statusLocked = WORKFLOW_STATUSES.has(item.status)
	// Same-department facilities only (null department = Main Supply facilities).
	const facilityOptions = facilities?.filter((facility) => facility.department_id === item.department_id) ?? []

	const handleSave = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		try {
			await updateEquipment.mutateAsync({
				id: item.id,
				updates: {
					equipment_name: name.trim(),
					category: category.trim() || null,
					quantity: Math.max(Number(quantity) || 1, 1),
					condition: condition || null,
					value: value === '' ? null : Number(value),
					facility_id: facilityId ? Number(facilityId) : null,
					...(statusLocked ? {} : { status }),
				},
			})
			onClose()
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to update the item.'))
		}
	}

	const handleDelete = async () => {
		if (!confirmingDelete) {
			setConfirmingDelete(true)
			return
		}
		setError(null)
		try {
			await deleteEquipment.mutateAsync(item.id)
			onClose()
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to delete the item.'))
		}
	}

	return (
		<Modal open onClose={onClose} title={`Edit ${item.equipment_code}`}>
			<form className="space-y-4" onSubmit={handleSave}>
				{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}

				<div>
					<label className={labelClass} htmlFor="edit-name">
						Name
					</label>
					<input id="edit-name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} required />
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div>
						<label className={labelClass} htmlFor="edit-category">
							Category
						</label>
						<input id="edit-category" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} />
					</div>
					<div>
						<label className={labelClass} htmlFor="edit-quantity">
							Quantity
						</label>
						<input id="edit-quantity" type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputClass} />
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div>
						<label className={labelClass} htmlFor="edit-condition">
							Condition
						</label>
						<select id="edit-condition" value={condition} onChange={(event) => setCondition(event.target.value)} className={inputClass}>
							{['Excellent', 'Good', 'Fair', 'Damaged'].map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className={labelClass} htmlFor="edit-value">
							Unit Value (₱)
						</label>
						<input id="edit-value" type="number" min={0} step="0.01" value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} placeholder="Optional" />
					</div>
				</div>

				<div>
					<label className={labelClass} htmlFor="edit-facility">
						Facility
					</label>
					<select id="edit-facility" value={facilityId} onChange={(event) => setFacilityId(event.target.value)} className={inputClass}>
						<option value="">Unassigned</option>
						{facilityOptions.map((facility) => (
							<option key={facility.id} value={facility.id}>
								{facility.name}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className={labelClass} htmlFor="edit-status">
						Status
					</label>
					{statusLocked ? (
						<div className="flex items-center gap-2">
							<StatusChip tone={item.status === 'borrowed' ? 'info' : 'warning'}>{item.status}</StatusChip>
							<span className="text-xs text-text-muted">Managed by the {item.status === 'borrowed' ? 'borrowing' : 'maintenance'} workflow.</span>
						</div>
					) : (
						<select id="edit-status" value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
							{MANUAL_STATUSES.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
					)}
				</div>

				<div className="flex gap-2 pt-1">
					<Button type="button" variant="danger" className="flex-1" onClick={handleDelete} disabled={deleteEquipment.isPending}>
						{deleteEquipment.isPending ? 'Deleting…' : confirmingDelete ? 'Confirm delete? History goes too' : 'Delete Item'}
					</Button>
					<Button type="submit" className="flex-1" disabled={updateEquipment.isPending}>
						{updateEquipment.isPending ? 'Saving…' : 'Save Changes'}
					</Button>
				</div>
			</form>
		</Modal>
	)
}
