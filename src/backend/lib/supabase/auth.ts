import { supabase } from '@/backend/lib/supabase/client'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function resolveEmail(identifier: string) {
	const trimmed = identifier.trim()
	if (EMAIL_PATTERN.test(trimmed)) {
		return trimmed
	}

	const { data, error } = await supabase.rpc('email_for_username', { lookup_username: trimmed })
	if (error || !data) {
		return null
	}
	return data as string
}

export async function signIn(identifier: string, password: string) {
	const email = await resolveEmail(identifier)
	if (!email) {
		return { error: 'No account found for that username or email.' }
	}

	const { error } = await supabase.auth.signInWithPassword({ email, password })
	if (error) {
		// Supabase rejects an unconfirmed address before it ever looks at the
		// profile, so this reads as a plain login failure even though the account
		// exists and may already have been activated by an admin. Activation
		// (profiles.status) and email confirmation are separate gates — say so,
		// or the user retries forever wondering why approval "did not work".
		if (/email not confirmed/i.test(error.message)) {
			return {
				error:
					'Your email address has not been confirmed yet. Open the confirmation link Supabase emailed you when you registered, then sign in. This is separate from an administrator activating your account.',
			}
		}
		return { error: error.message }
	}
	return { error: null }
}

export async function signUp(args: {
	email: string
	password: string
	fullName: string
	username: string
	departmentId: string
	// The campus ID typed on the form. It is stored in a different column
	// depending on the account type, and the two columns are separately unique.
	idNumber: string
	accountType: 'employee' | 'student'
}) {
	const isStudent = args.accountType === 'student'

	const { data, error } = await supabase.auth.signUp({
		email: args.email,
		password: args.password,
		options: {
			data: {
				full_name: args.fullName,
				username: args.username,
				department_id: args.departmentId,
				// handle_new_user honours 'student' from a self-service signup and
				// ignores every other value (migration 20260729220000). The account
				// still lands inactive either way — this only decides what it becomes
				// once an admin activates it.
				role: isStudent ? 'student' : 'staff',
				employee_id: isStudent ? '' : args.idNumber,
				student_id: isStudent ? args.idNumber : '',
			},
		},
	})

	if (error) {
		// handle_new_user runs inside the auth.users insert, so a unique violation
		// on username / email / employee_id / student_id aborts the whole signup
		// and GoTrue reports it only as "Database error saving new user".
		if (/database error saving new user/i.test(error.message)) {
			return {
				error:
					'Could not create the account. That username, email, or ID number is probably already taken — try a different one.',
			}
		}
		return { error: error.message }
	}
	if (!data.user) {
		return { error: 'Registration did not return a user.' }
	}
	// With email confirmation enabled, signUp returns a user but no session: the
	// address must be confirmed before the password will ever work. The caller
	// needs to know, otherwise it tells the user to wait for an admin when the
	// next step is actually in their inbox.
	return { error: null, needsEmailConfirmation: !data.session }
}

export async function signOut() {
	await supabase.auth.signOut()
}

// Password reset. Takes the same "username or email" the login box does, so a
// user who only knows their username can still recover the account.
export async function sendPasswordReset(identifier: string) {
	const email = await resolveEmail(identifier)
	if (!email) {
		return { error: 'Enter your username or email above first, then choose Forgot password.' }
	}
	const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
	if (error) {
		return { error: error.message }
	}
	return { error: null }
}

export async function changePassword(email: string, currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
	const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
	if (verifyError) {
		return { error: 'Current password is incorrect.' }
	}

	const { error } = await supabase.auth.updateUser({ password: newPassword })
	if (error) {
		return { error: error.message }
	}

	// Record it in the user's own notifications so a password change they did not
	// make is visible to them. Deliberately not fatal — the returned error is
	// ignored: the password HAS already changed by this point, so surfacing a
	// failure here would tell the user their change did not work when it did.
	await supabase.rpc('notify_password_changed')

	return { error: null }
}
