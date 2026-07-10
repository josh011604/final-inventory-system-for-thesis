import type { PropsWithChildren } from 'react'

type ModalProps = PropsWithChildren<{
	open: boolean
	onClose: () => void
	title: string
}>

export default function Modal({ open, onClose, title, children }: ModalProps) {
	if (!open) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
				<div className="mb-4 flex items-center justify-between">
					<h3 className="text-lg font-semibold text-text-primary">{title}</h3>
					<button type="button" onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition hover:bg-bg" aria-label="Close">
						✕
					</button>
				</div>
				{children}
			</div>
		</div>
	)
}
