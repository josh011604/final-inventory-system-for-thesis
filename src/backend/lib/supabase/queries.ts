import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/backend/lib/supabase/client'
import type { Tables, TablesInsert } from '@/backend/types/supabase'

// ---------- Departments ----------

export function useDepartments() {
	return useQuery({
		queryKey: ['departments'],
		queryFn: async () => {
			const { data, error } = await supabase.from('departments').select('*').order('name')
			if (error) throw error
			return data
		},
	})
}

export function useCreateDepartment() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: TablesInsert<'departments'>) => {
			const { error } = await supabase.from('departments').insert(input)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
	})
}

// ---------- Profiles (Users module) ----------

export type ProfileRow = Tables<'profiles'> & { departments: { name: string } | null }

export function useProfiles() {
	return useQuery({
		queryKey: ['profiles'],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('profiles')
				.select('*, departments(name)')
				.order('full_name')
			if (error) throw error
			return data as ProfileRow[]
		},
	})
}

export function useUpdateProfile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async ({ id, updates }: { id: string; updates: Partial<Tables<'profiles'>> }) => {
			const { error } = await supabase.from('profiles').update(updates).eq('id', id)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
	})
}

// ---------- Facilities ----------

export type FacilityRow = Tables<'facilities'> & { departments: { name: string } | null }

export function useFacilities() {
	return useQuery({
		queryKey: ['facilities'],
		queryFn: async () => {
			const { data, error } = await supabase.from('facilities').select('*, departments(name)').order('name')
			if (error) throw error
			return data as FacilityRow[]
		},
	})
}

export function useCreateFacility() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: TablesInsert<'facilities'>) => {
			const { error } = await supabase.from('facilities').insert(input)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['facilities'] }),
	})
}

// ---------- Equipment (Inventory module) ----------

export type EquipmentRow = Tables<'equipment'> & {
	departments: { name: string } | null
	facilities: { name: string } | null
}

export function useEquipment() {
	return useQuery({
		queryKey: ['equipment'],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('equipment')
				.select('*, departments(name), facilities(name)')
				.order('equipment_name')
			if (error) throw error
			return data as EquipmentRow[]
		},
	})
}

export function useCreateEquipment() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: TablesInsert<'equipment'>) => {
			const { error } = await supabase.from('equipment').insert(input)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment'] }),
	})
}

// Slim shape returned by the main-supply edge function — just what the New
// Request form needs.
export type MainSupplyItem = Pick<
	Tables<'equipment'>,
	'id' | 'equipment_code' | 'equipment_name' | 'department_id' | 'status' | 'quantity'
> & { available_units: number }

export function useMainSupplyEquipment() {
	return useQuery({
		queryKey: ['main_supply_equipment'],
		queryFn: async () => {
			// Served by an edge function (service role internally) so signed-in
			// users can request Supply Office items even where the equipment RLS
			// policy hides null-department rows from them.
			const { data, error } = await supabase.functions.invoke('main-supply', { body: {} })
			if (error) {
				const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
				throw new Error(body?.error ?? error.message)
			}
			return (data as { data: MainSupplyItem[] }).data
		},
	})
}

export function useUpdateEquipment() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async ({ id, updates }: { id: number; updates: Partial<Tables<'equipment'>> }) => {
			const { error } = await supabase.from('equipment').update(updates).eq('id', id)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment'] }),
	})
}

export function useDeleteEquipment() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: number) => {
			const { error } = await supabase.from('equipment').delete().eq('id', id)
			if (error) throw error
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['equipment'] })
			queryClient.invalidateQueries({ queryKey: ['borrow_records'] })
			queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] })
		},
	})
}

// ---------- Borrow records (Borrowing module) ----------

export type BorrowRecordRow = Tables<'borrow_records'> & {
	equipment: { equipment_name: string } | null
	departments: { name: string } | null
	borrower: { full_name: string } | null
	approver: { full_name: string } | null
}

export function useBorrowRecords() {
	return useQuery({
		queryKey: ['borrow_records'],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('borrow_records')
				.select(
					'*, equipment(equipment_name), departments(name), borrower:profiles!borrow_records_borrower_id_fkey(full_name), approver:profiles!borrow_records_approved_by_fkey(full_name)',
				)
				.order('created_at', { ascending: false })
			if (error) throw error
			return data as unknown as BorrowRecordRow[]
		},
	})
}

export function useCreateBorrowRecord() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { equipment_id: number; expected_return_date: string | null; notes: string | null }) => {
			// Routed through the borrow-status edge function so every request rule
			// is enforced server-side: date window, per-unit availability,
			// duplicate guard, per-user borrow cap, and approver notifications.
			const { error } = await supabase.functions.invoke('borrow-status', { body: { action: 'create', ...input } })
			if (error) {
				const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
				throw new Error(body?.error ?? error.message)
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['borrow_records'] })
			queryClient.invalidateQueries({ queryKey: ['notifications'] })
		},
	})
}

export function useCancelBorrowRecord() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: number) => {
			// The function verifies the caller is the borrower and the request is
			// still pending before removing it (and writes an audit entry).
			const { error } = await supabase.functions.invoke('borrow-status', { body: { action: 'cancel', id } })
			if (error) {
				const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
				throw new Error(body?.error ?? error.message)
			}
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['borrow_records'] }),
	})
}

export function useRunOverdueCheck() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async () => {
			// Fires the same institution-wide sweep pg_cron runs hourly. The edge
			// function re-checks that the caller is a Super Administrator before
			// invoking flag_overdue_borrow_records() with the service-role key.
			const { data, error } = await supabase.functions.invoke('overdue-check', { body: {} })
			if (error) {
				const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
				throw new Error(body?.error ?? error.message)
			}
			return data as { flagged: number }
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['borrow_records'] })
			queryClient.invalidateQueries({ queryKey: ['notifications'] })
			queryClient.invalidateQueries({ queryKey: ['audit_logs'] })
		},
	})
}

