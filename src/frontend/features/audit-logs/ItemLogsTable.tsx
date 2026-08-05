import type { ReactNode } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import type { AuditLogRow } from '@/backend/lib/supabase/queries'

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 })

function itemValues(row: AuditLogRow) {
	return (row.new_values ?? row.old_values) as unknown as Record<string, unknown> | null
}

function itemName(row: AuditLogRow) {
	const values = itemValues(row)
	return typeof values?.equipment_name === 'string' ? values.equipment_name : `Item #${row.entity_id ?? '—'}`
}

function itemPrice(row: AuditLogRow) {
	const values = itemValues(row)
	return typeof values?.value === 'number' ? peso.format(values.value) : '—'
}

function itemQuantity(row: AuditLogRow) {
	const values = itemValues(row)
	return typeof values?.quantity === 'number' ? String(values.quantity) : '—'
}

const ACTION_LABELS: Record<string, string> = {
	insert_equipment: 'Added',
	update_equipment: 'Updated',
	delete_equipment: 'Removed',
}

export default function ItemLogsTable({ rows, isLoading, toolbar }: { rows: AuditLogRow[]; isLoading: boolean; toolbar?: ReactNode }) {
	return (
		<EntityTablePage<AuditLogRow>
			title="Item Logs"
			subtitle={`${rows.length} inventory item events`}
			rows={rows}
			isLoading={isLoading}
			searchKeys={['action', 'description']}
			emptyMessage="No inventory item activity recorded yet."
			toolbar={toolbar}
			columns={[
				{ header: 'Item Name', render: (row) => <span className="font-medium text-text-primary">{itemName(row)}</span> },
				{ header: 'Action', render: (row) => ACTION_LABELS[row.action] ?? row.action },
				{ header: 'Added By', render: (row) => row.actor?.full_name ?? 'System' },
				{ header: 'Price', render: (row) => itemPrice(row) },
				{ header: 'Quantity', render: (row) => itemQuantity(row) },
				{ header: 'Date', render: (row) => new Date(row.created_at).toLocaleDateString() },
				{ header: 'Time', render: (row) => new Date(row.created_at).toLocaleTimeString() },
			]}
		/>
	)
}
