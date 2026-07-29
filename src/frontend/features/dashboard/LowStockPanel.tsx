import { Link } from 'react-router-dom'
import { AlertTriangle, PackageCheck, Boxes } from 'lucide-react'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'
import { useBorrowRecords, useEquipment } from '@/backend/lib/supabase/queries'
import type { BorrowRecordRow } from '@/backend/lib/supabase/queries'
import { freeUnits, isLowStock, unitsOutByEquipmentId } from '@/backend/lib/borrowing'
import type { SchoolUser } from '@/backend/types/school'

// How many low-stock rows to list before deferring the rest to the Inventory page.
const MAX_ROWS = 6

// Same overdue rule the Alerts panel and Reports module use: explicitly flagged,
// or still out and past its expected return date.
function isOverdue(row: BorrowRecordRow): boolean {
	if (row.status === 'overdue') return true
	if (!row.expected_return_date) return false
	const stillOut = row.status === 'confirmed' || row.status === 'borrowed' || row.status === 'return_requested'
	return stillOut && new Date(row.expected_return_date).getTime() < Date.now()
}

export default function LowStockPanel({ user }: { user: SchoolUser }) {
	const { data: equipment, isLoading: equipmentLoading } = useEquipment()
	const { data: borrowRecords, isLoading: borrowLoading } = useBorrowRecords()

	const isLoading = equipmentLoading || borrowLoading

	// Match the rest of the dashboard's scope: the super admin sees every item,
	// everyone else only their own department's stock.
	const scopedEquipment = user.role === 'super_admin' ? (equipment ?? []) : (equipment ?? []).filter((item) => item.department_id === user.departmentId)

	// Units out per item — the same figure that deducts from availability until
	// each borrow is returned. Low stock is entirely a product of these.
	const unitsOut = unitsOutByEquipmentId(borrowRecords ?? [])

	// Units currently overdue per item, so a row can flag how much of its missing
	// stock is late — that is what should be chased back first.
	const overdueUnits = new Map<number, number>()
	for (const row of borrowRecords ?? []) {
		if (isOverdue(row)) overdueUnits.set(row.equipment_id, (overdueUnits.get(row.equipment_id) ?? 0) + Math.max(row.quantity ?? 1, 1))
	}

	const lowStock = scopedEquipment
		.filter((item) => isLowStock(item, unitsOut))
		.map((item) => ({
			id: item.id,
			name: item.equipment_name,
			code: item.equipment_code,
			department: item.departments?.name ?? 'Main Supply',
			total: item.quantity ?? 1,
			free: freeUnits(item, unitsOut),
			out: unitsOut.get(item.id) ?? 0,
			overdue: overdueUnits.get(item.id) ?? 0,
		}))
		// Fewest free units first (most depleted), then most overdue units.
		.sort((a, b) => a.free - b.free || b.overdue - a.overdue)

	const overdueTotal = lowStock.reduce((sum, item) => sum + (item.overdue > 0 ? 1 : 0), 0)

	const badge =
		!isLoading && lowStock.length > 0 ? (
			<span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
				<AlertTriangle className="h-3.5 w-3.5" />
				{lowStock.length} low{overdueTotal > 0 ? ` · ${overdueTotal} overdue` : ''}
			</span>
		) : null

	return (
		<Card title="Low Stock" subtitle="Depleted by active borrows" action={badge}>
			{isLoading ? (
				<div className="space-y-2">
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
				</div>
			) : lowStock.length === 0 ? (
				<div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-4">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
						<PackageCheck className="h-5 w-5" />
					</div>
					<div>
						<p className="font-semibold text-text-primary">Stock levels are healthy</p>
						<p className="text-sm text-text-muted">No item is running low from items still out on loan.</p>
					</div>
				</div>
			) : (
				<>
					<div className="space-y-2.5">
						{lowStock.slice(0, MAX_ROWS).map((item) => (
							<Link
								key={item.id}
								to="/inventory"
								className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-bg p-3.5 pl-5 transition hover:-translate-y-0.5 hover:border-primary-light hover:shadow-sm"
							>
								<span className={`absolute inset-y-0 left-0 w-1 ${item.overdue > 0 ? 'bg-danger' : 'bg-warning'}`} />
								<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-110 ${item.overdue > 0 ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
									<Boxes className="h-5 w-5" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate font-semibold text-text-primary">
										{item.name} <span className="text-xs font-normal text-text-muted">· {item.code}</span>
									</p>
									<p className="text-sm text-text-muted">
										{item.free} of {item.total} available · {item.out} out on loan
										{item.overdue > 0 ? <span className="font-semibold text-danger"> · {item.overdue} overdue — chase return</span> : null}
									</p>
								</div>
								<span className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold ${item.overdue > 0 ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
									{item.free}
								</span>
							</Link>
						))}
					</div>
					{lowStock.length > MAX_ROWS ? (
						<Link to="/inventory" className="mt-3 inline-flex text-sm font-semibold text-primary transition hover:translate-x-0.5">
							See all {lowStock.length} low-stock items in Inventory →
						</Link>
					) : null}
				</>
			)}
		</Card>
	)
}
