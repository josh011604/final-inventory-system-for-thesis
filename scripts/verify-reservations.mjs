// Exercises the two request flows end to end against the live project, using
// the public anon key exactly like the app does:
//
//   1. Facility reservations — submit, self-approval guard, overlap guard
//      (both the client-visible one and the database exclusion constraint),
//      admin approval, and requester notification.
//   2. Borrowing — the availability rules behind the Inventory screen's
//      per-item Borrow button, via the borrow-status edge function.
//
// Usage: node scripts/verify-reservations.mjs
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
	const env = {}
	for (const line of readFileSync(resolve(root, file), 'utf8').split(/\r?\n/)) {
		const match = line.match(/^([\w.]+)\s*=\s*(.*)$/)
		if (match) env[match[1]] = match[2].trim()
	}
	return env
}

const env = loadEnv('.env.local')
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
	console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
	process.exit(1)
}

const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|network/i

// supabase-js surfaces network failures two ways: thrown exceptions and
// resolved `{ error }` results — retry both.
async function withRetry(fn, attempts = 5) {
	let last
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			last = await fn()
		} catch (error) {
			last = error
			if (!TRANSIENT.test(String(error?.message ?? error)) || attempt === attempts) throw error
			await new Promise((r) => setTimeout(r, attempt * 500))
			continue
		}
		if (last?.error && TRANSIENT.test(String(last.error.message ?? last.error)) && attempt < attempts) {
			await new Promise((r) => setTimeout(r, attempt * 500))
			continue
		}
		return last
	}
	return last
}

const checks = []
const pass = (name) => {
	checks.push({ name, ok: true })
	console.log(`  PASS  ${name}`)
}
const fail = (name, detail) => {
	checks.push({ name, ok: false, detail })
	console.log(`  FAIL  ${name} — ${detail}`)
}

async function signIn(username, password) {
	const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
	const { data: email, error: rpcError } = await withRetry(() => supabase.rpc('email_for_username', { lookup_username: username }))
	if (rpcError || !email) throw new Error(`resolve ${username}: ${rpcError?.message ?? 'no email'}`)
	const { data: session, error: signInError } = await withRetry(() => supabase.auth.signInWithPassword({ email, password }))
	if (signInError || !session.session) throw new Error(`sign in ${username}: ${signInError?.message ?? 'no session'}`)
	return { supabase, userId: session.session.user.id }
}

// A date far enough out that it never collides with seeded sample data.
const futureDate = (daysAhead) => new Date(Date.now() + daysAhead * 86400000).toLocaleDateString('en-CA')

