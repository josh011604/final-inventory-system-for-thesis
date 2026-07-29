// AES-256-GCM helpers shared by Edge Functions that handle profile PII.
// The key (PROFILE_PII_KEY, 32 raw bytes base64-encoded) must only ever be
// set as an Edge Function secret — never written to a Postgres table or
// setting — so ciphertext stored in the database stays unreadable without
// this process's environment.

const ALGO = 'AES-GCM'
const IV_BYTES = 12
const KEY_BYTES = 32

async function importKey(keyB64: string): Promise<CryptoKey> {
	const raw = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0))
	if (raw.length !== KEY_BYTES) {
		throw new Error(`PROFILE_PII_KEY must decode to ${KEY_BYTES} bytes (AES-256), got ${raw.length}`)
	}
	return crypto.subtle.importKey('raw', raw, ALGO, false, ['encrypt', 'decrypt'])
}

export async function encryptPii(plaintext: string, keyB64: string): Promise<string> {
	const key = await importKey(keyB64)
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
	const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: ALGO, iv }, key, new TextEncoder().encode(plaintext)))

	const combined = new Uint8Array(iv.length + ciphertext.length)
	combined.set(iv, 0)
	combined.set(ciphertext, iv.length)

	let binary = ''
	for (const byte of combined) binary += String.fromCharCode(byte)
	return btoa(binary)
}

export async function decryptPii(payloadB64: string, keyB64: string): Promise<string> {
	const key = await importKey(keyB64)
	const combined = Uint8Array.from(atob(payloadB64), (c) => c.charCodeAt(0))
	const iv = combined.slice(0, IV_BYTES)
	const ciphertext = combined.slice(IV_BYTES)

	const plaintext = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext)
	return new TextDecoder().decode(plaintext)
}
