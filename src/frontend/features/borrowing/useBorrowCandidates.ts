import { useBorrowRecords, useEquipment, useMainSupplyEquipment } from '@/backend/lib/supabase/queries'
import { freeUnits, isBorrowable, OUT_OF_SERVICE_STATUSES, totalUnits, unitsOutByEquipmentId } from '@/backend/lib/borrowing'
import type { SchoolUser } from '@/backend/types/school'

// One item the signed-in user may request, normalized across the two sources it
// can come from.
export type BorrowCandidate = {
	id: number
	equipment_code: string
	equipment_name: string
	quantity: number
	freeUnits: number
	source: 'supply' | 'department'
	// The owning department's name — shown for faculty and students, who can both
	// request items from departments other than their own.
	departmentName?: string
}

// Requestable stock draws from two places at once:
//  - the Supply Office (Main Supply / super-admin central inventory), served by
//    an edge function so it works for every role regardless of RLS, and
//  - departmental inventory (every department for faculty and students, own
//    department only for a department admin).
//
// Both the Borrowing screen's "New Request" and the Inventory screen's per-item
// "Borrow" button read from this hook, so they can never disagree about what is
// available.
export function useBorrowCandidates(user: SchoolUser) {
	const { data: mainSupply, isLoading: supplyLoading, error: supplyError } = useMainSupplyEquipment()
	const { data: equipment, isLoading: equipmentLoading } = useEquipment()
	const { data: records } = useBorrowRecords()

	// The edge function already computes available_units for Supply Office items.
	const supply: BorrowCandidate[] = (mainSupply ?? [])
		.filter((item) => !OUT_OF_SERVICE_STATUSES.has(item.status) && item.available_units > 0)
		.map((item) => ({
			id: item.id,
			equipment_code: item.equipment_code,
			equipment_name: item.equipment_name,
			quantity: item.quantity ?? 1,
			freeUnits: item.available_units,
			source: 'supply' as const,
		}))

	// Department items read their availability straight off equipment.quantity
	// (the on-hand stock the database maintains); the visible borrow records are
	// only used to reconstruct each item's full stock for the "x of y" label.
	//
	// This picker is deliberately wider than the Inventory screen, which shows
	// only your own department. Faculty AND students may request any
	// department's stock — the request is routed to that item's department for
	// approval — so both draw from every department's inventory. Department
	// admins stay scoped to their own department; the super admin borrows from
	// the Supply Office only. (Students get no `supply` list at all: the
	// main-supply function returns nothing for them.)
	const unitsOut = unitsOutByEquipmentId(records ?? [])
	const departmentSource =
		user.role === 'staff' || user.role === 'student'
			? (equipment ?? []).filter((item) => item.department_id !== null)
			: user.departmentId
				? (equipment ?? []).filter((item) => item.department_id === user.departmentId)
				: []
	const department: BorrowCandidate[] = departmentSource
		.filter((item) => isBorrowable(item))
		.map((item) => ({
			id: item.id,
			equipment_code: item.equipment_code,
			equipment_name: item.equipment_name,
			// `quantity` here is the item's full stock (on hand + out on loan) so
			// the picker can show "3 of 10 free"; freeUnits is the stored on-hand
			// count, already net of every approved borrow.
			quantity: totalUnits(item, unitsOut),
			freeUnits: freeUnits(item),
			source: 'department' as const,
			departmentName: item.departments?.name ?? undefined,
		}))

	const all = [...supply, ...department]

	return {
		supply,
		department,
		all,
		unitsOut,
		byId: new Map(all.map((item) => [item.id, item])),
		// Every Supply Office item, not just the requestable ones. Staff cannot
		// read those equipment rows directly, so the joined equipment name on
		// their own borrow records is RLS-hidden — this recovers it even after
		// the item is fully borrowed out.
		supplyNameById: new Map((mainSupply ?? []).map((item) => [item.id, item.equipment_name])),
		isLoading: supplyLoading || equipmentLoading,
		// The Supply Office list is the one that can fail loudly (edge function);
		// surface it so the UI can explain an empty picker instead of pretending
		// nothing is available.
		supplyError,
	}
}
