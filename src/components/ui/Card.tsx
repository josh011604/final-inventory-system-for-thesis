import type { PropsWithChildren, ReactNode } from 'react'

type CardProps = PropsWithChildren<{
	title?: string
	subtitle?: string
	action?: ReactNode
	className?: string
}>

export default function Card({ title, subtitle, action, className = '', children }: CardProps) {
	return (
		<section className={`rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md ${className}`}>
			{title || subtitle || action ? (
				<div className="mb-4 flex flex-wrap items-start justify-between gap-3">
					<div>
						{subtitle ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{subtitle}</p> : null}
						{title ? <h3 className="mt-1 text-lg font-semibold text-text-primary">{title}</h3> : null}
					</div>
					{action}
				</div>
			) : null}
			{children}
		</section>
	)
}
