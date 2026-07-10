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
	position: string
	employeeId: string
}) {
	const { data, error } = await supabase.auth.signUp({
		email: args.email,
		password: args.password,
		options: {
			data: {
				full_name: args.fullName,
				username: args.username,
				department_id: args.departmentId,
				position: args.position,
				employee_id: args.employeeId,
			},
		},
	})

	if (error) {
		return { error: error.message }
	}
	if (!data.user) {
		return { error: 'Registration did not return a user.' }
	}
	return { error: null }
}

export async function signOut() {
	await supabase.auth.signOut()
}
