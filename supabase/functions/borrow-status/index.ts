import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// A borrow record in one of these states holds one physical unit of the item.
const ACTIVE_STATUSES = ['confirmed', 'borrowed', 'return_requested', 'overdue']
// Equipment statuses that take an item out of service entirely — no unit can be
// borrowed regardless of stock. 'borrowed' is deliberately absent: for multi-unit
// stock it only means some units are out, so free units remain requestable.
const OUT_OF_SERVICE_STATUSES = ['maintenance', 'damaged', 'lost', 'disposed']
const TRANSITION_STATUSES = ['confirmed', 'rejected', 'returned']
// Business rules for new requests.
const MAX_ACTIVE_BORROWS_PER_USER = 3
const MAX_BORROW_DAYS = 14

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

	let body: {
		action?: unknown
		id?: unknown
		status?: unknown
		equipment_id?: unknown
		expected_return_date?: unknown
		notes?: unknown
		condition_after?: unknown
	}
	try {
		body = await req.json()
	} catch {
		return json({ error: 'Invalid JSON body' }, 400)
	}

	// Back-compat: `{ id, status }` bodies behave like a transition action.
	const action = typeof body.action === 'string' ? body.action : 'transition'

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

	// Elevated client — every rule below re-validates before it writes.
	const adminClient = createClient(supabaseUrl, serviceRoleKey)

	const { data: actor, error: actorError } = await adminClient
		.from('profiles')
		.select('id, role, department_id, full_name, status')
		.eq('id', actorId)
		.single()
	if (actorError || !actor || actor.status !== 'active') {
		return json({ error: 'Account is not active' }, 403)
	}

	// Units currently out for an item — the SUM of each active request's
	// quantity, since one request can now hold several units.
	async function activeUnitCount(equipmentId: number): Promise<number> {
		const { data } = await adminClient
			.from('borrow_records')
			.select('quantity')
			.eq('equipment_id', equipmentId)
			.in('status', ACTIVE_STATUSES)
		return (data ?? []).reduce((sum, row) => sum + Math.max(Number(row.quantity ?? 1), 1), 0)
	}

	// ---------- action: create ----------
	if (action === 'create') {
		const equipmentId = Number(body.equipment_id)
		if (!Number.isInteger(equipmentId)) {
			return json({ error: 'equipment_id is required' }, 400)
		}
		const expectedReturn = typeof body.expected_return_date === 'string' && body.expected_return_date ? body.expected_return_date : null
		const notes = typeof body.notes === 'string' && body.notes ? body.notes : null

		// How many units this request is for. Defaults to 1; must be a positive
		// integer. The upper bound is checked against live availability below.
		const quantity = Number(body.quantity)
		if (body.quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1)) {
			return json({ error: 'Quantity must be a whole number of at least 1' }, 400)
		}
		const requestedQuantity = Number.isInteger(quantity) && quantity >= 1 ? quantity : 1

		// Rule: overdue-borrow penalty. A member still holding an item past its
		// return date is barred from borrowing again until they return it. The
		// super admin is exempt. Mirrors the enforce_borrow_overdue_penalty trigger.
		if (actor.role !== 'super_admin') {
			const { data: heldRecords } = await adminClient
				.from('borrow_records')
				.select('status, expected_return_date')
				.eq('borrower_id', actorId)
				.in('status', ACTIVE_STATUSES)
			const nowMs = Date.now()
			const hasOverdue = (heldRecords ?? []).some(
				(row) =>
					row.status === 'overdue' ||
					(row.expected_return_date != null &&
						['confirmed', 'borrowed', 'return_requested'].includes(row.status) &&
						new Date(row.expected_return_date).getTime() < nowMs),
			)
			if (hasOverdue) {
				return json({ error: 'You have an overdue borrowed item. Return it before borrowing again.' }, 403)
			}
		}

		// Rule: the return date must be today..+MAX_BORROW_DAYS.
		if (expectedReturn) {
			const due = new Date(expectedReturn)
			if (Number.isNaN(due.getTime())) return json({ error: 'Invalid expected return date' }, 400)
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			if (due.getTime() < today.getTime()) {
				return json({ error: 'Expected return date cannot be in the past' }, 400)
			}
			if (due.getTime() > today.getTime() + MAX_BORROW_DAYS * 86_400_000) {
				return json({ error: `Borrow period cannot exceed ${MAX_BORROW_DAYS} days` }, 400)
			}
		}

		const { data: equipment } = await adminClient
			.from('equipment')
			.select('id, equipment_name, department_id, status, quantity, condition')
			.eq('id', equipmentId)
			.maybeSingle()
		if (!equipment) return json({ error: 'Equipment not found' }, 404)

		// Rule: only students are department-locked — they may request only their
		// own department's items and never Supply Office inventory. Everyone else
		// (faculty, department admins, super admin) may request Supply Office items
		// or any department's items; a cross-department request is routed to that
		// department's admin. Mirrors enforce_borrow_department_scope.
		if (actor.role === 'student' && equipment.department_id !== actor.department_id) {
			return json({ error: 'Students can only request items from their own department' }, 403)
		}

		if (OUT_OF_SERVICE_STATUSES.includes(equipment.status)) {
			return json({ error: 'This item is not available for borrowing' }, 400)
		}

		// Rule: per-unit availability — quantity minus units already out. An
		// in-service item stays borrowable while any unit is free, and the whole
		// requested quantity must fit within what is currently free.
		const unitsOut = await activeUnitCount(equipmentId)
		const freeUnits = (equipment.quantity ?? 1) - unitsOut
		if (freeUnits <= 0) {
			return json({ error: 'All units of this item are currently borrowed' }, 400)
		}
		if (requestedQuantity > freeUnits) {
			return json({ error: `Only ${freeUnits} unit${freeUnits === 1 ? '' : 's'} of this item ${freeUnits === 1 ? 'is' : 'are'} available right now` }, 400)
		}

		// Rule: no duplicate pending request for the same item by the same person.
		const { count: dupCount } = await adminClient
			.from('borrow_records')
			.select('id', { count: 'exact', head: true })
			.eq('equipment_id', equipmentId)
			.eq('borrower_id', actorId)
			.eq('status', 'pending')
		if ((dupCount ?? 0) > 0) {
			return json({ error: 'You already have a pending request for this item' }, 400)
		}

		// Rule: cap simultaneous borrows (pending + active) per user.
		const { count: mineCount } = await adminClient
			.from('borrow_records')
			.select('id', { count: 'exact', head: true })
			.eq('borrower_id', actorId)
			.in('status', ['pending', ...ACTIVE_STATUSES])
		if ((mineCount ?? 0) >= MAX_ACTIVE_BORROWS_PER_USER) {
			return json({ error: `You already have ${MAX_ACTIVE_BORROWS_PER_USER} pending or active borrows — return an item first` }, 400)
		}

		// The item's condition at the moment it is borrowed, captured on every
		// request so the history records what shape the item was in when it went
		// out. condition_after is filled in on return.
		const conditionBefore = equipment.condition ?? null

		// Auto-approve: an approver borrowing an item they themselves have
		// approval authority over skips the pending step — a super admin taking a
		// Supply Office item, or a department admin taking their own department's
		// item. Anyone else (all faculty and student requests) stays pending.
		const isAutoApproved =
			(equipment.department_id === null && actor.role === 'super_admin') ||
			(equipment.department_id !== null && actor.role === 'department_admin' && equipment.department_id === actor.department_id)

		if (isAutoApproved) {
			// Written with the service-role client so it can land as 'confirmed'
			// (the "borrow insert scoped" RLS pins client inserts to 'pending').
			// approved_by is the borrower themselves — they are the authorizing
			// admin — and an explicit audit entry records that it was automatic.
			const { data: record, error: insertError } = await adminClient
				.from('borrow_records')
				.insert({
					equipment_id: equipmentId,
					borrower_id: actorId,
					created_by: actorId,
					approved_by: actorId,
					department_id: equipment.department_id,
					expected_return_date: expectedReturn,
					notes,
					quantity: requestedQuantity,
					condition_before: conditionBefore,
					status: 'confirmed',
				})
				.select('*')
				.single()
			if (insertError) return json({ error: insertError.message }, 400)

			// Flip the item to 'borrowed' only once every unit is out; while stock
			// remains it stays 'available'.
			if (unitsOut + requestedQuantity >= (equipment.quantity ?? 1)) {
				await adminClient.from('equipment').update({ status: 'borrowed' }).eq('id', equipmentId)
			}

			await adminClient.from('audit_logs').insert({
				actor_id: actorId,
				action: 'borrow_auto_approved',
				entity_type: 'borrow_records',
				entity_id: record.id,
				old_values: null,
				new_values: { status: 'confirmed', quantity: requestedQuantity },
				description: `Borrow request #${record.id} auto-approved for ${actor.full_name} (${requestedQuantity} unit${requestedQuantity === 1 ? '' : 's'} of ${equipment.equipment_name})`,
			})

			return json({ data: record }, 200)
		}

		// Inserted through callerClient (the requester's own JWT), not adminClient:
		// the request is always for the caller themselves, so "borrow insert
		// scoped" RLS already permits it, and doing it this way lets auth.uid()
		// resolve inside audit_row_change() so the audit trail records who
		// actually submitted the request instead of logging it as 'System'.
		const { data: record, error: insertError } = await callerClient
			.from('borrow_records')
			.insert({
				equipment_id: equipmentId,
				borrower_id: actorId,
				created_by: actorId,
				department_id: equipment.department_id,
				expected_return_date: expectedReturn,
				notes,
				quantity: requestedQuantity,
				condition_before: conditionBefore,
				status: 'pending',
			})
			.select('*')
			.single()
		if (insertError) return json({ error: insertError.message }, 400)

		// Notify the approvers who can actually clear this request:
		//   * Supply Office item  → super admins;
		//   * department item     → that department's admins, plus (for a student
		//     borrower) that department's faculty, who may also approve.
		let approverQuery
		if (equipment.department_id === null) {
			approverQuery = adminClient.from('profiles').select('id').eq('role', 'super_admin').eq('status', 'active')
		} else {
			const roles = actor.role === 'student' ? ['department_admin', 'staff'] : ['department_admin']
			approverQuery = adminClient.from('profiles').select('id').in('role', roles).eq('department_id', equipment.department_id).eq('status', 'active')
		}
		const { data: approvers } = await approverQuery
		if (approvers && approvers.length > 0) {
			await adminClient.from('notifications').insert(
				approvers.map((approver) => ({
					profile_id: approver.id,
					department_id: equipment.department_id,
					title: 'New borrow request',
					message: `${actor.full_name} requested ${requestedQuantity} × ${equipment.equipment_name} (request #${record.id}).`,
					tone: 'info',
				})),
			)
		}

		return json({ data: record }, 200)
	}

	// ---------- actions below all need an existing record ----------
	const recordId = Number(body.id)
	if (!Number.isInteger(recordId)) {
		return json({ error: 'id is required' }, 400)
	}

	// ---------- action: cancel (borrower withdraws own pending request) ----------
	if (action === 'cancel') {
		const { data: record } = await adminClient.from('borrow_records').select('*').eq('id', recordId).maybeSingle()
		if (!record) return json({ error: 'Borrow record not found' }, 404)
		if (record.borrower_id !== actorId) return json({ error: 'You can only cancel your own request' }, 403)
		if (record.status !== 'pending') return json({ error: 'Only pending requests can be cancelled' }, 400)

		const { error: deleteError } = await adminClient.from('borrow_records').delete().eq('id', recordId)
		if (deleteError) return json({ error: deleteError.message }, 400)

		await adminClient.from('audit_logs').insert({
			actor_id: actorId,
			action: 'borrow_cancelled',
			entity_type: 'borrow_records',
			entity_id: recordId,
			old_values: { status: 'pending' },
			new_values: null,
			description: `Borrow request #${recordId} cancelled by the requester`,
		})

		return json({ data: { id: recordId, cancelled: true } }, 200)
	}

	// ---------- action: transition (approve / reject / return) ----------
	if (action !== 'transition') {
		return json({ error: `Unknown action ${action}` }, 400)
	}
	const status = body.status
	if (typeof status !== 'string' || !TRANSITION_STATUSES.includes(status)) {
		return json({ error: 'Body must be { id: number, status: confirmed|rejected|returned }' }, 400)
	}

	// Guard confirms against unit exhaustion before the transition runs — the
	// SQL transition only checks the coarse equipment status. The pending record
	// is not yet counted in units-out, so its own quantity must still fit.
	if (status === 'confirmed') {
		const { data: pendingRecord } = await adminClient.from('borrow_records').select('equipment_id, quantity').eq('id', recordId).maybeSingle()
		if (pendingRecord?.equipment_id != null) {
			const { data: equipment } = await adminClient.from('equipment').select('quantity').eq('id', pendingRecord.equipment_id).single()
			const unitsOut = await activeUnitCount(pendingRecord.equipment_id)
			const freeUnits = (equipment?.quantity ?? 1) - unitsOut
			const needed = Math.max(Number(pendingRecord.quantity ?? 1), 1)
			if (needed > freeUnits) {
				return json({ error: `Only ${Math.max(freeUnits, 0)} unit${freeUnits === 1 ? '' : 's'} available — cannot approve a request for ${needed}` }, 400)
			}
		}
	}

	// The SQL function owns authorization, the transition graph, the equipment
	// status cascade, the borrower notification, and the audit log.
	const { data, error } = await adminClient
		.rpc('transition_borrow_record', {
			p_record_id: recordId,
			p_new_status: status,
			p_actor_id: actorId,
		})
		.single()

	if (error) {
		const httpStatus = error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : 400
		return json({ error: error.message }, httpStatus)
	}

	const record = data as { id: number; equipment_id: number | null; department_id: string | null; borrower_id: string | null }

	// Per-unit correction: the SQL cascade flips the whole item to 'borrowed' on
	// confirm; with multi-unit stock the item stays available until every unit
	// is out.
	if (record.equipment_id != null && status === 'confirmed') {
		const { data: equipment } = await adminClient.from('equipment').select('quantity, status').eq('id', record.equipment_id).single()
		if (equipment) {
			const unitsOut = await activeUnitCount(record.equipment_id)
			if (unitsOut < (equipment.quantity ?? 1) && equipment.status === 'borrowed') {
				await adminClient.from('equipment').update({ status: 'available' }).eq('id', record.equipment_id)
			}
		}
	}

	// Condition on return: record it, and a damaged return automatically opens
	// a high-priority maintenance request and flags the item.
	if (status === 'returned' && typeof body.condition_after === 'string' && body.condition_after) {
		const conditionAfter = body.condition_after
		await adminClient.from('borrow_records').update({ condition_after: conditionAfter }).eq('id', recordId)

		if (conditionAfter === 'Damaged' && record.equipment_id != null) {
			await adminClient.from('equipment').update({ status: 'damaged', condition: 'Damaged' }).eq('id', record.equipment_id)
			const { data: maintenance } = await adminClient
				.from('maintenance_requests')
				.insert({
					department_id: record.department_id,
					equipment_id: record.equipment_id,
					requester_id: actorId,
					status: 'pending',
					priority: 'high',
					description: `Item returned damaged on borrow request #${recordId}; automatic inspection request.`,
				})
				.select('id')
				.single()
			await adminClient.from('audit_logs').insert({
				actor_id: actorId,
				action: 'borrow_damaged_return',
				entity_type: 'borrow_records',
				entity_id: recordId,
				old_values: null,
				new_values: { condition_after: conditionAfter, maintenance_request_id: maintenance?.id ?? null },
				description: `Borrow request #${recordId} returned damaged — maintenance request ${maintenance?.id ? `#${maintenance.id} ` : ''}opened`,
			})
		}
	}

	return json({ data }, 200)
})
