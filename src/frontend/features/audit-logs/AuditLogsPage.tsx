import EntityTablePage from '@/components/ui/EntityTablePage'
import { useAuditLogs } from '@/backend/lib/supabase/queries'
import type { AuditLogRow } from '@/backend/lib/supabase/queries'

export default function AuditLogsPage() {
	const { data, isLoading } = useAuditLogs()

	return (
		<EntityTablePage<AuditLogRow>
			title="Audit Logs"
			subtitle={`${data?.length ?? 0} events`}
			rows={data}
			isLoading={isLoading}
			searchKeys={['action', 'entity_type', 'description']}
			emptyMessage="No audit events recorded yet."
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
