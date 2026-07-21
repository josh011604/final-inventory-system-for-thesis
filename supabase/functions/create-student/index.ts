import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status: number) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	})
}

// Creates a student account. Only super_admin (any department) or
// department_admin (their own department only) may call this. Password
// hashing is handled by Supabase Auth itself (auth.admin.createUser never
// stores a plaintext password); this function never sees or logs it.
Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: corsHeaders })
	}
	if (req.method !== 'POST') {
		return json({ error: 'Method not allowed' }, 405)
	}

	const authHeader = req.headers.get('Authorization')
	if (!authHeader) {
		return json({ error: 'Missing Authorization header' }, 401)
	}

	let body: {
		full_name?: unknown
		email?: unknown
		password?: unknown
		department_id?: unknown
		student_id?: unknown
	}
	try {
		body = await req.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, 400)
	}

	const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
	const password = typeof body.password === 'string' ? body.password : ''
	const departmentId = typeof body.department_id === 'string' ? body.department_id.trim() : ''
	const studentId = typeof body.student_id === 'string' && body.student_id.trim() ? body.student_id.trim() : null

	const errors: string[] = []
	if (!fullName) errors.push('full_name is required')
	if (!email || !EMAIL_RE.test(email)) errors.push('A valid email is required')
	if (!password || password.length < 8) errors.push('password must be at least 8 characters')
	if (!departmentId) errors.push('department_id is required — every student must belong to exactly one department')
	if (errors.length > 0) {
		return json({ error: errors.join('; ') }, 400)
	}

	const supabaseUrl = Deno.env.get('SUPABASE_URL')!
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
	const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

	// Scoped to the caller's own JWT — used only to verify who's asking, never to write.
	const callerClient = createClient(supabaseUrl, anonKey, {
		global: { headers: { Authorization: authHeader } },
	})
	const { data: userData, error: userError } = await callerClient.auth.getUser()
	if (userError || !userData.user) {
		return json({ error: 'Invalid or expired session' }, 401)
	}
	const actorId = userData.user.id

	const adminClient = createClient(supabaseUrl, serviceRoleKey)

	const { data: actor, error: actorError } = await adminClient
		.from('profiles')
		.select('id, role, department_id, status')
		.eq('id', actorId)
		.single()
	if (actorError || !actor || actor.status !== 'active') {
		return json({ error: 'Account is not active' }, 403)
	}
	if (actor.role !== 'super_admin' && actor.role !== 'department_admin') {
		return json({ error: 'Only admins may create student accounts' }, 403)
	}
	// A department admin may only create students inside their own department.
	if (actor.role === 'department_admin' && departmentId !== actor.department_id) {
		return json({ error: 'You can only create students in your own department' }, 403)
	}

	const { data: department, error: departmentError } = await adminClient
		.from('departments')
		.select('id')
		.eq('id', departmentId)
		.maybeSingle()
	if (departmentError || !department) {
		return json({ error: 'department_id does not match a known department' }, 400)
	}

	const { data: created, error: createError } = await adminClient.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: {
			role: 'student',
			status: 'active',
			full_name: fullName,
			department_id: departmentId,
			student_id: studentId,
		},
	})
	if (createError || !created.user) {
		const message = createError?.message ?? 'Could not create account'
		const isDuplicate = /already registered|already exists/i.test(message)
		return json({ error: message }, isDuplicate ? 409 : 400)
	}

	const { data: profile, error: profileError } = await adminClient
		.from('profiles')
		.select('id, full_name, email, username, role, status, department_id, student_id, created_at')
		.eq('id', created.user.id)
		.single()
	if (profileError || !profile) {
		return json({ error: 'Account created but profile could not be loaded' }, 500)
	}

	// handle_new_user's own audit trigger fires with actor_id = null (no Postgres
	// session for a service-role Admin API call) — log the real actor here instead.
	await adminClient.from('audit_logs').insert({
		actor_id: actorId,
		action: 'create_student',
		entity_type: 'profiles',
		entity_id: null,
		old_values: null,
		new_values: { id: profile.id, email: profile.email, department_id: profile.department_id, student_id: profile.student_id },
		description: `Student account ${profile.full_name} (${profile.email}) created by ${actor.role} ${actorId}`,
	})

	return json({ data: profile }, 201)
})
