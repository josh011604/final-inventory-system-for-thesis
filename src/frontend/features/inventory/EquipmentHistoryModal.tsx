import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Clock, Coins, Package, Wrench } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import StatusChip from '@/components/ui/StatusChip'
import type { ChipTone } from '@/components/ui/StatusChip'
import Skeleton from '@/components/ui/Skeleton'
import { useBorrowRecords, useMaintenanceRequests } from '@/backend/lib/supabase/queries'
import type { EquipmentRow } from '@/backend/lib/supabase/queries'

type EventTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

type TimelineEvent = {
	id: string
	// milliseconds since epoch, or null when the source has no date; null sorts last.
	at: number | null
	label: string
	title: string
	detail?: string
	tone: EventTone
	icon: LucideIcon
}

const dotClass: Record<EventTone, string> = {
	primary: 'bg-primary',
	info: 'bg-info',
	success: 'bg-success',
	warning: 'bg-warning',
	danger: 'bg-danger',
	muted: 'bg-text-muted',
}

const chipClass: Record<EventTone, string> = {
	primary: 'bg-primary-light text-primary',
	info: 'bg-info/10 text-info',
	success: 'bg-success/10 text-success',
	warning: 'bg-warning/10 text-warning',
	danger: 'bg-danger/10 text-danger',
	muted: 'bg-border/70 text-text-muted',
}

const statusTone: Record<string, ChipTone> = {
	available: 'success',
	borrowed: 'info',
	maintenance: 'warning',
	damaged: 'danger',
	lost: 'danger',
	disposed: 'muted',
}

function ms(value: string | null | undefined): number | null {
	if (!value) return null
	const time = new Date(value).getTime()
	return Number.isNaN(time) ? null : time
}

