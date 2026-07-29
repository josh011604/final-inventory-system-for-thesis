// One-off backfill: encrypts existing plaintext profiles.employee_id/phone
// into employee_id_enc/phone_enc (AES-256-GCM, see
// supabase/functions/_shared/pii-crypto.ts for the Edge Function side of the
// same format). Safe to re-run — only rows missing the *_enc value are
// touched, and the plaintext columns are left untouched.
//
// Usage: node scripts/backfill-profile-pii.mjs
// Requires VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PROFILE_PII_KEY
// (the same value passed to `supabase secrets set PROFILE_PII_KEY=...`) in
// .env.local.

import { createClient } from '@supabase/supabase-js'
import { webcrypto } from 'node:crypto'
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
const piiKeyB64 = env.PROFILE_PII_KEY

if (!url || !serviceRoleKey || !piiKeyB64) {
	console.error('Missing VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or PROFILE_PII_KEY in .env.local')
	process.exit(1)
}

async function importKey(keyB64) {
	const raw = Uint8Array.from(Buffer.from(keyB64, 'base64'))
	if (raw.length !== 32) {
		console.error(`PROFILE_PII_KEY must decode to 32 bytes (AES-256), got ${raw.length}`)
		process.exit(1)
	}
	return webcrypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt'])
}

async function encryptPii(plaintext, key) {
	const iv = webcrypto.getRandomValues(new Uint8Array(12))
	const ciphertext = new Uint8Array(
		await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
	)
	const combined = new Uint8Array(iv.length + ciphertext.length)
	combined.set(iv, 0)
	combined.set(ciphertext, iv.length)
	return Buffer.from(combined).toString('base64')
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

const { data: rows, error } = await admin
	.from('profiles')
	.select('id, employee_id, employee_id_enc, phone, phone_enc')
	.or('and(employee_id.not.is.null,employee_id_enc.is.null),and(phone.not.is.null,phone_enc.is.null)')

if (error) {
	console.error('Could not load profiles:', error.message)
	process.exit(1)
}

if (rows.length === 0) {
	console.log('Nothing to backfill — every profile with plaintext PII already has an encrypted copy.')
	process.exit(0)
}

const key = await importKey(piiKeyB64)
let updated = 0

for (const row of rows) {
	const updates = {}
	if (row.employee_id && !row.employee_id_enc) {
		updates.employee_id_enc = await encryptPii(row.employee_id, key)
	}
	if (row.phone && !row.phone_enc) {
		updates.phone_enc = await encryptPii(row.phone, key)
	}
	if (Object.keys(updates).length === 0) continue

	const { error: updateError } = await admin.from('profiles').update(updates).eq('id', row.id)
	if (updateError) {
		console.error(`Failed to backfill profile ${row.id}:`, updateError.message)
		continue
	}
	updated += 1
}

console.log(`Backfilled ${updated} of ${rows.length} profile(s).`)
