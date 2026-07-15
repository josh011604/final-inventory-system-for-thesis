import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, Clock, Package, Wrench } from 'lucide-react'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import { useBorrowRecords, useEquipment, useMaintenanceRequests } from '@/backend/lib/supabase/queries'
import type { BorrowRecordRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'

type AlertTone = 'danger' | 'warning' | 'info'

type Alert = {
	id: string
	label: string
	count: number
	tone: AlertTone
	icon: LucideIcon
	to: string
}

const toneStyles: Record<AlertTone, { bar: string; chip: string; badge: string }> = {
	danger: { bar: 'bg-danger', chip: 'bg-danger/10 text-danger', badge: 'bg-danger/10 text-danger' },
	warning: { bar: 'bg-warning', chip: 'bg-warning/10 text-warning', badge: 'bg-warning/10 text-warning' },
	info: { bar: 'bg-info', chip: 'bg-info/10 text-info', badge: 'bg-info/10 text-info' },
}

// An item is overdue if it is explicitly flagged, or it is still out and past
// its expected return date. Mirrors the same rule used in the Reports module.
function isOverdue(row: BorrowRecordRow): boolean {
	if (row.status === 'overdue') return true
	if (!row.expected_return_date) return false
	const stillOut = row.status === 'confirmed' || row.status === 'borrowed' || row.status === 'return_requested'
	return stillOut && new Date(row.expected_return_date).getTime() < Date.now()
}

export default function AlertsPanel({ user }: { user: SchoolUser }) {
	const { data: equipment, isLoading: equipmentLoading } = useEquipment()
	const { data: borrowRecords, isLoading: borrowLoading } = useBorrowRecords()
	const { data: maintenance, isLoading: maintenanceLoading } = useMaintenanceRequests()

	const isLoading = equipmentLoading || borrowLoading || maintenanceLoading
	const canApprove = user.role === 'super_admin' || user.role === 'department_admin'

	const overdue = (borrowRecords ?? []).filter(isOverdue).length
	const damagedLost = (equipment ?? []).filter((item) => item.status === 'damaged' || item.status === 'lost').length
	const pendingBorrow = (borrowRecords ?? []).filter((row) => row.status === 'pending').length
	const returnRequests = (borrowRecords ?? []).filter((row) => row.status === 'return_requested').length
	const pendingMaintenance = (maintenance ?? []).filter((row) => row.status === 'pending').length
	const inMaintenance = (maintenance ?? []).filter((row) => row.status === 'in_progress').length

	// Ordered by severity; approval-type alerts only surface for approvers.
	const candidates: Alert[] = [
		{ id: 'overdue', label: 'Overdue borrowed items', count: overdue, tone: 'danger', icon: AlertTriangle, to: '/borrowing' },
		{ id: 'damaged', label: 'Damaged or lost assets', count: damagedLost, tone: 'danger', icon: Package, to: '/inventory' },
		...(canApprove
			? [
					{ id: 'pending-borrow', label: 'Borrow requests to approve', count: pendingBorrow, tone: 'warning', icon: Clock, to: '/borrowing' } as Alert,
					{ id: 'return-requests', label: 'Return requests to confirm', count: returnRequests, tone: 'warning', icon: Clock, to: '/borrowing' } as Alert,
					{ id: 'pending-maintenance', label: 'Maintenance requests to approve', count: pendingMaintenance, tone: 'warning', icon: Wrench, to: '/maintenance' } as Alert,
				]
			: []),
		{ id: 'in-maintenance', label: 'Assets under maintenance', count: inMaintenance, tone: 'info', icon: Wrench, to: '/maintenance' },
	]

	const alerts = candidates.filter((alert) => alert.count > 0)
	const totalFlagged = alerts.reduce((sum, alert) => sum + alert.count, 0)

	const badge =
		!isLoading && alerts.length > 0 ? (
			<span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
				<span className="relative flex h-2 w-2">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
					<span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
				</span>
				{totalFlagged.toLocaleString()} flagged
			</span>
		) : null

	return (
		<Card title="Needs Attention" subtitle="Live monitoring" action={badge}>
			{isLoading ? (
				<div className="space-y-2">
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
				</div>
			) : alerts.length === 0 ? (
				<div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-4">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
						<CheckCircle2 className="h-5 w-5" />
					</div>
					<div>
						<p className="font-semibold text-text-primary">All clear</p>
						<p className="text-sm text-text-muted">No overdue items, pending approvals, or flagged assets right now.</p>
					</div>
				</div>
			) : (
				<div className="space-y-2.5">
					{alerts.map((alert) => {
						const styles = toneStyles[alert.tone]
						const Icon = alert.icon
						return (
							<Link
								key={alert.id}
								to={alert.to}
								className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-bg p-3.5 pl-5 transition hover:-translate-y-0.5 hover:border-primary-light hover:shadow-sm"
							>
								<span className={`absolute inset-y-0 left-0 w-1 ${styles.bar}`} />
								<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-110 ${styles.chip}`}>
									<Icon className="h-5 w-5" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate font-semibold text-text-primary">{alert.label}</p>
									<p className="text-sm text-text-muted">
										{alert.count.toLocaleString()} {alert.count === 1 ? 'item needs' : 'items need'} review
									</p>
								</div>
								<span className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold ${styles.badge}`}>
									{alert.count.toLocaleString()}
								</span>
								<span className="shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary">→</span>
							</Link>
						)
					})}
				</div>
			)}
		</Card>
	)
}
