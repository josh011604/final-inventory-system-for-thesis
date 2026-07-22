// Supabase/PostgREST errors are plain objects, not Error instances, so a bare
// `instanceof Error` check hides the real reason behind a generic fallback.
// Route every mutation catch through this helper instead.

const FRIENDLY_BY_CODE: Record<string, string> = {
	// unique_violation — e.g. an equipment code or category name that already exists
	'23505': 'That value already exists — please use a unique one.',
	// foreign_key_violation
	'23503': 'This record is linked to other data and cannot be changed this way.',
	// exclusion_violation — the facility_reservations no-overlap constraint. The
	// clashing booking may be one the caller's RLS policy hides, so the database
	// is the only place this can be caught.
	'23P01': 'That time slot is already taken for this facility. Please pick another slot.',
	// insufficient_privilege — typically a row-level security policy rejecting
	// the write outright (e.g. an auto-approve attempt from a role that isn't
	// actually the approver).
	'42501': 'You do not have permission to do that.',
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