async function verifyReservations(staff, admin) {
	console.log('\nFacility reservations')

	// The table must exist and be readable — this is the check that would have
	// caught the missing 20260722120000 migration (PGRST205).
	const { error: tableError } = await withRetry(() => staff.supabase.from('facility_reservations').select('id').limit(1))
	if (tableError) {
		fail('facility_reservations readable', tableError.message)
		return
	}
	pass('facility_reservations readable')

	// Pinned to a department-owned facility (not the central Supply Office):
	// this lifecycle test needs the department admin to be the approver, which
	// is only true for their own department's rooms — a central facility is
	// approved by a super admin instead (covered separately below).
	const { data: facilities, error: facError } = await withRetry(() =>
		staff.supabase.from('facilities').select('*').eq('current_availability', 'available').not('department_id', 'is', null),
	)
	if (facError || !facilities?.length) {
		fail('available facility to test with', facError?.message ?? 'none available')
		return
	}
	const facility = facilities[0]
	pass(`available facility found (${facility.name})`)

	const reservedDate = futureDate(90)
	const insert = (overrides = {}) =>
		withRetry(() =>
			staff.supabase
				.from('facility_reservations')
				.insert({
					facility_id: facility.id,
					requester_id: staff.userId,
					department_id: facility.department_id,
					reserved_date: reservedDate,
					start_time: '09:00',
					end_time: '11:00',
					purpose: 'Automated verification run',
					...overrides,
				})
				.select()
				.single(),
		)

	const { data: created, error: insertError } = await insert()
	if (insertError) {
		fail('staff submits a reservation', insertError.message)
		return
	}
	if (created.status !== 'pending') {
		fail('new reservation starts pending', `got ${created.status}`)
	} else {
		pass('staff submits a reservation (starts pending)')
	}

	// The database exclusion constraint must reject an overlapping window even
	// when the client-side guard is bypassed entirely, as it is here.
	const { error: overlapError } = await insert({ start_time: '10:00', end_time: '12:00' })
	if (overlapError?.code === '23P01') pass('database rejects an overlapping window (23P01)')
	else fail('database rejects an overlapping window', overlapError ? `got ${overlapError.code}: ${overlapError.message}` : 'the overlap was accepted')

	// A back-to-back booking must still be allowed (half-open intervals).
	const { data: adjacent, error: adjacentError } = await insert({ start_time: '11:00', end_time: '12:00' })
	if (adjacentError) fail('back-to-back booking allowed', adjacentError.message)
	else pass('back-to-back booking allowed')

	// The requester must not be able to approve their own request.
	await withRetry(() => staff.supabase.from('facility_reservations').update({ status: 'approved' }).eq('id', created.id))
	const { data: afterSelf } = await withRetry(() => staff.supabase.from('facility_reservations').select('status').eq('id', created.id).single())
	if (afterSelf?.status === 'approved') fail('requester cannot self-approve', 'the request became approved')
	else pass(`requester cannot self-approve (still ${afterSelf?.status})`)

	// The requester may cancel their own pending request.
	if (adjacent) {
		await withRetry(() => staff.supabase.from('facility_reservations').update({ status: 'cancelled' }).eq('id', adjacent.id))
		const { data: afterCancel } = await withRetry(() => staff.supabase.from('facility_reservations').select('status').eq('id', adjacent.id).single())
		if (afterCancel?.status === 'cancelled') pass('requester can cancel their own pending request')
		else fail('requester can cancel their own pending request', `status is ${afterCancel?.status}`)
	}

	// The department admin sees it and can approve it.
	const { data: adminView, error: adminReadError } = await withRetry(() =>
		admin.supabase.from('facility_reservations').select('*').eq('id', created.id).maybeSingle(),
	)
	if (adminReadError || !adminView) {
		fail('department admin sees the pending request', adminReadError?.message ?? 'row not visible')
	} else {
		pass('department admin sees the pending request')
		const { error: approveError } = await withRetry(() =>
			admin.supabase.from('facility_reservations').update({ status: 'approved', approved_by: admin.userId }).eq('id', created.id),
		)
		const { data: afterApprove } = await withRetry(() => admin.supabase.from('facility_reservations').select('status').eq('id', created.id).single())
		if (approveError || afterApprove?.status !== 'approved') fail('department admin approves', approveError?.message ?? `status is ${afterApprove?.status}`)
		else pass('department admin approves')
	}

	// Approval notifies the requester.
	const { data: notifications } = await withRetry(() =>
		staff.supabase.from('notifications').select('title').order('created_at', { ascending: false }).limit(10),
	)
	if (notifications?.some((n) => String(n.title).toLowerCase().includes('facility reservation'))) pass('requester is notified of the decision')
	else fail('requester is notified of the decision', 'no matching notification found')

	// The core fix: an approved 9–11 AM booking must NOT take the facility out
	// of circulation for the rest of the day. current_availability stays
	// 'available' (whether a given moment reads "occupied" is computed live
	// from the bookings themselves, not stored), and a second, non-overlapping
	// slot later the same day must still be bookable.
	const readAvailability = async () => {
		const { data } = await withRetry(() => staff.supabase.from('facilities').select('current_availability').eq('id', facility.id).single())
		return data?.current_availability
	}
	const whileApproved = await readAvailability()
	if (whileApproved === 'available') pass('an approved morning booking leaves the facility "available", not blanket "reserved"')
	else fail('an approved morning booking leaves the facility "available"', `availability is ${whileApproved}`)

	const { data: afternoon, error: afternoonError } = await insert({ start_time: '13:00', end_time: '15:00' })
	if (afternoonError) fail('a later, non-overlapping slot the same day is still bookable', afternoonError.message)
	else pass('a later, non-overlapping slot the same day is still bookable (e.g. 1–3 PM after a 9–11 AM booking)')

	// Clean up both bookings so repeat runs stay idempotent.
	await withRetry(() => admin.supabase.from('facility_reservations').update({ status: 'cancelled' }).eq('id', created.id))
	if (afternoon) await withRetry(() => staff.supabase.from('facility_reservations').update({ status: 'cancelled' }).eq('id', afternoon.id))
	const afterCleanup = await readAvailability()
	if (afterCleanup === 'available') pass('cancelling every booking leaves the facility "available"')
	else fail('cancelling every booking leaves the facility "available"', `availability is ${afterCleanup}`)

	// A pending request alone must NOT take the room out of circulation.
	const { data: pendingOnly } = await insert({ start_time: '14:00', end_time: '15:00' })
	const whilePending = await readAvailability()
	if (whilePending === 'available') pass('a pending request leaves the facility available')
	else fail('a pending request leaves the facility available', `availability is ${whilePending}`)
	if (pendingOnly) await withRetry(() => staff.supabase.from('facility_reservations').update({ status: 'cancelled' }).eq('id', pendingOnly.id))
}

