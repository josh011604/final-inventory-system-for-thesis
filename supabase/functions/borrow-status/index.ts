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

	// ---------- action: create ----------
	if (action === 'create') {
		const equipmentId = Number(body.equipment_id)
		if (!Number.isInteger(equipmentId)) {
			return json({ error: 'equipment_id is required' }, 400)
		}
		// Required, not optional: a record with no due date can never go overdue,
		// so it escapes the overdue sweep, the borrow penalty and every "still
		// out" report. The client blocks submission too, but this is the
		// authority — the endpoint is reachable without going through the modal.
		const expectedReturn = typeof body.expected_return_date === 'string' && body.expected_return_date ? body.expected_return_date : null
		if (!expectedReturn) {
			return json({ error: 'An expected return date is required to borrow an item' }, 400)
		}
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

		// Rule: the return date must be today..+MAX_BORROW_DAYS. Unconditional now
		// that expectedReturn is guaranteed present by the check above.
		{
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

		// Rule: everyone may request any DEPARTMENT's items — a cross-department
		// request is simply routed to that department's admin. The only scope
		// restriction left is that students may not touch Supply Office (central,
		// department-less) inventory. Mirrors enforce_borrow_department_scope.
		if (actor.role === 'student' && equipment.department_id === null) {
			return json({ error: 'Students cannot request Supply Office items' }, 403)
		}

		if (OUT_OF_SERVICE_STATUSES.includes(equipment.status)) {
			return json({ error: 'This item is not available for borrowing' }, 400)
		}

		// Rule: per-unit availability. equipment.quantity IS the on-hand stock —
		// the sync_equipment_stock_on_borrow trigger subtracts each approved
		// request's units from it — so what is free is simply what is left. The
		// trigger re-checks this atomically when the request is approved; this is
		// the friendly up-front version of the same rule.
		const freeUnits = equipment.quantity ?? 0
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
					// This path skips transition_borrow_record, which is what normally
					// stamps these — so they have to be set here or an auto-approved
					// borrow would have no recorded approver at all. The UI reads
					// approved_by_name (not a profiles join, which RLS nulls out for
					// non-admin viewers), so leaving it null shows the approval as "—".
					// The name comes from the resolved profile, never from the client.
					approved_by_name: actor.full_name,
					approved_by_role: actor.role,
					approved_at: new Date().toISOString(),
					department_id: equipment.department_id,
					expected_return_date: expectedReturn,
					notes,
					quantity: requestedQuantity,
					condition_before: conditionBefore,
					// Straight to 'borrowed', not 'confirmed': there is no approval step
					// to wait for and no separate hand-over — the borrower is the
					// approver, so the item is in their hands the moment this lands.
					// 'borrowed' is an active status everywhere it matters (stock
					// deduction, overdue sweep, the Mark Returned action), so the rest
					// of the lifecycle is unchanged.
					status: 'borrowed',
				})
				.select('*')
				.single()
			// The insert lands as 'confirmed', so trg_borrow_stock_sync has already
			// deducted requestedQuantity from equipment.quantity and flipped the
			// item to 'borrowed' if that emptied the shelf. A failure here means
			// the stock check lost a race — report it as an availability problem.
			if (insertError) {
				const isStockError = insertError.message.includes('Not enough units')
				return json({ error: isStockError ? 'Not enough units of this item are in stock right now' : insertError.message }, 400)
			}

			await adminClient.from('audit_logs').insert({
				actor_id: actorId,
				action: 'borrow_auto_approved',
				entity_type: 'borrow_records',
				entity_id: record.id,
				old_values: null,
				new_values: {
					status: 'borrowed',
					quantity: requestedQuantity,
					approved_by_name: actor.full_name,
					approved_by_role: actor.role,
				},
				description: `Borrow request #${record.id} auto-approved for ${actor.full_name} (${actor.role}) — ${requestedQuantity} unit${requestedQuantity === 1 ? '' : 's'} of ${equipment.equipment_name}`,
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

		// Marked cancelled, not deleted: every borrowing transaction has to stay in
		// the history, and a deleted row left no trace outside the super-admin-only
		// audit log. 'cancelled' holds no units (a pending request never did), so
		// no stock moves and the item is immediately requestable again — the
		// duplicate-request guard only looks at status = 'pending'.
		const { error: cancelError } = await adminClient
			.from('borrow_records')
			.update({ status: 'cancelled' })
			.eq('id', recordId)
			.eq('status', 'pending')
		if (cancelError) return json({ error: cancelError.message }, 400)

		await adminClient.from('audit_logs').insert({
			actor_id: actorId,
			action: 'borrow_cancelled',
			entity_type: 'borrow_records',
			entity_id: recordId,
			old_values: { status: 'pending' },
			new_values: { status: 'cancelled' },
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

	// Guard confirms against unit exhaustion before the transition runs, so the
	// approver gets a readable message instead of the raw trigger error. The
	// trigger is still the authority — a pending request may sit for days while
	// other requests drain the stock.
	if (status === 'confirmed') {
		const { data: pendingRecord } = await adminClient.from('borrow_records').select('equipment_id, quantity').eq('id', recordId).maybeSingle()
		if (pendingRecord?.equipment_id != null) {
			const { data: equipment } = await adminClient.from('equipment').select('quantity').eq('id', pendingRecord.equipment_id).single()
			const freeUnits = equipment?.quantity ?? 0
			const needed = Math.max(Number(pendingRecord.quantity ?? 1), 1)
			if (needed > freeUnits) {
				return json({ error: `Only ${freeUnits} unit${freeUnits === 1 ? '' : 's'} in stock — cannot approve a request for ${needed}` }, 400)
			}
		}
	}

	// The SQL function owns authorization, the transition graph, the borrower
	// notification, and the audit log; the stock trigger it fires owns the
	// quantity movement and the equipment status cascade.
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