export function useUpdateBorrowRecordStatus() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async ({ id, status, condition }: { id: number; status: string; condition?: string }) => {
			// Routed through the borrow-status edge function rather than a direct
			// table update: it owns the confirm/reject/return state machine,
			// authorization, per-unit availability checks, and the equipment-status
			// + notification + audit-log cascade. A damaged return also opens a
			// maintenance request automatically.
			const { error } = await supabase.functions.invoke('borrow-status', {
				body: { id, status, ...(condition ? { condition_after: condition } : {}) },
			})
			if (error) {
				const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
				throw new Error(body?.error ?? error.message)
			}
		},
		onMutate: async ({ id, status }) => {
			await queryClient.cancelQueries({ queryKey: ['borrow_records'] })
			const previous = queryClient.getQueryData<BorrowRecordRow[]>(['borrow_records'])
			queryClient.setQueryData<BorrowRecordRow[]>(['borrow_records'], (rows) =>
				rows?.map((row) => (row.id === id ? { ...row, status } : row)),
			)
			return { previous }
		},
		onError: (_error, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(['borrow_records'], context.previous)
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['borrow_records'] })
			queryClient.invalidateQueries({ queryKey: ['equipment'] })
			queryClient.invalidateQueries({ queryKey: ['main_supply_equipment'] })
			// A damaged return opens a maintenance request automatically.
			queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] })
		},
	})
}

// ---------- Maintenance requests ----------

export type MaintenanceRequestRow = Tables<'maintenance_requests'> & {
	equipment: { equipment_name: string } | null
	facilities: { name: string } | null
	departments: { name: string } | null
	requester: { full_name: string } | null
	assignee: { full_name: string } | null
}

export function useMaintenanceRequests() {
	return useQuery({
		queryKey: ['maintenance_requests'],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('maintenance_requests')
				.select(
					'*, equipment(equipment_name), facilities(name), departments(name), requester:profiles!maintenance_requests_requester_id_fkey(full_name), assignee:profiles!maintenance_requests_assigned_to_id_fkey(full_name)',
				)
				.order('requested_at', { ascending: false })
			if (error) throw error
			return data as unknown as MaintenanceRequestRow[]
		},
	})
}

export function useCreateMaintenanceRequest() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: TablesInsert<'maintenance_requests'>) => {
			const { error } = await supabase.from('maintenance_requests').insert(input)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] }),
	})
}

export function useUpdateMaintenanceStatus() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async ({ id, status }: { id: number; status: string }) => {
			// Routed through the maintenance-status edge function rather than a direct
			// table update: it owns the approve/reject/start/complete state machine,
			// authorization, and the equipment-status + notification + audit-log cascade.
			const { error } = await supabase.functions.invoke('maintenance-status', { body: { id, status } })
			if (error) {
				// FunctionsHttpError's own .message is just "non-2xx status code" — the
				// function's actual reason lives in the response body it wraps.
				const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
				throw new Error(body?.error ?? error.message)
			}
		},
		onMutate: async ({ id, status }) => {
			await queryClient.cancelQueries({ queryKey: ['maintenance_requests'] })
			const previous = queryClient.getQueryData<MaintenanceRequestRow[]>(['maintenance_requests'])
			queryClient.setQueryData<MaintenanceRequestRow[]>(['maintenance_requests'], (rows) =>
				rows?.map((row) => (row.id === id ? { ...row, status } : row)),
			)
			return { previous }
		},
		onError: (_error, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(['maintenance_requests'], context.previous)
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] })
			queryClient.invalidateQueries({ queryKey: ['equipment'] })
		},
	})
}

// ---------- Notifications ----------

export function useNotifications() {
	return useQuery({
		queryKey: ['notifications'],
		queryFn: async () => {
			const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false })
			if (error) throw error
			return data
		},
	})
}

export function useMarkNotificationRead() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: number) => {
			const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
	})
}

// ---------- Audit logs ----------

export type AuditLogRow = Tables<'audit_logs'> & { actor: { full_name: string } | null }

export function useAuditLogs() {
	return useQuery({
		queryKey: ['audit_logs'],
		queryFn: async () => {
			const { data, error } = await supabase
				.from('audit_logs')
				.select('*, actor:profiles(full_name)')
				.order('created_at', { ascending: false })
				.limit(200)
			if (error) throw error
			return data as unknown as AuditLogRow[]
		},
	})
}

// ---------- Categories (System Settings) ----------

export function useCategories() {
	return useQuery({
		queryKey: ['categories'],
		queryFn: async () => {
			const { data, error } = await supabase.from('categories').select('*').order('name')
			if (error) throw error
			return data
		},
	})
}

export function useCreateCategory() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (name: string) => {
			const { error } = await supabase.from('categories').insert({ name })
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
	})
}

export function useDeleteCategory() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: number) => {
			const { error } = await supabase.from('categories').delete().eq('id', id)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
	})
}

// ---------- Suppliers (System Settings) ----------

export function useSuppliers() {
	return useQuery({
		queryKey: ['suppliers'],
		queryFn: async () => {
			const { data, error } = await supabase.from('suppliers').select('*').order('name')
			if (error) throw error
			return data
		},
	})
}

export function useCreateSupplier() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: TablesInsert<'suppliers'>) => {
			const { error } = await supabase.from('suppliers').insert(input)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
	})
}

export function useDeleteSupplier() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: number) => {
			const { error } = await supabase.from('suppliers').delete().eq('id', id)
			if (error) throw error
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
	})
}
