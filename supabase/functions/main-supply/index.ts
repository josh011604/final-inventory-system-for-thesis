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

// Read-only list of Main Supply (Central Inventory) equipment — items owned by
// the super admin (department_id is null) that anyone signed in may request
// through the New Request workflow. Served from here so the client works even
// where the equipment RLS policy hasn't been widened to expose null-department
// rows; the function verifies the caller's session and returns only the slim
// columns the request form needs.
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

	// Scoped to the caller's own JWT — used only to verify who's asking.
	const callerClient = createClient(supabaseUrl, anonKey, {
		global: { headers: { Authorization: authHeader } },
	})

	const { data: userData, error: userError } = await callerClient.auth.getUser()
	if (userError || !userData.user) {
		return json({ error: 'Invalid or expired session' }, 401)
	}

	const adminClient = createClient(supabaseUrl, serviceRoleKey)

	const { data, error } = await adminClient
		.from('equipment')
		.select('id, equipment_code, equipment_name, department_id, status, quantity')
		.is('department_id', null)
		.order('equipment_name')

	if (error) {
		return json({ error: error.message }, 400)
	}

	const items = data ?? []

	// Per-unit availability: quantity minus units currently out on active borrows.
	const { data: activeBorrows } = await adminClient
		.from('borrow_records')
		.select('equipment_id')
		.in('status', ['confirmed', 'borrowed', 'return_requested', 'overdue'])
		.in('equipment_id', items.map((item) => item.id))

	const unitsOut = new Map<number, number>()
	for (const row of activeBorrows ?? []) {
		unitsOut.set(row.equipment_id, (unitsOut.get(row.equipment_id) ?? 0) + 1)
	}

	return json(
		{
			data: items.map((item) => ({
				...item,
				available_units: Math.max((item.quantity ?? 1) - (unitsOut.get(item.id) ?? 0), 0),
			})),
		},
		200,
	)
})
