import type { ReactNode } from 'react'

export type ChipTone = 'success' | 'warning' | 'danger' | 'info' | 'muted'

const toneClass: Record<ChipTone, string> = {
	success: 'bg-success/10 text-success ring-1 ring-inset ring-success/25',
	warning: 'bg-warning/10 text-warning ring-1 ring-inset ring-warning/25',
	danger: 'bg-danger/10 text-danger ring-1 ring-inset ring-danger/25',
	info: 'bg-info/10 text-info ring-1 ring-inset ring-info/25',
	muted: 'bg-border/70 text-text-muted ring-1 ring-inset ring-border',
}

const dotClass: Record<ChipTone, string> = {
	success: 'bg-success',
	warning: 'bg-warning',
	danger: 'bg-danger',
	info: 'bg-info',
	muted: 'bg-text-muted',
}

export default function StatusChip({ children, tone = 'muted' }: { children: ReactNode; tone?: ChipTone }) {
	return (
		<span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize ${toneClass[tone]}`}>
			<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass[tone]}`} />
			{children}
		</span>
	)
}
