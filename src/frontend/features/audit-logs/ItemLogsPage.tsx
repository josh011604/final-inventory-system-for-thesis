import { useAuditLogs } from '@/backend/lib/supabase/queries'
import ItemLogsTable from './ItemLogsTable'

export default function ItemLogsPage() {
	const { data, isLoading } = useAuditLogs()
	const itemLogs = (data ?? []).filter((row) => row.entity_type === 'equipment')

	return <ItemLogsTable rows={itemLogs} isLoading={isLoading} />
}
