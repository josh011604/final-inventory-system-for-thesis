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

	// Due-soon pass: remind borrowers whose items are due within the next 24
	// hours (and not yet overdue). Skips anyone already reminded for the same
	// request so repeated checks don't spam.
	let reminded = 0
	const now = new Date()
	const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000)
	const { data: dueSoon } = await adminClient
		.from('borrow_records')
		.select('id, borrower_id, department_id, expected_return_date, equipment(equipment_name)')
		.in('status', ['confirmed', 'borrowed'])
		.gte('expected_return_date', now.toISOString())
		.lte('expected_return_date', soon.toISOString())

	for (const record of dueSoon ?? []) {
		if (!record.borrower_id) continue
		const marker = `request #${record.id} is due`
		const { count } = await adminClient
			.from('notifications')
			.select('id', { count: 'exact', head: true })
			.eq('profile_id', record.borrower_id)
			.eq('title', 'Borrowed item due soon')
			.like('message', `%${marker}%`)
		if ((count ?? 0) > 0) continue
		const itemName = (record as { equipment?: { equipment_name?: string } }).equipment?.equipment_name ?? 'An item'
		await adminClient.from('notifications').insert({
			profile_id: record.borrower_id,
			department_id: record.department_id,
			title: 'Borrowed item due soon',
			message: `${itemName} on borrow request #${record.id} is due ${new Date(record.expected_return_date).toLocaleDateString('en-PH', { dateStyle: 'medium' })}. Please return it on time.`,
			tone: 'warning',
		})
		reminded += 1
	}

	return json({ flagged: typeof data === 'number' ? data : 0, reminded }, 200)
})
