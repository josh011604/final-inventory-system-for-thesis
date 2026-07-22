import type { ChipTone } from '@/components/ui/StatusChip'

export const availabilityTone: Record<string, ChipTone> = {
	available: 'success',
	reserved: 'warning',
	in_use: 'info',
	under_maintenance: 'muted',
}

export const reservationTone: Record<string, ChipTone> = {
	pending: 'warning',
	approved: 'success',
	rejected: 'danger',
	cancelled: 'muted',
}

// 'HH:MM:SS' (or 'HH:MM') → '1:00 PM'
export function formatTime(value: string) {
	const [hourText, minute] = value.split(':')
	const hour = Number(hourText)
	const period = hour >= 12 ? 'PM' : 'AM'
	const twelve = hour % 12 === 0 ? 12 : hour % 12
	return `${twelve}:${minute} ${period}`
}
