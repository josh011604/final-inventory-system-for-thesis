// Supabase/PostgREST errors are plain objects, not Error instances, so a bare
// `instanceof Error` check hides the real reason behind a generic fallback.
// Route every mutation catch through this helper instead.

const FRIENDLY_BY_CODE: Record<string, string> = {
	// unique_violation — e.g. an equipment code or category name that already exists
	'23505': 'That value already exists — please use a unique one.',
	// foreign_key_violation
	'23503': 'This record is linked to other data and cannot be changed this way.',
}

export function getErrorMessage(error: unknown, fallback: string): string {
	if (error instanceof Error) return error.message || fallback
	if (error && typeof error === 'object') {
		const { message, code } = error as { message?: unknown; code?: unknown }
		if (typeof code === 'string' && FRIENDLY_BY_CODE[code]) return FRIENDLY_BY_CODE[code]
		if (typeof message === 'string' && message) return message
	}
	return fallback
}
