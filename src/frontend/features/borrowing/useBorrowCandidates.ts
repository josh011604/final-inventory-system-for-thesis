import { useBorrowRecords, useEquipment, useMainSupplyEquipment } from '@/backend/lib/supabase/queries'
import { borrowScopeReason, freeUnits, isBorrowable, OUT_OF_SERVICE_STATUSES, totalUnits, unitsOutByEquipmentId } from '@/backend/lib/borrowing'
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
	// only your own department. EVERY role may request any department's stock —
	// the request carries the item's department and is routed to that
	// department's admin for approval — so the source is simply every
	// departmental item the caller can read.
	//
	// Scoping this by the borrower's own department (as it once did) made two of
	// the product's approval rules unreachable: a super admin has no department
	// at all, so they were offered nothing but the Supply Office, and a
	// department admin could never request another department's item even though
	// the server routes exactly that case to the owning department's admin.
	//
	// The one remaining role difference is that students may not touch Supply
	// Office stock. That is enforced server-side three times over (equipment RLS,
	// the borrow-status create path, the enforce_borrow_department_scope trigger);
	// borrowScopeReason is the client mirror, applied here so the picker can never
	// offer an item the server would reject.
	const unitsOut = unitsOutByEquipmentId(records ?? [])
	const borrower = { role: user.role, departmentId: user.departmentId }
	const departmentSource = (equipment ?? []).filter((item) => item.department_id !== null && borrowScopeReason(item, borrower) === null)
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
