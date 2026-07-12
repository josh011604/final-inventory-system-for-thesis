import { useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import StatusChip from '@/components/ui/StatusChip'
import { useCreateMaintenanceRequest, useEquipment, useFacilities, useMaintenanceRequests, useUpdateMaintenanceStatus } from '@/backend/lib/supabase/queries'
import type { MaintenanceRequestRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

const statusTone: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
	pending: 'warning',
	approved: 'info',
	in_progress: 'info',
	completed: 'success',
	rejected: 'danger',
}

export default function MaintenancePage({ user }: { user: SchoolUser }) {
	const { data, isLoading } = useMaintenanceRequests()
	const { data: equipment } = useEquipment()
	const { data: facilities } = useFacilities()
	const createRequest = useCreateMaintenanceRequest()
	const updateStatus = useUpdateMaintenanceStatus()

	const canManage = user.role === 'super_admin' || user.role === 'department_admin'
	const hasTargets = (equipment?.length ?? 0) > 0 || (facilities?.length ?? 0) > 0

	const [open, setOpen] = useState(false)
	const [targetType, setTargetType] = useState<'equipment' | 'facility'>('equipment')
	const [targetId, setTargetId] = useState('')
	const [description, setDescription] = useState('')
	const [priority, setPriority] = useState('medium')
	const [error, setError] = useState<string | null>(null)
	const [actionError, setActionError] = useState<string | null>(null)

	const runStatusChange = (id: number, status: string) => {
		setActionError(null)
		updateStatus.mutate(
			{ id, status },
			{ onError: (mutationError) => setActionError(mutationError instanceof Error ? mutationError.message : 'Failed to update maintenance request.') },
		)
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		try {
			await createRequest.mutateAsync({
				equipment_id: targetType === 'equipment' ? Number(targetId) : null,
				facility_id: targetType === 'facility' ? Number(targetId) : null,
				requester_id: user.id,
				department_id: user.departmentId,
				description,
				priority,
				status: 'pending',
			})
			setTargetId('')
			setDescription('')
			setOpen(false)
		} catch (mutationError) {
			setError(mutationError instanceof Error ? mutationError.message : 'Failed to submit maintenance request.')
		}
	}

	return (
		<>
			{actionError ? (
				<div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{actionError}</div>
			) : null}
			<EntityTablePage<MaintenanceRequestRow>
				title="Maintenance"
				subtitle={`${data?.length ?? 0} requests`}
				rows={data}
				isLoading={isLoading}
				searchKeys={['status', 'priority']}
				emptyMessage="No maintenance requests yet."
				emptyAction={
					<Button size="sm" onClick={() => setOpen(true)} disabled={!hasTargets}>
						{hasTargets ? 'Submit the first request' : 'Add inventory or facilities first'}
					</Button>
				}
				action={
					<Button size="sm" onClick={() => setOpen(true)} disabled={!hasTargets}>
						New Request
					</Button>
				}
				columns={[
					{
						header: 'Item',
						render: (row) => (
							<div>
								<p className="font-medium text-text-primary">{row.equipment?.equipment_name ?? row.facilities?.name ?? '—'}</p>
								<p className="text-xs text-text-muted">Requested by {row.requester?.full_name ?? '—'}</p>
							</div>
						),
					},
					{ header: 'Department', render: (row) => row.departments?.name ?? '—' },
					{ header: 'Priority', render: (row) => <span className="capitalize">{row.priority}</span> },
					{ header: 'Status', render: (row) => <StatusChip tone={statusTone[row.status] ?? 'muted'}>{row.status.replace('_', ' ')}</StatusChip> },
					{
						header: 'Actions',
						render: (row) =>
							canManage && row.status === 'pending' ? (
								<div className="flex gap-2">
									<Button size="sm" variant="secondary" onClick={() => runStatusChange(row.id, 'approved')}>
										Approve
									</Button>
									<Button size="sm" variant="danger" onClick={() => runStatusChange(row.id, 'rejected')}>
										Reject
									</Button>
								</div>
							) : canManage && row.status === 'approved' ? (
								<Button size="sm" variant="secondary" onClick={() => runStatusChange(row.id, 'in_progress')}>
									Start Work
								</Button>
							) : canManage && row.status === 'in_progress' ? (
								<Button size="sm" variant="secondary" onClick={() => runStatusChange(row.id, 'completed')}>
									Mark Completed
								</Button>
							) : (
								'—'
							),
					},
				]}
			/>

			<Modal open={open} onClose={() => setOpen(false)} title="New Maintenance Request">
				<form className="space-y-4" onSubmit={handleSubmit}>
					{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
					<div>
						<label className={labelClass}>Target</label>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => {
									setTargetType('equipment')
									setTargetId('')
								}}
								className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${targetType === 'equipment' ? 'border-primary bg-primary-light text-primary' : 'border-border text-text-muted'}`}
							>
								Equipment
							</button>
							<button
								type="button"
								onClick={() => {
									setTargetType('facility')
									setTargetId('')
								}}
								className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${targetType === 'facility' ? 'border-primary bg-primary-light text-primary' : 'border-border text-text-muted'}`}
							>
								Facility
							</button>
						</div>
					</div>
					<div>
						<label className={labelClass} htmlFor="maint-target">
							{targetType === 'equipment' ? 'Equipment' : 'Facility'}
						</label>
						<select id="maint-target" value={targetId} onChange={(event) => setTargetId(event.target.value)} className={inputClass} required>
							<option value="" disabled>
								Select {targetType}
							</option>
							{(targetType === 'equipment' ? equipment : facilities)?.map((item) => (
								<option key={item.id} value={item.id}>
									{'equipment_name' in item ? item.equipment_name : item.name}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className={labelClass} htmlFor="maint-priority">
							Priority
						</label>
						<select id="maint-priority" value={priority} onChange={(event) => setPriority(event.target.value)} className={inputClass}>
							{['low', 'medium', 'high', 'critical'].map((option) => (
								<option key={option} value={option} className="capitalize">
									{option}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className={labelClass} htmlFor="maint-description">
							Description
						</label>
						<textarea id="maint-description" value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} min-h-24`} required />
					</div>
					<Button type="submit" className="w-full" disabled={createRequest.isPending}>
						{createRequest.isPending ? 'Submitting…' : 'Submit Request'}
					</Button>
				</form>
			</Modal>
		</>
	)
}
