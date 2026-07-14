import { useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, CheckCircle2, Clock, Coins, Download, Package, Printer, Wrench } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import {
	useBorrowRecords,
	useEquipment,
	useMaintenanceRequests,
} from '@/backend/lib/supabase/queries'
import type { BorrowRecordRow, EquipmentRow, MaintenanceRequestRow } from '@/backend/lib/supabase/queries'
import type { SchoolUser } from '@/backend/types/school'

// ---------- shared visual tokens (reuse the app design system) ----------

type Tone = 'primary' | 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

const barClass: Record<Tone, string> = {
	primary: 'bg-primary',
	accent: 'bg-accent',
	info: 'bg-info',
	success: 'bg-success',
	warning: 'bg-warning',
	danger: 'bg-danger',
	muted: 'bg-text-muted',
}

const tileTone: Record<Exclude<Tone, 'muted'>, { icon: string; value: string; bar: string }> = {
	primary: { icon: 'bg-primary-light text-primary', value: 'text-primary', bar: 'bg-primary' },
	accent: { icon: 'bg-accent-light text-accent', value: 'text-accent', bar: 'bg-accent' },
	info: { icon: 'bg-info/10 text-info', value: 'text-info', bar: 'bg-info' },
	success: { icon: 'bg-success/10 text-success', value: 'text-success', bar: 'bg-success' },
	warning: { icon: 'bg-warning/10 text-warning', value: 'text-warning', bar: 'bg-warning' },
	danger: { icon: 'bg-danger/10 text-danger', value: 'text-danger', bar: 'bg-danger' },
}

// Status colors are reserved and carry a text label, never color alone.
const equipmentStatusTone: Record<string, Tone> = {
	available: 'success',
	borrowed: 'warning',
	maintenance: 'info',
	damaged: 'danger',
	lost: 'danger',
	disposed: 'muted',
}

const borrowStatusTone: Record<string, Tone> = {
	pending: 'warning',
	confirmed: 'info',
	borrowed: 'info',
	return_requested: 'warning',
	returned: 'success',
	overdue: 'danger',
	rejected: 'danger',
}

const maintenanceStatusTone: Record<string, Tone> = {
	pending: 'warning',
	approved: 'info',
	in_progress: 'info',
	completed: 'success',
	rejected: 'danger',
}

const priorityTone: Record<string, Tone> = {
	low: 'success',
	medium: 'info',
	high: 'warning',
	critical: 'danger',
}

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })

// ---------- pure grouping helpers ----------

type Datum = { label: string; value: number; tone: Tone }

function tallyByStatus(
	rows: { status?: string | null }[] | undefined,
	toneMap: Record<string, Tone>,
): Datum[] {
	const counts = new Map<string, number>()
	for (const row of rows ?? []) {
		const key = row.status ?? 'unspecified'
		counts.set(key, (counts.get(key) ?? 0) + 1)
	}
	return [...counts.entries()]
		.map(([label, value]) => ({ label, value, tone: toneMap[label] ?? 'primary' }))
		.sort((a, b) => b.value - a.value)
}

