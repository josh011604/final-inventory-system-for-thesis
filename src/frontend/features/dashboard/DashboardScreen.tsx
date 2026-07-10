import { getRoleLabel, rolePermissions } from '@/backend/lib/rbac'
import Card from '@/components/ui/Card'
import StatusChip from '@/components/ui/StatusChip'
import Skeleton from '@/components/ui/Skeleton'
import {
	useBorrowRecords,
	useDepartments,
	useEquipment,
	useFacilities,
	useMaintenanceRequests,
	useProfiles,
} from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'

type DashboardScreenProps = {
	user: SchoolUser
}

function MetricCard({ label, value, detail, isLoading, highlight }: { label: string; value: number; detail: string; isLoading: boolean; highlight?: boolean }) {
	return (
		<article className="rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md">
			<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
			<div className="mt-3">
				{isLoading ? (
					<Skeleton className="h-8 w-16" />
				) : (
					<h3 className={`text-2xl font-semibold ${highlight ? 'text-accent' : 'text-text-primary'}`}>{value.toLocaleString()}</h3>
				)}
			</div>
			<p className="mt-2 text-sm text-text-muted">{detail}</p>
		</article>
	)
}

export default function DashboardScreen({ user }: DashboardScreenProps) {
	const permissions = rolePermissions[user.role]

	const { data: departments, isLoading: departmentsLoading } = useDepartments()
	const { data: facilities, isLoading: facilitiesLoading } = useFacilities()
	const { data: equipment, isLoading: equipmentLoading } = useEquipment()
	const { data: borrowRecords, isLoading: borrowLoading } = useBorrowRecords()
	const { data: maintenanceRequests, isLoading: maintenanceLoading } = useMaintenanceRequests()
	const { data: profiles, isLoading: profilesLoading } = useProfiles()

	const availableCount = equipment?.filter((item) => item.status === 'available').length ?? 0
	const borrowedCount = equipment?.filter((item) => item.status === 'borrowed').length ?? 0
	const pendingBorrow = borrowRecords?.filter((row) => row.status === 'pending').length ?? 0
	const pendingMaintenance = maintenanceRequests?.filter((row) => row.status === 'pending').length ?? 0

	const stats =
		user.role === 'super_admin'
			? [
					{ label: 'Departments', value: departments?.length ?? 0, detail: 'Institution-wide coverage', isLoading: departmentsLoading },
					{ label: 'Facilities', value: facilities?.length ?? 0, detail: 'Buildings, rooms, and labs', isLoading: facilitiesLoading },
					{ label: 'Inventory Items', value: equipment?.length ?? 0, detail: 'Cataloged assets', isLoading: equipmentLoading },
					{ label: 'Available Assets', value: availableCount, detail: 'Ready for use', isLoading: equipmentLoading },
					{ label: 'Borrowed Assets', value: borrowedCount, detail: 'Currently checked out', isLoading: equipmentLoading },
					{ label: 'Pending Approvals', value: pendingBorrow + pendingMaintenance, detail: 'Awaiting action', isLoading: borrowLoading || maintenanceLoading },
					{ label: 'Registered Users', value: profiles?.length ?? 0, detail: 'Active + pending accounts', isLoading: profilesLoading },
				]
			: [
					{ label: 'Facilities', value: facilities?.length ?? 0, detail: 'Accessible rooms and labs', isLoading: facilitiesLoading },
					{ label: 'Inventory Items', value: equipment?.length ?? 0, detail: 'Scoped asset records', isLoading: equipmentLoading },
					{ label: 'Available Assets', value: availableCount, detail: 'Ready for use', isLoading: equipmentLoading },
					{ label: 'Pending Approvals', value: pendingBorrow + pendingMaintenance, detail: 'Borrowing and maintenance', isLoading: borrowLoading || maintenanceLoading },
				]

	return (
		<div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
			<div className="space-y-6">
				<Card subtitle="Role Overview" title={`Welcome, ${user.fullName}`}>
					<p className="text-sm text-text-muted">
						You are signed in as <span className="font-semibold text-text-primary">{getRoleLabel(user.role)}</span>
						{user.department ? (
							<>
								{' '}
								for <span className="font-semibold text-text-primary">{user.department}</span>
							</>
						) : null}
						.
					</p>
				</Card>

				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
					{stats.map((stat, index) => (
						<MetricCard key={stat.label} {...stat} highlight={index === 0} />
					))}
				</div>

				<Card title="Recent Maintenance" subtitle="Latest requests">
					{maintenanceLoading ? (
						<div className="space-y-2">
							<Skeleton className="h-12 w-full" />
							<Skeleton className="h-12 w-full" />
						</div>
					) : maintenanceRequests && maintenanceRequests.length > 0 ? (
						<div className="space-y-3">
							{maintenanceRequests.slice(0, 4).map((request) => (
								<div key={request.id} className="rounded-xl border border-border bg-bg p-4">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<div>
											<p className="font-semibold text-text-primary">{request.equipment?.equipment_name ?? request.facilities?.name ?? 'Untitled'}</p>
											<p className="text-sm text-text-muted">Requested by {request.requester?.full_name ?? '—'}</p>
										</div>
										<StatusChip tone={request.status === 'completed' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}>{request.status.replace('_', ' ')}</StatusChip>
									</div>
								</div>
							))}
						</div>
					) : (
						<p className="text-sm text-text-muted">No maintenance requests yet.</p>
					)}
				</Card>
			</div>

			<aside className="space-y-6">
				<Card title="Quick Profile" subtitle="User profile section">
					<div className="flex items-center gap-4 rounded-xl border border-border bg-bg p-4">
						<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-base font-semibold text-white">{user.profilePicture}</div>
						<div>
							<p className="font-semibold text-text-primary">{user.fullName}</p>
							<p className="text-sm text-text-muted">{user.position ?? getRoleLabel(user.role)}</p>
							<div className="mt-1">
								<StatusChip tone={user.status === 'Active' ? 'success' : 'muted'}>{user.status}</StatusChip>
							</div>
						</div>
					</div>
				</Card>

				<Card title="Permissions" subtitle={`${permissions.length} granted`}>
					<ul className="space-y-2 text-sm text-text-muted">
						{permissions.map((permission) => (
							<li key={permission} className="rounded-xl border border-border bg-bg px-4 py-3">
								{permission}
							</li>
						))}
					</ul>
				</Card>
			</aside>
		</div>
	)
}
