import { useBorrowRecords, useEquipment, useMainSupplyEquipment } from '@/backend/lib/supabase/queries'
import { freeUnits, isBorrowable, unitsOutByEquipmentId } from '@/backend/lib/borrowing'
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
}

// Requestable stock draws from two places at once:
//  - the Supply Office (Main Supply / super-admin central inventory), served by
//    an edge function so it works for every role regardless of RLS, and
//  - the borrower's own department inventory.
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
		.filter((item) => item.status === 'available' && item.available_units > 0)
		.map((item) => ({
			id: item.id,
			equipment_code: item.equipment_code,
			equipment_name: item.equipment_name,
			quantity: item.quantity ?? 1,
			freeUnits: item.available_units,
			source: 'supply' as const,
		}))

	// Department items are counted from the borrow records this user can see —
	// department scoping already covers the whole department.
	const unitsOut = unitsOutByEquipmentId(records ?? [])
	const department: BorrowCandidate[] = user.departmentId
		? (equipment ?? [])
				.filter((item) => item.department_id === user.departmentId && isBorrowable(item, unitsOut))
				.map((item) => ({
					id: item.id,
					equipment_code: item.equipment_code,
					equipment_name: item.equipment_name,
					quantity: item.quantity ?? 1,
					freeUnits: freeUnits(item, unitsOut),
					source: 'department' as const,
				}))
		: []

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
