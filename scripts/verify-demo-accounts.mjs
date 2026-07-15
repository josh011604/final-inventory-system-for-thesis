// Signs in as every demo account with the public anon key (exactly like the
// app does) and verifies the account works end to end: username resolution,
// password sign-in, active profile load, role-scoped RLS visibility, and the
// borrow-status edge function accepting the user's JWT.
//
// Usage: node scripts/verify-demo-accounts.mjs
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
		if (match) {
			env[match[1]] = match[2].trim()
		}
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

// Must stay in sync with the Demo Accounts panel in AuthScreen.tsx.
const demoAccounts = [
	{ username: 'superadmin', password: 'Super123!', role: 'super_admin' },
	{ username: 'bscs.admin', password: 'Admin123!', role: 'department_admin' },
	{ username: 'bscs.staff', password: 'Staff123!', role: 'staff' },
	{ username: 'bsit.admin', password: 'Admin123!', role: 'department_admin' },
	{ username: 'bsit.staff', password: 'Staff123!', role: 'staff' },
	{ username: 'bsf.admin', password: 'Admin123!', role: 'department_admin' },
	{ username: 'bsf.staff', password: 'Staff123!', role: 'staff' },
	{ username: 'cte.admin', password: 'Admin123!', role: 'department_admin' },
	{ username: 'cte.staff', password: 'Staff123!', role: 'staff' },
	{ username: 'midwifery.admin', password: 'Admin123!', role: 'department_admin' },
	{ username: 'midwifery.staff', password: 'Staff123!', role: 'staff' },
]

const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|network/i

// supabase-js surfaces network failures two ways: thrown exceptions and
// resolved `{ error }` results — retry both.
async function withRetry(fn, attempts = 4) {
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

async function verifyAccount(account) {
	const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
	const checks = []
	const fail = (name, detail) => checks.push({ name, ok: false, detail })
	const pass = (name) => checks.push({ name, ok: true })

	try {
		// 1. Username -> email resolution (what the login form does pre-session).
		const { data: email, error: rpcError } = await withRetry(() =>
			supabase.rpc('email_for_username', { lookup_username: account.username }),
		)
		if (rpcError || !email) {
			fail('resolve username', rpcError?.message ?? 'no email returned')
			return checks
		}
		pass('resolve username')

		// 2. Password sign-in.
		const { data: session, error: signInError } = await withRetry(() =>
			supabase.auth.signInWithPassword({ email, password: account.password }),
		)
		if (signInError || !session.session) {
			fail('sign in', signInError?.message ?? 'no session')
			return checks
		}
		pass('sign in')
		const userId = session.session.user.id

		// 3. Active profile loads with the expected role (mirrors App.loadActiveUser).
		const { data: profile, error: profileError } = await withRetry(() =>
			supabase
				.from('profiles')
				.select('id, role, status, department_id')
				.eq('id', userId)
				.eq('status', 'active')
				.maybeSingle(),
		)
		if (profileError || !profile) {
			fail('active profile', profileError?.message ?? 'no active profile row')
			return checks
		}
		if (profile.role !== account.role) {
			fail('role matches', `expected ${account.role}, got ${profile.role}`)
		} else {
			pass('role matches')
		}

		// 4. Departments are readable (used by dashboards and forms).
		const { data: departments, error: deptError } = await withRetry(() => supabase.from('departments').select('id'))
		if (deptError || !departments?.length) {
			fail('read departments', deptError?.message ?? 'no rows')
		} else {
			pass('read departments')
		}

		// 5. Profile visibility respects the role's RLS scope.
		const { data: visibleProfiles, error: visError } = await withRetry(() =>
			supabase.from('profiles').select('id, department_id'),
		)
		if (visError) {
			fail('profile visibility', visError.message)
		} else if (account.role === 'super_admin') {
			if (visibleProfiles.length >= demoAccounts.length) pass('profile visibility')
			else fail('profile visibility', `super admin sees only ${visibleProfiles.length} profiles`)
		} else if (account.role === 'department_admin') {
			const foreign = visibleProfiles.filter((p) => p.department_id !== profile.department_id)
			if (foreign.length === 0 && visibleProfiles.length >= 1) pass('profile visibility')
			else fail('profile visibility', `sees ${foreign.length} profiles outside own department`)
		} else {
			if (visibleProfiles.length === 1 && visibleProfiles[0].id === userId) pass('profile visibility')
			else fail('profile visibility', `staff sees ${visibleProfiles.length} profiles`)
		}

		// 6. Audit logs are super-admin only (RLS returns zero rows for others).
		const { data: auditRows, error: auditError } = await withRetry(() =>
			supabase.from('audit_logs').select('id').limit(5),
		)
		if (auditError) {
			fail('audit log scope', auditError.message)
		} else if (account.role === 'super_admin' || auditRows.length === 0) {
			pass('audit log scope')
		} else {
			fail('audit log scope', `non-admin sees ${auditRows.length} audit rows`)
		}

		// 7. Core tables the dashboard queries must not error.
		for (const table of ['equipment', 'facilities', 'borrow_records', 'maintenance_requests', 'notifications']) {
			const { error } = await withRetry(() => supabase.from(table).select('id').limit(1))
			if (error) fail(`read ${table}`, error.message)
			else pass(`read ${table}`)
		}

		// 8. Edge function accepts this user's JWT end to end. A nonexistent id
		// must come back as a clean JSON 404 from the function, not a network
		// or auth failure.
		const { error: fnError } = await withRetry(() =>
			supabase.functions.invoke('borrow-status', { body: { id: 999999999, status: 'confirmed' } }),
		)
		if (!fnError) {
			fail('edge function', 'expected a 404 for a nonexistent record, got success')
		} else {
			const body = await fnError.context?.json?.().catch(() => null)
			if (body?.error === 'Borrow record not found') pass('edge function')
			else fail('edge function', body?.error ?? fnError.message)
		}

		return checks
	} finally {
		await supabase.auth.signOut().catch(() => {})
	}
}

async function main() {
	let allPassed = true
	for (const account of demoAccounts) {
		const checks = await verifyAccount(account)
		const failed = checks.filter((c) => !c.ok)
		const summary = failed.length === 0 ? 'PASS' : `FAIL (${failed.map((c) => `${c.name}: ${c.detail}`).join('; ')})`
		console.log(`${account.username.padEnd(12)} [${account.role.padEnd(16)}] ${checks.length} checks -> ${summary}`)
		if (failed.length > 0) allPassed = false
	}
	if (!allPassed) process.exit(1)
	console.log('\nAll demo accounts verified: sign-in, RLS scoping, and edge functions all work.')
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
