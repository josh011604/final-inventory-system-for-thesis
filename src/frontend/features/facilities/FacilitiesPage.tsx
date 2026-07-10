import { useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import { useCreateFacility, useDepartments, useFacilities } from '@/backend/lib/supabase/queries'
import type { FacilityRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

const availabilityTone: Record<string, 'success' | 'warning' | 'info' | 'muted'> = {
	available: 'success',
	reserved: 'warning',
	in_use: 'info',
	under_maintenance: 'muted',
}

export default function FacilitiesPage({ user }: { user: SchoolUser }) {
	const { data, isLoading } = useFacilities()
	const { data: departments } = useDepartments()
	const createFacility = useCreateFacility()

	const canManage = user.role === 'super_admin' || user.role === 'department_admin'
	const [open, setOpen] = useState(false)
	const [name, setName] = useState('')
	const [facilityType, setFacilityType] = useState('')
	const [departmentId, setDepartmentId] = useState(user.role === 'department_admin' ? user.departmentId ?? '' : '')
	const [capacity, setCapacity] = useState('0')
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		try {
			await createFacility.mutateAsync({
				name,
				facility_type: facilityType,
				department_id: departmentId || null,
				capacity: Number(capacity) || 0,
			})
			setName('')
			setFacilityType('')
			setCapacity('0')
			setOpen(false)
		} catch (mutationError) {
			setError(mutationError instanceof Error ? mutationError.message : 'Failed to create facility.')
		}
	}

	return (
		<>
			<EntityTablePage<FacilityRow>
				title="Facilities"
				subtitle={`${data?.length ?? 0} facilities`}
				rows={data}
				isLoading={isLoading}
				searchKeys={['name', 'facility_type']}
				emptyMessage="No facilities recorded yet."
				emptyAction={canManage ? <Button size="sm" onClick={() => setOpen(true)}>Add the first facility</Button> : null}
				action={canManage ? <Button size="sm" onClick={() => setOpen(true)}>Add Facility</Button> : undefined}
				columns={[
					{ header: 'Name', render: (row) => <span className="font-medium text-text-primary">{row.name}</span> },
					{ header: 'Type', render: (row) => row.facility_type },
					{ header: 'Department', render: (row) => row.departments?.name ?? '—' },
					{ header: 'Capacity', render: (row) => row.capacity },
					{
						header: 'Availability',
						render: (row) => <StatusChip tone={availabilityTone[row.current_availability] ?? 'muted'}>{row.current_availability.replace('_', ' ')}</StatusChip>,
					},
				]}
			/>

			<Modal open={open} onClose={() => setOpen(false)} title="Add Facility">
				<form className="space-y-4" onSubmit={handleSubmit}>
					{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
					<div>
						<label className={labelClass} htmlFor="facility-name">
							Name
						</label>
						<input id="facility-name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} required />
					</div>
					<div>
						<label className={labelClass} htmlFor="facility-type">
							Type
						</label>
						<input id="facility-type" value={facilityType} onChange={(event) => setFacilityType(event.target.value)} className={inputClass} placeholder="Laboratory, Classroom, Office…" required />
					</div>
					<div>
						<label className={labelClass} htmlFor="facility-department">
							Department
						</label>
						<select
							id="facility-department"
							value={departmentId}
							onChange={(event) => setDepartmentId(event.target.value)}
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
						<label className={labelClass} htmlFor="facility-capacity">
							Capacity
						</label>
						<input id="facility-capacity" type="number" min={0} value={capacity} onChange={(event) => setCapacity(event.target.value)} className={inputClass} />
					</div>
					<Button type="submit" className="w-full" disabled={createFacility.isPending}>
						{createFacility.isPending ? 'Creating…' : 'Create Facility'}
					</Button>
				</form>
			</Modal>
		</>
	)
}