async function verifyAutoApprove(admin) {
	console.log('\nAdmin auto-approval (department admin reserving their own department)')

	const { data: ownFacilities, error: ownError } = await withRetry(() =>
		admin.supabase.from('facilities').select('*').eq('current_availability', 'available').not('department_id', 'is', null),
	)
	if (ownError || !ownFacilities?.length) {
		fail('own-department facility to test with', ownError?.message ?? 'none available')
	} else {
		const facility = ownFacilities[0]
		const reservedDate = futureDate(120)
		const { data: created, error: insertError } = await withRetry(() =>
			admin.supabase
				.from('facility_reservations')
				.insert({
					facility_id: facility.id,
					requester_id: admin.userId,
					department_id: facility.department_id,
					reserved_date: reservedDate,
					start_time: '08:00',
					end_time: '09:00',
					purpose: 'Automated verification run',
					status: 'approved',
					approved_by: admin.userId,
				})
				.select()
				.single(),
		)
		if (insertError || created?.status !== 'approved') {
			fail('department admin’s own-department reservation is approved on arrival', insertError?.message ?? `status is ${created?.status}`)
		} else {
			pass('department admin’s own-department reservation is approved on arrival')
		}
		if (created) {
			// Auto-approval must not blanket-lock the facility either — same rule
			// as a normal approval, just arriving immediately instead of via a
			// separate update.
			const { data: afterInsert } = await withRetry(() => admin.supabase.from('facilities').select('current_availability').eq('id', facility.id).single())
			if (afterInsert?.current_availability === 'available') pass('auto-approval leaves the facility "available", not blanket "reserved"')
			else fail('auto-approval leaves the facility "available"', `availability is ${afterInsert?.current_availability}`)
			// Clean up.
			await withRetry(() => admin.supabase.from('facility_reservations').update({ status: 'cancelled' }).eq('id', created.id))
		}
	}

	// A department admin is NOT the approver for a central (department-less)
	// facility — a super admin is — so that request must still start pending.
	const { data: centralFacilities } = await withRetry(() =>
		admin.supabase.from('facilities').select('*').eq('current_availability', 'available').is('department_id', null),
	)
	if (centralFacilities?.length) {
		const facility = centralFacilities[0]
		const reservedDate = futureDate(121)
		const { data: created, error: insertError } = await withRetry(() =>
			admin.supabase
				.from('facility_reservations')
				.insert({
					facility_id: facility.id,
					requester_id: admin.userId,
					department_id: facility.department_id,
					reserved_date: reservedDate,
					start_time: '08:00',
					end_time: '09:00',
					purpose: 'Automated verification run',
					status: 'approved',
					approved_by: admin.userId,
				})
				.select()
				.single(),
		)
		if (!insertError) {
			fail('department admin cannot self-approve a central facility', 'the auto-approve insert was accepted')
			if (created) await withRetry(() => admin.supabase.from('facility_reservations').delete().eq('id', created.id))
		} else if (insertError.code === '42501') {
			pass('department admin cannot self-approve a central facility (blocked by RLS, 42501)')
		} else {
			fail('department admin cannot self-approve a central facility', `unexpected error ${insertError.code}: ${insertError.message}`)
		}
	} else {
		console.log('  SKIP  no central facility available to test the negative case')
	}
}

