// Creates (or repairs) the demo accounts shown on the login screen so they are
// real, working Supabase auth users with the right role, department, and an
// active status.
//
// The auth trigger (handle_new_user) always creates profiles as
// role='staff', status='inactive'; elevated roles are applied here through an
// explicit service-role UPDATE, which protect_profile_privileges allows.
//
// Usage: node scripts/seed-demo-accounts.mjs
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

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
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
	console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
	process.exit(1)
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

// Passwords must stay in sync with the Demo Accounts panel in
// src/frontend/features/auth/AuthScreen.tsx and README.md. Department names must
// match the departments created by the 20260713130000_reconfigure_departments
// migration. Run scripts/prune-accounts.mjs first for a clean slate.
const BSCS = 'Bachelor of Science in Computer Science (BSCS)'
const BSIT = 'Bachelor of Science in Industrial Technology, major in Electricity'
const BSF = 'Bachelor of Science in Fisheries, major in Inland Fisheries'
const CTE = 'College of Teacher Education'
const MIDWIFERY = 'Midwifery'

const demoAccounts = [
	{ username: 'superadmin', password: 'Super123!', role: 'super_admin', department: null, fullName: 'System Administrator', position: 'System Administrator', employeeId: 'SA-0001' },
	{ username: 'bscs.admin', password: 'Admin123!', role: 'department_admin', department: BSCS, fullName: 'BSCS Program Head', position: 'Program Head', employeeId: 'DA-2001' },
	{ username: 'bscs.staff', password: 'Staff123!', role: 'staff', department: BSCS, fullName: 'BSCS Staff', position: 'Staff', employeeId: 'ST-2001' },
	{ username: 'bsit.admin', password: 'Admin123!', role: 'department_admin', department: BSIT, fullName: 'BSIT Electricity Program Head', position: 'Program Head', employeeId: 'DA-2002' },
	{ username: 'bsit.staff', password: 'Staff123!', role: 'staff', department: BSIT, fullName: 'BSIT Electricity Staff', position: 'Staff', employeeId: 'ST-2002' },
	{ username: 'bsf.admin', password: 'Admin123!', role: 'department_admin', department: BSF, fullName: 'Inland Fisheries Program Head', position: 'Program Head', employeeId: 'DA-2003' },
	{ username: 'bsf.staff', password: 'Staff123!', role: 'staff', department: BSF, fullName: 'Inland Fisheries Staff', position: 'Staff', employeeId: 'ST-2003' },
	{ username: 'cte.admin', password: 'Admin123!', role: 'department_admin', department: CTE, fullName: 'Teacher Education Dean', position: 'Dean', employeeId: 'DA-2004' },
	{ username: 'cte.staff', password: 'Staff123!', role: 'staff', department: CTE, fullName: 'Teacher Education Staff', position: 'Staff', employeeId: 'ST-2004' },
	{ username: 'midwifery.admin', password: 'Admin123!', role: 'department_admin', department: MIDWIFERY, fullName: 'Midwifery Program Head', position: 'Program Head', employeeId: 'DA-2005' },
	{ username: 'midwifery.staff', password: 'Staff123!', role: 'staff', department: MIDWIFERY, fullName: 'Midwifery Staff', position: 'Staff', employeeId: 'ST-2005' },
	{ username: 'bscs.student', password: 'Student123!', role: 'student', department: BSCS, fullName: 'BSCS Student', position: 'Student', studentId: 'STU-4001' },
]

const emailFor = (username) => `${username.replace(/[^a-z0-9]/gi, '.')}@example.com`

const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|network/i

// The connection to this Supabase host drops intermittently; retry transient
// network failures a few times before giving up. supabase-js surfaces them
// two ways — thrown exceptions and resolved `{ error }` results — retry both.
async function withRetry(label, fn, attempts = 4) {
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

async function findAuthUserIdByEmail(email) {
	let page = 1
	for (;;) {
		const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
		if (error) throw new Error(`listUsers failed: ${error.message}`)
		const hit = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
		if (hit) return hit.id
		if (data.users.length < 200) return null
		page += 1
	}
}

async function main() {
	const { data: departments, error: deptError } = await withRetry('departments', () =>
		admin.from('departments').select('id, name'),
	)
	if (deptError) throw new Error(`Failed to load departments: ${deptError.message}`)
	const departmentIdByName = new Map(departments.map((d) => [d.name, d.id]))

	const results = []

	for (const account of demoAccounts) {
		const email = emailFor(account.username)
		const departmentId = account.department ? departmentIdByName.get(account.department) : null
		if (account.department && !departmentId) {
			results.push({ username: account.username, outcome: `FAILED: department "${account.department}" not found` })
			continue
		}

		try {
			const { data: existing, error: lookupError } = await withRetry(account.username, () =>
				admin.from('profiles').select('id, email').eq('username', account.username).maybeSingle(),
			)
			if (lookupError) throw new Error(`profile lookup failed: ${lookupError.message}`)

			let userId = existing?.id ?? null
			let outcome = 'updated'

			if (!userId) {
				const { data: created, error: createError } = await withRetry(account.username, () =>
					admin.auth.admin.createUser({
						email,
						password: account.password,
						email_confirm: true,
						user_metadata: {
							full_name: account.fullName,
							username: account.username,
							department_id: departmentId ?? '',
							position: account.position,
							employee_id: account.employeeId,
							student_id: account.studentId,
						},
					}),
				)
				if (createError) {
					// Auth user may exist without a matching profile username; recover its id.
					if (/already.*registered|email_exists/i.test(createError.message) || createError.code === 'email_exists') {
						userId = await withRetry(account.username, () => findAuthUserIdByEmail(email))
						if (!userId) throw new Error(`email ${email} exists but user id not found`)
					} else {
						throw new Error(`createUser failed: ${createError.message}`)
					}
				} else {
					userId = created.user.id
					outcome = 'created'
				}
			}

			// Known password + confirmed email, whether the user is new or old.
			const { error: authUpdateError } = await withRetry(account.username, () =>
				admin.auth.admin.updateUserById(userId, { password: account.password, email_confirm: true }),
			)
			if (authUpdateError) throw new Error(`auth update failed: ${authUpdateError.message}`)

			// Elevate role / activate via service role (bypasses the privilege guard by design).
			const { error: profileError } = await withRetry(account.username, () =>
				admin
					.from('profiles')
					.update({
						full_name: account.fullName,
						username: account.username,
						role: account.role,
						status: 'active',
						department_id: departmentId,
						position: account.position,
						employee_id: account.employeeId ?? null,
						student_id: account.studentId ?? null,
					})
					.eq('id', userId),
			)
			if (profileError) throw new Error(`profile update failed: ${profileError.message}`)

			const { data: final, error: finalError } = await withRetry(account.username, () =>
				admin.from('profiles').select('username, role, status').eq('id', userId).single(),
			)
			if (finalError) throw new Error(`verification read failed: ${finalError.message}`)

			results.push({ username: account.username, outcome, role: final.role, status: final.status })
		} catch (error) {
			results.push({ username: account.username, outcome: `FAILED: ${error.message}` })
		}
	}

	console.table(results)
	const failed = results.filter((r) => String(r.outcome).startsWith('FAILED'))
	if (failed.length > 0) {
		process.exit(1)
	}
	console.log('All demo accounts are live and active.')
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
