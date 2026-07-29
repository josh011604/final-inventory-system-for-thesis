import { createClient } from 'npm:@supabase/supabase-js@2'
import { decryptPii, encryptPii } from '../_shared/pii-crypto.ts'

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	})
}

// Reads/writes profiles.employee_id_enc and profiles.phone_enc. The
// encryption key never reaches Postgres — it lives only in this function's
// PROFILE_PII_KEY secret — so plaintext PII only ever exists here and in the
// caller's response.
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

	const piiKey = Deno.env.get('PROFILE_PII_KEY')
	if (!piiKey) {
		return json({ error: 'Server is not configured for PII encryption' }, 500)
	}

	let body: {
		action?: unknown
		profile_id?: unknown
		employee_id?: unknown
		phone?: unknown
	}
	try {
		body = await req.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, 400)
	}

	const action = body.action
	if (action !== 'get' && action !== 'set') {
		return json({ error: "action must be 'get' or 'set'" }, 400)
	}

	const supabaseUrl = Deno.env.get('SUPABASE_URL')!
	const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
	const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

	if (action === 'set') {
		const updates: Record<string, string | null> = {}
		if ('employee_id' in body) {
			const value = body.employee_id
			if (value !== null && typeof value !== 'string') {
				return json({ error: 'employee_id must be a string or null' }, 400)
			}
			updates.employee_id_enc = value ? await encryptPii(value, piiKey) : null
		}
		if ('phone' in body) {
			const value = body.phone
			if (value !== null && typeof value !== 'string') {
				return json({ error: 'phone must be a string or null' }, 400)
			}
			updates.phone_enc = value ? await encryptPii(value, piiKey) : null
		}
		if (Object.keys(updates).length === 0) {
			return json({ error: 'Provide employee_id and/or phone to set' }, 400)
		}

		// Self-service only — there is no existing admin-edit flow for another
		// user's employee_id/phone to mirror here.
		const { error: updateError } = await adminClient.from('profiles').update(updates).eq('id', actorId)
		if (updateError) {
			return json({ error: 'Could not save profile PII' }, 500)
		}
		return json({ data: { ok: true } }, 200)
	}

	// action === 'get'
	const targetId = typeof body.profile_id === 'string' && body.profile_id.trim() ? body.profile_id.trim() : actorId

	const { data: target, error: targetError } = await adminClient
		.from('profiles')
		.select('id, department_id, employee_id_enc, phone_enc')
		.eq('id', targetId)
		.maybeSingle()
	if (targetError || !target) {
		return json({ error: 'Profile not found' }, 404)
	}

	// Mirrors the "profiles select own or admin" RLS policy exactly.
	const authorized =
		target.id === actorId ||
		actor.role === 'super_admin' ||
		(actor.role === 'department_admin' && target.department_id === actor.department_id)
	if (!authorized) {
		return json({ error: 'Not authorized to view this profile' }, 403)
	}

	const employeeId = target.employee_id_enc ? await decryptPii(target.employee_id_enc, piiKey) : null
	const phone = target.phone_enc ? await decryptPii(target.phone_enc, piiKey) : null

	return json({ data: { employee_id: employeeId, phone } }, 200)
})
