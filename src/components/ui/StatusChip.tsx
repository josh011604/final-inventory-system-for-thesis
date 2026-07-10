import type { ReactNode } from 'react'

export type ChipTone = 'success' | 'warning' | 'danger' | 'info' | 'muted'

const toneClass: Record<ChipTone, string> = {
	success: 'bg-success/10 text-success',
	warning: 'bg-warning/10 text-warning',
	danger: 'bg-danger/10 text-danger',
	info: 'bg-info/10 text-info',
	muted: 'bg-border text-text-muted',
}

export default function StatusChip({ children, tone = 'muted' }: { children: ReactNode; tone?: ChipTone }) {
	return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneClass[tone]}`}>{children}</span>
}