function formatDate(value: string | null | undefined, dateOnly = false): string {
	if (!value) return 'Date unknown'
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Date unknown'
	return dateOnly
		? date.toLocaleDateString('en-PH', { dateStyle: 'medium' })
		: date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function EquipmentHistoryModal({ item, onClose }: { item: EquipmentRow; onClose: () => void }) {
	const { data: borrowRecords, isLoading: borrowLoading } = useBorrowRecords()
	const { data: maintenance, isLoading: maintenanceLoading } = useMaintenanceRequests()

	const itemBorrows = useMemo(() => (borrowRecords ?? []).filter((row) => row.equipment_id === item.id), [borrowRecords, item.id])
	const itemMaintenance = useMemo(() => (maintenance ?? []).filter((row) => row.equipment_id === item.id), [maintenance, item.id])

	const isLoading = borrowLoading || maintenanceLoading

	const events = useMemo(() => {
		const list: TimelineEvent[] = []

		// Lifecycle origin.
		if (item.purchase_date) {
			list.push({
				id: `purchased-${item.id}`,
				at: ms(item.purchase_date),
				label: formatDate(item.purchase_date, true),
				title: 'Purchased',
				detail: item.value != null ? `Recorded value ₱${Number(item.value).toLocaleString()}` : undefined,
				tone: 'primary',
				icon: Coins,
			})
		}
		list.push({
			id: `added-${item.id}`,
			at: ms(item.created_at),
			label: formatDate(item.created_at),
			title: 'Added to inventory',
			detail: `${item.equipment_code}${item.departments?.name ? ` · ${item.departments.name}` : ''}`,
			tone: 'primary',
			icon: Package,
		})

		// Borrowing lifecycle.
		for (const borrow of itemBorrows) {
			const who = borrow.borrower?.full_name ?? 'a borrower'
			list.push({
				id: `borrow-req-${borrow.id}`,
				at: ms(borrow.borrowed_date ?? borrow.created_at),
				label: formatDate(borrow.borrowed_date ?? borrow.created_at),
				title: 'Borrow requested',
				detail: `By ${who}${borrow.expected_return_date ? ` · due ${formatDate(borrow.expected_return_date, true)}` : ''}`,
				tone: 'info',
				icon: ArrowRightLeft,
			})
			if (borrow.actual_return_date) {
				list.push({
					id: `borrow-ret-${borrow.id}`,
					at: ms(borrow.actual_return_date),
					label: formatDate(borrow.actual_return_date),
					title: 'Returned',
					detail: `By ${who}`,
					tone: 'success',
					icon: CheckCircle2,
				})
			} else if (borrow.status === 'overdue') {
				list.push({
					id: `borrow-od-${borrow.id}`,
					at: ms(borrow.updated_at),
					label: formatDate(borrow.updated_at),
					title: 'Flagged overdue',
					detail: `Held by ${who}`,
					tone: 'danger',
					icon: AlertTriangle,
				})
			} else if (borrow.status === 'rejected') {
				list.push({
					id: `borrow-rej-${borrow.id}`,
					at: ms(borrow.updated_at),
					label: formatDate(borrow.updated_at),
					title: 'Borrow request rejected',
					detail: `Requested by ${who}`,
					tone: 'muted',
					icon: Clock,
				})
			}
		}

		// Maintenance lifecycle.
		for (const request of itemMaintenance) {
			const who = request.requester?.full_name ?? 'a requester'
			list.push({
				id: `maint-req-${request.id}`,
				at: ms(request.requested_at),
				label: formatDate(request.requested_at),
				title: 'Maintenance requested',
				detail: `${request.priority ? `${request.priority} priority` : 'Maintenance'} · by ${who}`,
				tone: 'warning',
				icon: Wrench,
			})
			if (request.status === 'completed') {
				list.push({
					id: `maint-done-${request.id}`,
					at: ms(request.updated_at),
					label: formatDate(request.updated_at),
					title: 'Maintenance completed',
					tone: 'success',
					icon: CheckCircle2,
				})
			} else if (request.status === 'rejected') {
				list.push({
					id: `maint-rej-${request.id}`,
					at: ms(request.updated_at),
					label: formatDate(request.updated_at),
					title: 'Maintenance request rejected',
					detail: `Requested by ${who}`,
					tone: 'muted',
					icon: Clock,
				})
			}
		}

		// Most recent first; undated events fall to the bottom.
		return list.sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity))
	}, [item, itemBorrows, itemMaintenance])

	return (
		<Modal open onClose={onClose} title="Item History">
			<div className="mb-4 rounded-xl border border-border bg-bg p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="truncate font-semibold text-text-primary">{item.equipment_name}</p>
						<p className="text-xs text-text-muted">
							{item.equipment_code}
							{item.category ? ` · ${item.category}` : ''}
						</p>
					</div>
					<StatusChip tone={statusTone[item.status] ?? 'muted'}>{item.status}</StatusChip>
				</div>
				<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
					<span>{item.departments?.name ?? 'No department'}</span>
					<span>{item.facilities?.name ?? 'Unassigned facility'}</span>
					<span>
						{itemBorrows.length} {itemBorrows.length === 1 ? 'borrow' : 'borrows'}
					</span>
					<span>
						{itemMaintenance.length} maintenance {itemMaintenance.length === 1 ? 'request' : 'requests'}
					</span>
				</div>
			</div>

			<div className="max-h-[55vh] overflow-y-auto pr-1">
				{isLoading ? (
					<div className="space-y-3">
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
						<Skeleton className="h-12 w-full" />
					</div>
				) : (
					<ol className="relative space-y-4">
						{events.map((event, index) => {
							const Icon = event.icon
							const isLast = index === events.length - 1
							return (
								<li key={event.id} className="relative flex gap-3">
									{!isLast ? <span className="absolute left-[15px] top-9 bottom-[-16px] w-px bg-border" /> : null}
									<span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${chipClass[event.tone]}`}>
										<Icon className="h-4 w-4" />
										<span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${dotClass[event.tone]}`} />
									</span>
									<div className="min-w-0 flex-1 pb-1">
										<div className="flex flex-wrap items-baseline justify-between gap-x-3">
											<p className="font-medium text-text-primary">{event.title}</p>
											<p className="text-xs text-text-muted">{event.label}</p>
										</div>
										{event.detail ? <p className="text-sm text-text-muted">{event.detail}</p> : null}
									</div>
								</li>
							)
						})}
					</ol>
				)}
			</div>
		</Modal>
	)
}
