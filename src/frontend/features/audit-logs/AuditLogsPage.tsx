import { useState } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import { useAuditLogs } from '@/backend/lib/supabase/queries'
import type { AuditLogRow } from '@/backend/lib/supabase/queries'
import ItemLogsTable from './ItemLogsTable'

export default function AuditLogsPage() {
	const { data, isLoading } = useAuditLogs()
	const [tab, setTab] = useState<'all' | 'items'>('all')
	const itemLogs = (data ?? []).filter((row) => row.entity_type === 'equipment')

	const tabClass = (active: boolean) =>
		`rounded-lg px-4 py-2 text-sm font-semibold transition ${
			active ? 'bg-linear-to-r from-primary to-primary-hover text-white shadow-sm' : 'text-text-muted hover:text-primary'
		}`

	const tabs = (
		<div className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-bg p-1">
			<button type="button" className={tabClass(tab === 'all')} onClick={() => setTab('all')}>
				All Logs
			</button>
			<button type="button" className={tabClass(tab === 'items')} onClick={() => setTab('items')}>
				Item Logs
			</button>
		</div>
	)

	if (tab === 'items') {
		return <ItemLogsTable rows={itemLogs} isLoading={isLoading} toolbar={tabs} />
	}

	return (
		<EntityTablePage<AuditLogRow>
			title="Audit Logs"
			subtitle={`${data?.length ?? 0} events`}
			rows={data}
			isLoading={isLoading}
			searchKeys={['action', 'entity_type', 'description']}
			emptyMessage="No audit events recorded yet."
			toolbar={tabs}
			columns={[
				{ header: 'Actor', render: (row) => row.actor?.full_name ?? 'System' },
				{ header: 'Action', render: (row) => <span className="font-medium text-text-primary">{row.action}</span> },
				{ header: 'Entity', render: (row) => `${row.entity_type}${row.entity_id ? ` #${row.entity_id}` : ''}` },
				{ header: 'Description', render: (row) => row.description ?? '—' },
				{ header: 'When', render: (row) => new Date(row.created_at).toLocaleString() },
			]}
		/>
	)
}
