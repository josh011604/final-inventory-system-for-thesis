// Seeds realistic sample content (categories, suppliers, facilities, equipment,
// and a few borrow / maintenance records) per department so the dashboard and
// feature pages look populated instead of empty.
//
// Idempotent: lookup/equipment rows are upserted on their unique keys, and the
// sample borrow/maintenance rows are tagged with a marker and replaced on each
// run, so re-running never creates duplicates and never touches real data that
// lacks the marker.
//
// Usage: node scripts/seed-sample-data.mjs
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MARKER = '[sample-data]'

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
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
	console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
	process.exit(1)
}
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

const TRANSIENT = /fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|network/i
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

const daysFromNow = (days) => new Date(Date.now() + days * 86_400_000).toISOString()

const CATEGORIES = ['Computing', 'Networking', 'Audio Visual', 'Laboratory', 'Power Tools', 'Kitchen Equipment', 'Fisheries Equipment', 'Medical Equipment', 'Furniture']

const SUPPLIERS = [
	{ name: 'CDO Tech Supplies', contact_person: 'Grace Villamor', phone: '0917-555-1042', email: 'sales@cdotech.example' },
	{ name: 'EduLab Philippines', contact_person: 'Noel Trinidad', phone: '0918-555-2231', email: 'orders@edulab.example' },
	{ name: 'MarinePro Equipment', contact_person: 'Rhea Delgado', phone: '0920-555-7788', email: 'support@marinepro.example' },
	{ name: 'Campus Hardware Depot', contact_person: 'Ferdie Ong', phone: '0921-555-3390', email: 'depot@campushardware.example' },
]

