import Card from '@/components/ui/Card'

export default function ComingSoonPage({ title }: { title: string }) {
	return (
		<Card title={title} subtitle="Module">
			<p className="text-sm text-text-muted">
				This module is being connected to live Supabase data. Check back shortly.
			</p>
		</Card>
	)
}