// Ranked magnitude list → single hue, sorted descending, capped with "Others".
function rankBy<T>(rows: T[] | undefined, keyOf: (row: T) => string, limit = 6): Datum[] {
	const counts = new Map<string, number>()
	for (const row of rows ?? []) {
		const key = keyOf(row)
		counts.set(key, (counts.get(key) ?? 0) + 1)
	}
	const sorted = [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
	const head = sorted.slice(0, limit)
	const tail = sorted.slice(limit)
	const result: Datum[] = head.map((entry) => ({ ...entry, tone: 'primary' }))
	if (tail.length > 0) {
		result.push({ label: 'Others', value: tail.reduce((sum, entry) => sum + entry.value, 0), tone: 'muted' })
	}
	return result
}

function isOverdue(row: BorrowRecordRow): boolean {
	if (row.status === 'overdue') return true
	if (!row.expected_return_date) return false
	const stillOut = row.status === 'confirmed' || row.status === 'borrowed' || row.status === 'return_requested'
	return stillOut && new Date(row.expected_return_date).getTime() < Date.now()
}

// ---------- presentational pieces ----------

function StatTile({
	label,
	value,
	detail,
	tone,
	icon: Icon,
	isLoading,
}: {
	label: string
	value: string
	detail: string
	tone: Exclude<Tone, 'muted'>
	icon: LucideIcon
	isLoading: boolean
}) {
	const palette = tileTone[tone]
	return (
		<article className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
			<span className={`absolute inset-x-0 top-0 h-1 ${palette.bar} opacity-70 transition group-hover:opacity-100`} />
			<div className="flex items-start justify-between gap-3">
				<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
				<div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-110 ${palette.icon}`}>
					<Icon className="h-5 w-5" />
				</div>
			</div>
			<div className="mt-3">
				{isLoading ? <Skeleton className="h-8 w-20" /> : <h3 className={`text-2xl font-semibold ${palette.value}`}>{value}</h3>}
			</div>
			<p className="mt-2 text-sm text-text-muted">{detail}</p>
		</article>
	)
}

function Bars({ items, isLoading }: { items: Datum[]; isLoading: boolean }) {
	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-8 w-full" />
			</div>
		)
	}
	if (items.length === 0) {
		return <p className="text-sm text-text-muted">No data yet.</p>
	}
	const max = Math.max(...items.map((item) => item.value), 1)
	const total = items.reduce((sum, item) => sum + item.value, 0)
	return (
		<div className="space-y-3">
			{items.map((item) => {
				const width = Math.round((item.value / max) * 100)
				const share = total > 0 ? Math.round((item.value / total) * 100) : 0
				return (
					<div key={item.label}>
						<div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
							<span className="truncate font-medium capitalize text-text-primary">{item.label.replace(/_/g, ' ')}</span>
							<span className="shrink-0 text-text-muted tabular-nums">
								{item.value.toLocaleString()} · {share}%
							</span>
						</div>
						<div className="h-2.5 w-full overflow-hidden rounded-full bg-bg">
							<div
								className={`h-full rounded-full ${barClass[item.tone]} transition-all duration-700`}
								style={{ width: `${item.value > 0 ? Math.max(width, 4) : 0}%` }}
							/>
						</div>
					</div>
				)
			})}
		</div>
	)
}

// ---------- CSV + printable-PDF export (dependency-free) ----------

function csvCell(value: string | number | null | undefined): string {
	const text = value == null ? '' : String(value)
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
	const lines = [header, ...rows].map((row) => row.map(csvCell).join(','))
	// Prepend a BOM so Excel opens UTF-8 correctly.
	const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = filename
	anchor.click()
	URL.revokeObjectURL(url)
}

function printableTable(title: string, rows: Datum[]): string {
	const total = rows.reduce((sum, row) => sum + row.value, 0)
	const body = rows
		.map((row) => {
			const share = total > 0 ? Math.round((row.value / total) * 100) : 0
			const label = row.label.replace(/_/g, ' ')
			return `<tr><td>${label}</td><td class="num">${row.value.toLocaleString()}</td><td class="num">${share}%</td></tr>`
		})
		.join('')
	return `<h2>${title}</h2><table><thead><tr><th>Category</th><th class="num">Count</th><th class="num">Share</th></tr></thead><tbody>${body || '<tr><td colspan="3">No data</td></tr>'}</tbody></table>`
}

// ---------- page ----------

export default function ReportsPage({ user }: { user: SchoolUser }) {
	const { data: equipment, isLoading: equipmentLoading } = useEquipment()
	const { data: borrowRecords, isLoading: borrowLoading } = useBorrowRecords()
	const { data: maintenance, isLoading: maintenanceLoading } = useMaintenanceRequests()

	const isSuperAdmin = user.role === 'super_admin'
	const scopeLabel = isSuperAdmin ? 'All Departments' : user.department || 'Your Department'
	const generatedAt = useMemo(() => new Date().toLocaleString('en-PH'), [])

	const totals = useMemo(() => {
		const items = equipment ?? []
		const totalUnits = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0)
		const totalValue = items.reduce((sum, item) => sum + (item.value ?? 0) * (item.quantity ?? 1), 0)
		const available = items.filter((item) => item.status === 'available').length
		const activeBorrows = (borrowRecords ?? []).filter(
			(row) => row.status === 'confirmed' || row.status === 'borrowed' || row.status === 'return_requested',
		).length
		const overdue = (borrowRecords ?? []).filter(isOverdue).length
		const pendingMaintenance = (maintenance ?? []).filter((row) => row.status === 'pending').length
		return { count: items.length, totalUnits, totalValue, available, activeBorrows, overdue, pendingMaintenance }
	}, [equipment, borrowRecords, maintenance])

	const byStatus = useMemo(() => tallyByStatus(equipment as EquipmentRow[] | undefined, equipmentStatusTone), [equipment])
	const byCategory = useMemo(() => rankBy(equipment, (item) => item.category?.trim() || 'Uncategorized'), [equipment])
	const byDepartment = useMemo(
		() => rankBy(equipment, (item) => item.departments?.name?.trim() || 'Unassigned'),
		[equipment],
	)
	const borrowByStatus = useMemo(
		() => tallyByStatus(borrowRecords as BorrowRecordRow[] | undefined, borrowStatusTone),
		[borrowRecords],
	)
	const maintenanceByStatus = useMemo(
		() => tallyByStatus(maintenance as MaintenanceRequestRow[] | undefined, maintenanceStatusTone),
		[maintenance],
	)
	const maintenanceByPriority = useMemo(
		() => rankBy(maintenance, (row) => row.priority ?? 'medium').map((row) => ({ ...row, tone: priorityTone[row.label] ?? 'primary' })),
		[maintenance],
	)
	const mostBorrowed = useMemo(
		() => rankBy(borrowRecords, (row) => row.equipment?.equipment_name?.trim() || 'Unknown item', 8).filter((row) => row.label !== 'Others'),
		[borrowRecords],
	)

	const anyLoading = equipmentLoading || borrowLoading || maintenanceLoading

	const handleExportCsv = () => {
		const stamp = new Date().toISOString().slice(0, 10)
		downloadCsv(
			`inventory-report-${stamp}.csv`,
			['Code', 'Name', 'Category', 'Status', 'Department', 'Location', 'Quantity', 'Unit Value', 'Total Value', 'Condition', 'Purchase Date'],
			(equipment ?? []).map((item) => [
				item.equipment_code,
				item.equipment_name,
				item.category ?? '',
				item.status,
				item.departments?.name ?? '',
				item.location ?? '',
				item.quantity ?? 1,
				item.value ?? 0,
				(item.value ?? 0) * (item.quantity ?? 1),
				item.condition ?? '',
				item.purchase_date ?? '',
			]),
		)
	}

	const handlePrint = () => {
		const win = window.open('', '_blank', 'width=900,height=700')
		if (!win) return
		const summary = [
			['Inventory Items', totals.count.toLocaleString()],
			['Total Units', totals.totalUnits.toLocaleString()],
			['Total Asset Value', peso.format(totals.totalValue)],
			['Available', totals.available.toLocaleString()],
			['Active Borrows', totals.activeBorrows.toLocaleString()],
			['Overdue', totals.overdue.toLocaleString()],
			['Pending Maintenance', totals.pendingMaintenance.toLocaleString()],
		]
			.map(([label, value]) => `<div class="tile"><span>${label}</span><strong>${value}</strong></div>`)
			.join('')

		win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>BISU Calape — Inventory & Monitoring Report</title>
<style>
	*{box-sizing:border-box}
	body{font-family:'Segoe UI',system-ui,sans-serif;color:#1f2937;margin:32px;font-size:13px}
	h1{font-size:20px;margin:0}
	h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #e5e7eb;padding-bottom:4px}
	.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1d4ed8;padding-bottom:12px}
	.muted{color:#6b7280}
	.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}
	.tile{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
	.tile span{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}
	.tile strong{font-size:17px;color:#1d4ed8}
	table{width:100%;border-collapse:collapse;margin-top:4px}
	th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
	th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#475569}
	td.num,th.num{text-align:right}
	tbody tr td{text-transform:capitalize}
	@media print{body{margin:12mm}}
</style></head><body>
	<div class="head">
		<div><h1>Facilities Inventory &amp; Monitoring Report</h1><p class="muted">BISU Calape Campus &middot; ${scopeLabel}</p></div>
		<div class="muted" style="text-align:right">Generated<br><strong>${generatedAt}</strong><br>By ${user.fullName}</div>
	</div>
	<div class="tiles">${summary}</div>
	${printableTable('Inventory by Status', byStatus)}
	${printableTable('Inventory by Category', byCategory)}
	${isSuperAdmin ? printableTable('Inventory by Department', byDepartment) : ''}
	${printableTable('Borrowing by Status', borrowByStatus)}
	${printableTable('Maintenance by Status', maintenanceByStatus)}
	${printableTable('Most Borrowed Items', mostBorrowed)}
</body></html>`)
		win.document.close()
		win.focus()
		// Give the new document a tick to lay out before invoking the print dialog.
		setTimeout(() => win.print(), 350)
	}

	return (
		<div className="space-y-6">
			<Card
				title="Reports &amp; Analytics"
				subtitle={`Scope · ${scopeLabel}`}
				action={
					<div className="flex flex-wrap gap-2">
						<Button size="sm" variant="secondary" onClick={handleExportCsv} disabled={anyLoading || (equipment?.length ?? 0) === 0}>
							<Download className="h-4 w-4" />
							Export CSV
						</Button>
						<Button size="sm" onClick={handlePrint} disabled={anyLoading}>
							<Printer className="h-4 w-4" />
							Print / PDF
						</Button>
					</div>
				}
			>
				<p className="text-sm text-text-muted">
					Live figures pulled from your inventory, borrowing, and maintenance records. Export a spreadsheet for records, or generate a
					printable PDF for documentation.
				</p>
			</Card>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
				<StatTile label="Inventory Items" value={totals.count.toLocaleString()} detail={`${totals.totalUnits.toLocaleString()} total units`} tone="accent" icon={Package} isLoading={equipmentLoading} />
				<StatTile label="Asset Value" value={peso.format(totals.totalValue)} detail="Estimated total worth" tone="primary" icon={Coins} isLoading={equipmentLoading} />
				<StatTile label="Available" value={totals.available.toLocaleString()} detail="Ready for use" tone="success" icon={CheckCircle2} isLoading={equipmentLoading} />
				<StatTile label="Active Borrows" value={totals.activeBorrows.toLocaleString()} detail="Currently checked out" tone="info" icon={Clock} isLoading={borrowLoading} />
				<StatTile label="Overdue" value={totals.overdue.toLocaleString()} detail="Past return date" tone="danger" icon={AlertTriangle} isLoading={borrowLoading} />
				<StatTile label="Pending Maintenance" value={totals.pendingMaintenance.toLocaleString()} detail="Awaiting action" tone="warning" icon={Wrench} isLoading={maintenanceLoading} />
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Inventory by Status" subtitle="Asset condition split">
					<Bars items={byStatus} isLoading={equipmentLoading} />
				</Card>
				<Card title="Inventory by Category" subtitle="Top categories">
					<Bars items={byCategory} isLoading={equipmentLoading} />
				</Card>
			</div>

			{isSuperAdmin ? (
				<Card title="Inventory by Department" subtitle="Institution-wide distribution">
					<Bars items={byDepartment} isLoading={equipmentLoading} />
				</Card>
			) : null}

			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Borrowing by Status" subtitle="Request pipeline">
					<Bars items={borrowByStatus} isLoading={borrowLoading} />
				</Card>
				<Card title="Maintenance by Priority" subtitle="Workload urgency">
					<Bars items={maintenanceByPriority} isLoading={maintenanceLoading} />
				</Card>
			</div>

			<Card title="Most Borrowed Items" subtitle="Highest demand">
				{borrowLoading ? (
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : mostBorrowed.length === 0 ? (
					<p className="text-sm text-text-muted">No borrow activity yet.</p>
				) : (
					<div className="space-y-2">
						{mostBorrowed.map((item, index) => (
							<div
								key={item.label}
								className="flex items-center gap-3 rounded-xl border border-border bg-bg px-4 py-3 transition hover:border-primary-light hover:shadow-sm"
							>
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-light text-xs font-bold text-primary">
									{index + 1}
								</span>
								<span className="min-w-0 flex-1 truncate font-medium text-text-primary">{item.label}</span>
								<span className="shrink-0 text-sm font-semibold text-text-muted tabular-nums">
									{item.value.toLocaleString()} {item.value === 1 ? 'borrow' : 'borrows'}
								</span>
							</div>
						))}
					</div>
				)}
			</Card>

			<Card title="Inventory Reports" subtitle="Printable format">
				<div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-bg/50 p-8 text-center">
					<Package className="h-8 w-8 text-text-muted" />
					<p className="text-sm font-medium text-text-primary">Inventory report format goes here</p>
					<p className="max-w-md text-xs text-text-muted">
						Reserved for the printable Excel inventory report format — to be added.
					</p>
				</div>
			</Card>
		</div>
	)
}