// Keyed by the department's full name (must match the departments created by the
// 20260713130000_reconfigure_departments migration). Equipment codes are stable,
// so re-running also reassigns any equipment left department-less by that
// migration onto the correct new department.
const DEPARTMENTS = {
	'Bachelor of Science in Computer Science (BSCS)': {
		facilities: [
			{ name: 'CS Laboratory 1', facility_type: 'Computer Laboratory', capacity: 40 },
			{ name: 'CS Server Room', facility_type: 'Server Room', capacity: 10 },
		],
		equipment: [
			{ code: 'ASSET-CS-001', name: 'Dell OptiPlex Desktop', category: 'Computing', status: 'borrowed', quantity: 25, condition: 'Good', value: 32000, unit: 'unit', supplier: 'CDO Tech Supplies', facility: 'CS Laboratory 1' },
			{ code: 'ASSET-CS-002', name: 'Cisco 24-Port Switch', category: 'Networking', status: 'available', quantity: 4, condition: 'Excellent', value: 18500, unit: 'unit', supplier: 'CDO Tech Supplies', facility: 'CS Server Room' },
			{ code: 'ASSET-CS-003', name: 'Epson Projector EB-X51', category: 'Audio Visual', status: 'borrowed', quantity: 3, condition: 'Good', value: 24000, unit: 'unit', supplier: 'CDO Tech Supplies', facility: 'CS Laboratory 1' },
			{ code: 'ASSET-CS-004', name: 'Rack Server Unit', category: 'Computing', status: 'maintenance', quantity: 1, condition: 'Fair', value: 95000, unit: 'unit', supplier: 'CDO Tech Supplies', facility: 'CS Server Room' },
		],
	},
	'Bachelor of Science in Industrial Technology, major in Electricity': {
		facilities: [
			{ name: 'Electrical Workshop', facility_type: 'Workshop', capacity: 30 },
			{ name: 'Electronics Laboratory', facility_type: 'Laboratory', capacity: 25 },
		],
		equipment: [
			{ code: 'ASSET-IT-001', name: 'Digital Multimeter', category: 'Laboratory', status: 'available', quantity: 15, condition: 'Good', value: 2200, unit: 'unit', supplier: 'Campus Hardware Depot', facility: 'Electrical Workshop' },
			{ code: 'ASSET-IT-002', name: 'Soldering Station', category: 'Power Tools', status: 'available', quantity: 10, condition: 'Good', value: 3500, unit: 'unit', supplier: 'Campus Hardware Depot', facility: 'Electronics Laboratory' },
			{ code: 'ASSET-IT-003', name: 'Digital Oscilloscope', category: 'Laboratory', status: 'maintenance', quantity: 2, condition: 'Fair', value: 45000, unit: 'unit', supplier: 'Campus Hardware Depot', facility: 'Electronics Laboratory' },
			{ code: 'ASSET-IT-004', name: 'Bench Power Supply', category: 'Power Tools', status: 'available', quantity: 6, condition: 'Good', value: 8500, unit: 'unit', supplier: 'Campus Hardware Depot', facility: 'Electrical Workshop' },
		],
	},
	'Bachelor of Science in Fisheries, major in Inland Fisheries': {
		facilities: [
			{ name: 'Aquaculture Hatchery', facility_type: 'Laboratory', capacity: 35 },
			{ name: 'Inland Fisheries Laboratory', facility_type: 'Laboratory', capacity: 25 },
		],
		equipment: [
			{ code: 'ASSET-FS-001', name: 'Water Quality Test Kit', category: 'Fisheries Equipment', status: 'available', quantity: 12, condition: 'Good', value: 6800, unit: 'kit', supplier: 'MarinePro Equipment', facility: 'Aquaculture Hatchery' },
			{ code: 'ASSET-FS-002', name: 'Dissolved Oxygen Meter', category: 'Laboratory', status: 'available', quantity: 5, condition: 'Excellent', value: 21000, unit: 'unit', supplier: 'MarinePro Equipment', facility: 'Inland Fisheries Laboratory' },
			{ code: 'ASSET-FS-003', name: 'Pond Aerator Pump', category: 'Fisheries Equipment', status: 'available', quantity: 8, condition: 'Good', value: 9500, unit: 'unit', supplier: 'MarinePro Equipment', facility: 'Aquaculture Hatchery' },
			{ code: 'ASSET-FS-004', name: 'Binocular Microscope', category: 'Laboratory', status: 'borrowed', quantity: 10, condition: 'Good', value: 17500, unit: 'unit', supplier: 'MarinePro Equipment', facility: 'Inland Fisheries Laboratory' },
		],
	},
	'College of Teacher Education': {
		facilities: [
			{ name: 'Education Resource Room', facility_type: 'Classroom', capacity: 50 },
			{ name: 'Micro-Teaching Lab', facility_type: 'Laboratory', capacity: 20 },
		],
		equipment: [
			{ code: 'ASSET-TE-001', name: 'Interactive Whiteboard', category: 'Audio Visual', status: 'available', quantity: 4, condition: 'Excellent', value: 55000, unit: 'unit', supplier: 'EduLab Philippines', facility: 'Micro-Teaching Lab' },
			{ code: 'ASSET-TE-002', name: 'Document Camera', category: 'Audio Visual', status: 'available', quantity: 6, condition: 'Good', value: 12000, unit: 'unit', supplier: 'EduLab Philippines', facility: 'Education Resource Room' },
			{ code: 'ASSET-TE-003', name: 'Teaching Tablet', category: 'Computing', status: 'available', quantity: 20, condition: 'Good', value: 15000, unit: 'unit', supplier: 'EduLab Philippines', facility: 'Education Resource Room' },
		],
	},
	'Midwifery': {
		facilities: [
			{ name: 'Midwifery Skills Laboratory', facility_type: 'Laboratory', capacity: 30 },
			{ name: 'Maternal Care Simulation Room', facility_type: 'Simulation Room', capacity: 20 },
		],
		equipment: [
			{ code: 'ASSET-MW-001', name: 'Childbirth Simulator', category: 'Medical Equipment', status: 'available', quantity: 2, condition: 'Excellent', value: 85000, unit: 'unit', supplier: 'EduLab Philippines', facility: 'Maternal Care Simulation Room' },
			{ code: 'ASSET-MW-002', name: 'Fetal Doppler', category: 'Medical Equipment', status: 'borrowed', quantity: 8, condition: 'Good', value: 6500, unit: 'unit', supplier: 'EduLab Philippines', facility: 'Midwifery Skills Laboratory' },
			{ code: 'ASSET-MW-003', name: 'Neonatal Resuscitation Manikin', category: 'Medical Equipment', status: 'maintenance', quantity: 3, condition: 'Good', value: 42000, unit: 'unit', supplier: 'EduLab Philippines', facility: 'Maternal Care Simulation Room' },
			{ code: 'ASSET-MW-004', name: 'Sphygmomanometer Set', category: 'Medical Equipment', status: 'available', quantity: 12, condition: 'Good', value: 1800, unit: 'unit', supplier: 'Campus Hardware Depot', facility: 'Midwifery Skills Laboratory' },
		],
	},
}

