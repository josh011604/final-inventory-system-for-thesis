import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const VALID_STATUSES = ['confirmed', 'rejected', 'returned']

function json(body: unknown, status: number) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...corsHeaders, 'Content-Type': 'application/json' },
	})
}

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

	let body: { id?: unknown; status?: unknown }
	try {
		body = await req.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, 400)
	}

	const { id, status } = body
	if (typeof id !== 'number' || typeof status !== 'string' || !VALID_STATUSES.includes(status)) {
		return json({ error: 'Body must be { id: number, status: confirmed|rejected|returned }' }, 400)
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

	// Elevated client — only this function holds the service-role key, and it
	// only ever acts through transition_borrow_record(), which re-checks the
	// actor's role/department and the equipment's availability before writing.
	const adminClient = createClient(supabaseUrl, serviceRoleKey)

	const { data, error } = await adminClient
		.rpc('transition_borrow_record', {
			p_record_id: id,
			p_new_status: status,
			p_actor_id: userData.user.id,
		})
		.single()

	if (error) {
		const httpStatus = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400
		return json({ error: error.message }, httpStatus)
	}

	return json({ data }, 200)
})
