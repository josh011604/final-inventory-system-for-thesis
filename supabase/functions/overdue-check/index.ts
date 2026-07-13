import { createClient } from 'npm:@supabase/supabase-js@2'

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

// Manual, on-demand trigger for the overdue sweep that pg_cron also runs hourly.
// Restricted to Super Administrators: the sweep is institution-wide, so a
// department admin must not be able to fire it across other departments.
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

	// Elevated client — only this function holds the service-role key.
	const adminClient = createClient(supabaseUrl, serviceRoleKey)

	const { data: profile, error: profileError } = await adminClient
		.from('profiles')
		.select('role')
		.eq('id', userData.user.id)
		.single()

	if (profileError || !profile) {
		return json({ error: 'Profile not found' }, 403)
	}

	if (profile.role !== 'super_admin') {
		return json({ error: 'Only a Super Administrator can run the overdue check' }, 403)
	}

	const { data, error } = await adminClient.rpc('flag_overdue_borrow_records')

	if (error) {
		return json({ error: error.message }, 400)
	}

	return json({ flagged: typeof data === 'number' ? data : 0 }, 200)
})
