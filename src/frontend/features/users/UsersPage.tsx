import EntityTablePage from '@/components/ui/EntityTablePage'
import StatusChip from '@/components/ui/StatusChip'
import { useDepartments, useProfiles, useUpdateProfile } from '@/backend/lib/supabase/queries'
import type { ProfileRow } from '@/backend/lib/supabase/queries'
import { getRoleLabel } from '@/backend/lib/rbac'
import type { SchoolUser } from '@/backend/types/school'

const selectClass = 'rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text-primary outline-none transition focus:border-primary'

export default function UsersPage({ user }: { user: SchoolUser }) {
	const { data, isLoading } = useProfiles()
	const { data: departments } = useDepartments()
	const updateProfile = useUpdateProfile()

	const canEditRoleAndDept = user.role === 'super_admin'
	const canToggleStatus = (row: ProfileRow) => user.role === 'super_admin' || (user.role === 'department_admin' && row.department_id === user.departmentId)

	return (
		<EntityTablePage<ProfileRow>
			title="Users"
			subtitle={`${data?.length ?? 0} accounts`}
			rows={data}
			isLoading={isLoading}
			searchKeys={['full_name', 'username', 'email']}
			emptyMessage="No user accounts visible to you yet."
			columns={[
				{
					header: 'User',
					render: (row) => (
						<div>
							<p className="font-medium text-text-primary">{row.full_name}</p>
							<p className="text-xs text-text-muted">{row.email}</p>
						</div>
					),
				},
				{ header: 'Department', render: (row) => row.departments?.name ?? '—' },
				{
					header: 'Position',
					render: (row) =>
						canEditRoleAndDept ? (
							<input
								defaultValue={row.position ?? ''}
								onBlur={(event) => {
									const value = event.target.value.trim()
									if (value !== (row.position ?? '')) {
										updateProfile.mutate({ id: row.id, updates: { position: value || null } })
									}
								}}
								placeholder="Set position"
								className={`${selectClass} w-32`}
							/>
						) : (
							row.position ?? '—'
						),
				},
				{
					header: 'Role',
					render: (row) =>
						canEditRoleAndDept ? (
							<select
								value={row.role}
								onChange={(event) => updateProfile.mutate({ id: row.id, updates: { role: event.target.value } })}
								className={selectClass}
							>
								<option value="super_admin">Super Administrator</option>
								<option value="department_admin">Department Administrator</option>
								<option value="staff">Staff</option>
							</select>
						) : (
							getRoleLabel(row.role as SchoolUser['role'])
						),
				},
				{
					header: 'Status',
					render: (row) =>
						canToggleStatus(row) ? (
							<button
								type="button"
								onClick={() => updateProfile.mutate({ id: row.id, updates: { status: row.status === 'active' ? 'inactive' : 'active' } })}
								className="cursor-pointer"
							>
								<StatusChip tone={row.status === 'active' ? 'success' : 'muted'}>{row.status === 'active' ? 'Active — click to deactivate' : 'Inactive — click to activate'}</StatusChip>
							</button>
						) : (
							<StatusChip tone={row.status === 'active' ? 'success' : 'muted'}>{row.status}</StatusChip>
						),
				},
			]}
			action={
				<div className="flex items-center gap-3">
					{(data?.filter((row) => row.status === 'inactive').length ?? 0) > 0 ? (
						<StatusChip tone="warning">
							{data!.filter((row) => row.status === 'inactive').length} pending activation
						</StatusChip>
					) : null}
					{canEditRoleAndDept ? <span className="text-xs text-text-muted">{departments?.length ?? 0} departments</span> : null}
				</div>
			}
		/>
	)
}
