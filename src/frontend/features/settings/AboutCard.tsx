import type { ReactNode } from 'react'
import {
	Atom,
	BarChart3,
	CalendarCheck,
	Database,
	FileCode2,
	Landmark,
	Layers,
	MapPin,
	PackageCheck,
	ShieldCheck,
	Users,
	Wind,
	Wrench,
	Zap,
} from 'lucide-react'
import Card from '@/components/ui/Card'

const appName = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'BISU FIMS'

type Feature = {
	icon: ReactNode
	title: string
	description: string
}

const FEATURES: Feature[] = [
	{
		icon: <CalendarCheck className="h-5 w-5" />,
		title: 'Facility Reservations',
		description: 'Book rooms and venues with live conflict checks per department.',
	},
	{
		icon: <PackageCheck className="h-5 w-5" />,
		title: 'Equipment Borrowing',
		description: 'Request, approve, and return items with on-hand stock kept accurate.',
	},
	{
		icon: <Wrench className="h-5 w-5" />,
		title: 'Maintenance Tracking',
		description: "Log repairs and downtime so a unit's history travels with it.",
	},
	{
		icon: <Layers className="h-5 w-5" />,
		title: 'Inventory Oversight',
		description: 'Browse stock by department with categories, suppliers, and thresholds.',
	},
	{
		icon: <ShieldCheck className="h-5 w-5" />,
		title: 'Role-Based Access',
		description: 'Super Admin, Department Admin, Faculty/Staff, and Student each see only what applies to them.',
	},
	{
		icon: <BarChart3 className="h-5 w-5" />,
		title: 'Audit Trail & Reports',
		description: 'Every approval and return is attributed, exportable for review.',
	},
]

const STATS = [
	{ label: 'Roles', value: '4' },
	{ label: 'Modules', value: '6' },
	{ label: 'Campus', value: '1' },
	{ label: 'Availability', value: '24/7' },
]

const CAMPUS_FIELDS = [
	{ label: 'Location', value: 'Calape, Bohol, Philippines', placeholder: false },
	{ label: 'Office / Custodian contact', value: 'Add contact details', placeholder: true },
	{ label: 'Support hours', value: 'Add office hours', placeholder: true },
	{ label: 'Property office', value: 'Add Supply Office contact', placeholder: true },
]

const ROLES = [
	{ name: 'Super Administrator', description: 'Full system + Supply Office oversight' },
	{ name: 'Department Administrator', description: 'Approves and manages their department' },
	{ name: 'Faculty/Staff', description: 'Requests facilities and equipment' },
	{ name: 'Student', description: 'Requests within department scope' },
]

const CREDITS = [
	{ label: 'Developers', value: 'Joshua Villacura & Hannah Ley Mariel Orapa', placeholder: false },
	{ label: 'Institution', value: 'BISU Calape Campus', placeholder: false },
]

const TECH_STACK: { name: string; icon: ReactNode }[] = [
	{ name: 'React', icon: <Atom className="h-3.5 w-3.5" /> },
	{ name: 'Vite', icon: <Zap className="h-3.5 w-3.5" /> },
	{ name: 'TypeScript', icon: <FileCode2 className="h-3.5 w-3.5" /> },
	{ name: 'Tailwind CSS', icon: <Wind className="h-3.5 w-3.5" /> },
	{ name: 'Supabase', icon: <Database className="h-3.5 w-3.5" /> },
]

export default function AboutCard() {
	return (
		<div className="space-y-6">
			<Card>
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-4">
						<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-hover text-white shadow-sm">
							<Landmark className="h-7 w-7" />
						</div>
						<div>
							<h2 className="text-xl font-semibold text-text-primary">{appName}</h2>
							<p className="text-sm text-text-muted">Facility & Inventory Management System for BISU Calape Campus.</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-primary">
							<span className="h-1.5 w-1.5 rounded-full bg-success" />
							Live
						</span>
						<span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-text-muted">
							v0.0.0
						</span>
					</div>
				</div>
			</Card>

			<Card title="About the System" subtitle="Overview">
				<div className="space-y-4 text-sm text-text-primary">
					<p>
						{appName} is a facility reservations and equipment/inventory management system. It centralizes facility booking,
						equipment borrowing, maintenance tracking, and inventory oversight across departments, with role-based access for
						Super Administrators, Department Administrators, Faculty/Staff, and Students.
					</p>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{STATS.map((stat) => (
							<div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
								<p className="text-2xl font-semibold text-primary">{stat.value}</p>
								<p className="mt-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{stat.label}</p>
							</div>
						))}
					</div>
				</div>
			</Card>

			<Card title="What it does" subtitle="Core capabilities">
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{FEATURES.map((feature) => (
						<div key={feature.title} className="rounded-xl border border-border bg-surface p-4">
							<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">{feature.icon}</div>
							<p className="mt-3 font-semibold text-text-primary">{feature.title}</p>
							<p className="mt-1 text-sm text-text-muted">{feature.description}</p>
						</div>
					))}
				</div>
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card title="Serving — BISU Calape Campus" subtitle="Campus context" action={<MapPin className="h-5 w-5 text-primary" />}>
					<div className="divide-y divide-border">
						{CAMPUS_FIELDS.map((field) => (
							<div key={field.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
								<span className="text-text-muted">{field.label}</span>
								<span className={field.placeholder ? 'italic text-text-muted' : 'font-medium text-text-primary'}>{field.value}</span>
							</div>
						))}
					</div>
					<p className="mt-3 text-xs text-text-muted">
						Fields in italic are placeholders — replace with the campus's actual Supply/Property Office details before shipping.
					</p>
				</Card>

				<Card title="Who uses this" subtitle="Roles" action={<Users className="h-5 w-5 text-primary" />}>
					<div className="space-y-4">
						{ROLES.map((role) => (
							<div key={role.name}>
								<p className="font-semibold text-text-primary">{role.name}</p>
								<p className="text-sm text-text-muted">{role.description}</p>
							</div>
						))}
					</div>
				</Card>
			</div>

			<Card title="Thesis Project Credits" subtitle="Acknowledgements">
				<div className="grid gap-4 sm:grid-cols-2">
					{CREDITS.map((credit) => (
						<div key={credit.label}>
							<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{credit.label}</p>
							<p className={`mt-1 ${credit.placeholder ? 'italic text-text-muted' : 'font-semibold text-text-primary'}`}>{credit.value}</p>
						</div>
					))}
				</div>
				<div className="mt-5 border-t border-border pt-4">
					<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Built with</p>
					<div className="mt-2 flex flex-wrap gap-2">
						{TECH_STACK.map((tech) => (
							<span
								key={tech.name}
								className="inline-flex items-center gap-1.5 rounded-full border border-border bg-accent-light px-3 py-1 text-xs font-medium text-accent"
							>
								{tech.icon}
								{tech.name}
							</span>
						))}
					</div>
				</div>
			</Card>

			<p className="text-sm text-text-muted">For access issues, account requests, or technical support, contact your System Administrator.</p>
		</div>
	)
}
