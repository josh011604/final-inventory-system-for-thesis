// Deletes every Supabase auth user that is NOT a super_admin, so the account
// list can be rebuilt from scratch by seed-demo-accounts.mjs. All super_admin
// profiles are kept.
//
// Destructive: deleting an auth user cascades its profile and, through the
// existing foreign keys, its borrow records (borrow_records.borrower_id is
// ON DELETE CASCADE). Created-by / approver / requester references are set null.
//
// Usage: node scripts/prune-accounts.mjs
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

const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|network/i

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

async function main() {
	const { data: profiles, error } = await withRetry(() => admin.from('profiles').select('id, username, role'))
	if (error) throw new Error(`Failed to load profiles: ${error.message}`)

	const keepIds = new Set(profiles.filter((p) => p.role === 'super_admin').map((p) => p.id))
	const keptUsernames = profiles.filter((p) => p.role === 'super_admin').map((p) => p.username)

	if (keepIds.size === 0) {
		console.error('Refusing to prune: no super_admin profile found (this would remove every account).')
		process.exit(1)
	}

	const toDelete = []
	let page = 1
	for (;;) {
		const { data, error: listError } = await withRetry(() => admin.auth.admin.listUsers({ page, perPage: 200 }))
		if (listError) throw new Error(`listUsers failed: ${listError.message}`)
		for (const user of data.users) {
			if (!keepIds.has(user.id)) toDelete.push({ id: user.id, email: user.email })
		}
		if (data.users.length < 200) break
		page += 1
	}

	const deleted = []
	const failed = []
	for (const user of toDelete) {
		const { error: deleteError } = await withRetry(() => admin.auth.admin.deleteUser(user.id))
		if (deleteError) failed.push({ email: user.email, error: deleteError.message })
		else deleted.push(user.email)
	}

	console.log(`Kept super_admin account(s): ${keptUsernames.join(', ')}`)
	console.log(`Deleted ${deleted.length} account(s):`)
	for (const email of deleted) console.log(`  - ${email}`)
	if (failed.length > 0) {
		console.log(`Failed to delete ${failed.length}:`)
		for (const f of failed) console.log(`  - ${f.email}: ${f.error}`)
		process.exit(1)
	}
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