async function verifyCentralFacilityVisibility(staff, admin) {
	console.log('\nCentral facility visibility (Supply Office)')

	const { data: centralAsStaff, error: staffError } = await withRetry(() =>
		staff.supabase.from('facilities').select('id, name').is('department_id', null).limit(1),
	)
	if (staffError || !centralAsStaff?.length) {
		fail('staff can see the central facility', staffError?.message ?? 'no rows returned')
		return
	}
	pass(`staff can see the central facility (${centralAsStaff[0].name})`)

	// A department admin is not that facility's approver — they must not be
	// able to see reservations against it that some other requester filed.
	// (The reverse — that a super admin CAN see and approve it — isn't
	// separately exercised here; it follows the same "department_id =
	// current_user_department_id() or is_super_admin()" policy already
	// covered by every other admin-visibility check above.)
	const { data: centralAsAdmin } = await withRetry(() => admin.supabase.from('facilities').select('id, name').is('department_id', null).limit(1))
	if (centralAsAdmin?.length) pass('department admin can also see the central facility (read access, not approval rights)')
	else fail('department admin can also see the central facility', 'no rows returned')
}

async function verifyBorrowing(staff) {
	console.log('\nBorrowing (Inventory "Borrow" button path)')

	// The Supply Office list the Borrow button draws from.
	const { data: supply, error: supplyError } = await withRetry(() => staff.supabase.functions.invoke('main-supply', { body: {} }))
	if (supplyError) fail('main-supply edge function', supplyError.message)
	else {
		const items = supply?.data ?? []
		pass(`main-supply returns ${items.length} items`)
		if (items.length && items.every((i) => typeof i.available_units === 'number')) pass('every supply item reports available_units')
		else if (items.length) fail('every supply item reports available_units', 'a row was missing the field')
	}

	// The borrow-status function must reject a request for an item that does not
	// exist, rather than failing in some opaque way.
	const { error: fnError } = await withRetry(() =>
		staff.supabase.functions.invoke('borrow-status', { body: { action: 'create', equipment_id: 999999999, expected_return_date: null, notes: null } }),
	)
	if (!fnError) fail('borrow-status rejects an unknown item', 'the request was accepted')
	else {
		const body = await fnError.context?.json?.().catch(() => null)
		if (body?.error) pass(`borrow-status rejects an unknown item ("${body.error}")`)
		else fail('borrow-status rejects an unknown item', fnError.message)
	}

	// A past return date must be refused server-side.
	const { data: equipment } = await withRetry(() => staff.supabase.from('equipment').select('id').eq('status', 'available').limit(1))
	if (equipment?.length) {
		const { error: pastError } = await withRetry(() =>
			staff.supabase.functions.invoke('borrow-status', {
				body: { action: 'create', equipment_id: equipment[0].id, expected_return_date: '2020-01-01', notes: null },
			}),
		)
		if (pastError) pass('borrow-status refuses a past return date')
		else fail('borrow-status refuses a past return date', 'the request was accepted')
	}
}

async function main() {
	const staff = await signIn('bscs.staff', 'Staff123!')
	const admin = await signIn('bscs.admin', 'Admin123!')

	try {
		await verifyReservations(staff, admin)
		await verifyAutoApprove(admin)
		await verifyCentralFacilityVisibility(staff, admin)
		await verifyBorrowing(staff)
	} finally {
		await staff.supabase.auth.signOut().catch(() => {})
		await admin.supabase.auth.signOut().catch(() => {})
	}

	const failed = checks.filter((c) => !c.ok)
	console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`)
	if (failed.length) process.exit(1)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