// Borrow / maintenance rows reference equipment by code and an actor by
// username; both are resolved to ids at runtime. The actor's department must
// match the equipment's for the app's RLS scoping to display them naturally.
const BORROWS = [
	{ actor: 'bscs.staff', equipment: 'ASSET-CS-001', status: 'borrowed', borrowedDaysAgo: 3, dueInDays: 7, notes: 'Checked out for thesis lab work.' },
	// Past its due date but not returned — the overdue sweep / "Check Overdue Now" flags this one.
	{ actor: 'bscs.staff', equipment: 'ASSET-CS-003', status: 'borrowed', borrowedDaysAgo: 15, dueInDays: -3, notes: 'Projector for a review class, not yet returned.' },
	{ actor: 'bsit.staff', equipment: 'ASSET-IT-002', status: 'pending', dueInDays: 5, notes: 'Requested for electronics practical.' },
	{ actor: 'bsf.staff', equipment: 'ASSET-FS-004', status: 'borrowed', borrowedDaysAgo: 1, dueInDays: 10, notes: 'For inland specimen analysis.' },
	{ actor: 'cte.staff', equipment: 'ASSET-TE-002', status: 'returned', borrowedDaysAgo: 20, dueInDays: -6, returnedDaysAgo: 5, notes: 'Used for demo teaching session.' },
	{ actor: 'midwifery.staff', equipment: 'ASSET-MW-002', status: 'borrowed', borrowedDaysAgo: 2, dueInDays: 6, notes: 'For maternal health skills practice.' },
]

const MAINTENANCE = [
	{ actor: 'bscs.staff', equipment: 'ASSET-CS-004', status: 'in_progress', priority: 'high', description: 'Server unit overheating under load; replacing cooling fans.' },
	{ actor: 'bsit.staff', equipment: 'ASSET-IT-003', status: 'pending', priority: 'medium', description: 'Oscilloscope display flickering; needs inspection.' },
	{ actor: 'bsf.staff', equipment: 'ASSET-FS-003', status: 'pending', priority: 'low', description: 'Aerator pump making unusual noise; needs inspection.' },
	{ actor: 'cte.staff', equipment: 'ASSET-TE-001', status: 'completed', priority: 'low', description: 'Recalibrated interactive whiteboard touch layer.' },
	{ actor: 'midwifery.staff', equipment: 'ASSET-MW-003', status: 'pending', priority: 'medium', description: 'Neonatal manikin sensor needs recalibration.' },
]

