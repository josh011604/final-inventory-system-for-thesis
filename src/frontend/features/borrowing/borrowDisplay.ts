import type { ChipTone } from '@/components/ui/StatusChip'

export const statusTone: Record<string, ChipTone> = {
	pending: 'warning',
	confirmed: 'info',
	borrowed: 'info',
	return_requested: 'warning',
	returned: 'success',
	overdue: 'danger',
	rejected: 'danger',
}

export function formatDate(value: string | null) {
	return value ? new Date(value).toLocaleDateString() : '—'
}
