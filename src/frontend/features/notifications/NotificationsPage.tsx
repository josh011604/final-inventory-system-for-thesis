import EntityTablePage from '@/components/ui/EntityTablePage'
import StatusChip from '@/components/ui/StatusChip'
import Button from '@/components/ui/Button'
import { useMarkNotificationRead, useNotifications } from '@/backend/lib/supabase/queries'
import type { Tables } from '@/backend/types/supabase'

const toneMap: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
	info: 'info',
	warning: 'warning',
	success: 'success',
	danger: 'danger',
}

export default function NotificationsPage() {
	const { data, isLoading } = useNotifications()
	const markRead = useMarkNotificationRead()

	return (
		<EntityTablePage<Tables<'notifications'>>
			title="Notifications"
			subtitle={`${data?.filter((n) => !n.is_read).length ?? 0} unread`}
			rows={data}
			isLoading={isLoading}
			searchKeys={['title', 'message']}
			emptyMessage="No notifications yet."
			columns={[
				{
					header: 'Notification',
					render: (row) => (
						<div>
							<p className="font-medium text-text-primary">{row.title}</p>
							<p className="text-xs text-text-muted">{row.message}</p>
						</div>
					),
				},
				{ header: 'Tone', render: (row) => <StatusChip tone={toneMap[row.tone] ?? 'muted'}>{row.tone}</StatusChip> },
				{ header: 'Received', render: (row) => new Date(row.created_at).toLocaleString() },
				{
					header: 'Status',
					render: (row) =>
						row.is_read ? (
							<StatusChip tone="muted">Read</StatusChip>
						) : (
							<Button size="sm" variant="secondary" onClick={() => markRead.mutate(row.id)}>
								Mark read
							</Button>
						),
				},
			]}
		/>
	)
}
