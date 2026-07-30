import { HelpCircle } from 'lucide-react'
import Card from '@/components/ui/Card'

const GUIDE_ITEMS: { name: string; description: string }[] = [
	{ name: 'Dashboard', description: 'overview of key stats, alerts, low-stock items, and recent activity at a glance.' },
	{
		name: 'Facilities',
		description:
			"browse and reserve facilities; admins can add or edit facilities. Reserving your own department's facility (or anything, if you're a super admin) is approved instantly; other bookings go to pending for approval.",
	},
	{
		name: 'Inventory Items',
		description: "view your department's equipment stock. Use the Borrow button on an item row to request it directly when it's available.",
	},
	{
		name: 'Borrowing',
		description:
			'track borrow requests. Use New Request to borrow items from another department or the Supply Office; approvers review and act on pending requests here.',
	},
	{ name: 'History', description: "(students) a read-only record of items you've borrowed and returned." },
	{ name: 'Maintenance', description: 'log and track maintenance work orders for equipment and facilities through to completion.' },
	{ name: 'Users', description: 'manage accounts, roles, and department assignments (admin roles only).' },
	{ name: 'Reports', description: 'generate and export usage, inventory, and borrowing reports.' },
	{ name: 'Notifications', description: 'see alerts for approvals, due dates, and overdue items.' },
	{ name: 'Audit Logs', description: 'a full history of who changed what, for oversight and compliance (super admin only).' },
	{
		name: 'Settings',
		description: 'manage your profile, password, activity history, and (for super admins) categories, suppliers, and backups.',
	},
]

export default function HelpGuideCard() {
	return (
		<Card title="Help & Guide" subtitle="Getting around the system" action={<HelpCircle className="h-5 w-5 text-primary" />}>
			<ul className="space-y-3">
				{GUIDE_ITEMS.map((item) => (
					<li key={item.name} className="text-sm text-text-primary">
						<span className="font-semibold">{item.name}</span> — <span className="text-text-muted">{item.description}</span>
					</li>
				))}
			</ul>
		</Card>
	)
}
