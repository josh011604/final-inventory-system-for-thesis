import { Info } from 'lucide-react'
import Card from '@/components/ui/Card'

const appName = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'BISU FIMS'

export default function AboutCard() {
	return (
		<Card title="About Us" subtitle="System information" action={<Info className="h-5 w-5 text-primary" />}>
			<div className="space-y-4 text-sm text-text-primary">
				<p>
					{appName} is a facility reservations and equipment/inventory management system. It centralizes facility booking,
					equipment borrowing, maintenance tracking, and inventory oversight across departments, with role-based access for
					Super Administrators, Department Administrators, Faculty/Staff, and Students.
				</p>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="rounded-xl border border-border bg-surface p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Application</p>
						<p className="mt-1 font-semibold text-text-primary">{appName}</p>
					</div>
					<div className="rounded-xl border border-border bg-surface p-4">
						<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Version</p>
						<p className="mt-1 font-semibold text-text-primary">0.0.0</p>
					</div>
				</div>
				<p className="text-text-muted">For access issues, account requests, or technical support, contact your System Administrator.</p>
			</div>
		</Card>
	)
}