async function main() {
	// --- Resolve departments and actors -------------------------------------
	const { data: departments, error: deptError } = await withRetry(() => admin.from('departments').select('id, name'))
	if (deptError) throw new Error(`Load departments failed: ${deptError.message}`)
	const deptIdByName = new Map(departments.map((d) => [d.name, d.id]))

	const actorUsernames = [...new Set([...BORROWS, ...MAINTENANCE].map((r) => r.actor))]
	const { data: actorRows, error: actorError } = await withRetry(() =>
		admin.from('profiles').select('id, username, department_id').in('username', actorUsernames),
	)
	if (actorError) throw new Error(`Load actors failed: ${actorError.message}`)
	const actorByUsername = new Map(actorRows.map((p) => [p.username, p]))

	// --- Lookups ------------------------------------------------------------
	const { error: catError } = await withRetry(() =>
		admin.from('categories').upsert(CATEGORIES.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true }),
	)
	if (catError) throw new Error(`Categories upsert failed: ${catError.message}`)

	const { error: supError } = await withRetry(() =>
		admin.from('suppliers').upsert(SUPPLIERS, { onConflict: 'name', ignoreDuplicates: true }),
	)
	if (supError) throw new Error(`Suppliers upsert failed: ${supError.message}`)

	// --- Facilities (no unique key: insert only names not already present) ---
	const facilityIdByKey = new Map() // `${deptId}::${name}` -> id
	for (const [deptName, config] of Object.entries(DEPARTMENTS)) {
		const deptId = deptIdByName.get(deptName)
		if (!deptId) {
			console.warn(`Skipping "${deptName}" — department not found`)
			continue
		}
		const { data: existing, error: exError } = await withRetry(() =>
			admin.from('facilities').select('id, name').eq('department_id', deptId),
		)
		if (exError) throw new Error(`Load facilities failed: ${exError.message}`)
		const existingByName = new Map((existing ?? []).map((f) => [f.name, f.id]))

		const toInsert = config.facilities.filter((f) => !existingByName.has(f.name))
		if (toInsert.length > 0) {
			const { data: inserted, error: insError } = await withRetry(() =>
				admin
					.from('facilities')
					.insert(toInsert.map((f) => ({ ...f, department_id: deptId, current_availability: 'available' })))
					.select('id, name'),
			)
			if (insError) throw new Error(`Facilities insert failed: ${insError.message}`)
			for (const f of inserted) existingByName.set(f.name, f.id)
		}
		for (const [name, id] of existingByName) facilityIdByKey.set(`${deptId}::${name}`, id)
	}

	// --- Equipment (upsert on unique equipment_code) ------------------------
	const equipmentRows = []
	for (const [deptName, config] of Object.entries(DEPARTMENTS)) {
		const deptId = deptIdByName.get(deptName)
		if (!deptId) continue
		for (const item of config.equipment) {
			equipmentRows.push({
				equipment_code: item.code,
				equipment_name: item.name,
				category: item.category,
				status: item.status,
				department_id: deptId,
				facility_id: facilityIdByKey.get(`${deptId}::${item.facility}`) ?? null,
				quantity: item.quantity,
				condition: item.condition,
				value: item.value,
				unit: item.unit,
				supplier: item.supplier,
				location: item.facility,
				purchase_date: '2024-06-15',
			})
		}
	}
	const { error: eqError } = await withRetry(() =>
		admin.from('equipment').upsert(equipmentRows, { onConflict: 'equipment_code' }),
	)
	if (eqError) throw new Error(`Equipment upsert failed: ${eqError.message}`)

	const { data: equipRows, error: eqReadError } = await withRetry(() =>
		admin.from('equipment').select('id, equipment_code, department_id').in('equipment_code', equipmentRows.map((e) => e.equipment_code)),
	)
	if (eqReadError) throw new Error(`Equipment read-back failed: ${eqReadError.message}`)
	const equipByCode = new Map(equipRows.map((e) => [e.equipment_code, e]))

	// --- Clear previously seeded borrow/maintenance rows (marker only) ------
	await withRetry(() => admin.from('borrow_records').delete().ilike('notes', `%${MARKER}%`))
	await withRetry(() => admin.from('maintenance_requests').delete().ilike('description', `%${MARKER}%`))

	// --- Borrow records -----------------------------------------------------
	const borrowRows = []
	for (const b of BORROWS) {
		const actor = actorByUsername.get(b.actor)
		const equip = equipByCode.get(b.equipment)
		if (!actor || !equip) continue
		borrowRows.push({
			equipment_id: equip.id,
			borrower_id: actor.id,
			created_by: actor.id,
			approved_by: b.status === 'pending' ? null : actor.id,
			department_id: equip.department_id,
			borrowed_date: daysFromNow(-(b.borrowedDaysAgo ?? 0)),
			expected_return_date: b.dueInDays != null ? daysFromNow(b.dueInDays) : null,
			actual_return_date: b.returnedDaysAgo != null ? daysFromNow(-b.returnedDaysAgo) : null,
			status: b.status,
			notes: `${b.notes} ${MARKER}`,
		})
	}
	if (borrowRows.length > 0) {
		const { error } = await withRetry(() => admin.from('borrow_records').insert(borrowRows))
		if (error) throw new Error(`Borrow insert failed: ${error.message}`)
	}

	// --- Maintenance requests ----------------------------------------------
	const maintRows = []
	for (const m of MAINTENANCE) {
		const actor = actorByUsername.get(m.actor)
		const equip = equipByCode.get(m.equipment)
		if (!actor || !equip) continue
		maintRows.push({
			department_id: equip.department_id,
			equipment_id: equip.id,
			requester_id: actor.id,
			assigned_to_id: m.status === 'pending' ? null : actor.id,
			status: m.status,
			priority: m.priority,
			description: `${m.description} ${MARKER}`,
		})
	}
	if (maintRows.length > 0) {
		const { error } = await withRetry(() => admin.from('maintenance_requests').insert(maintRows))
		if (error) throw new Error(`Maintenance insert failed: ${error.message}`)
	}

	console.log('Sample data seeded:')
	console.log(`  categories:   ${CATEGORIES.length} ensured`)
	console.log(`  suppliers:    ${SUPPLIERS.length} ensured`)
	console.log(`  facilities:   ${facilityIdByKey.size} across ${Object.keys(DEPARTMENTS).length} departments`)
	console.log(`  equipment:    ${equipmentRows.length} upserted`)
	console.log(`  borrow rows:  ${borrowRows.length} inserted`)
	console.log(`  maintenance:  ${maintRows.length} inserted`)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
