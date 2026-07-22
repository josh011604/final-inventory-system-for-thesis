import { useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import StatusChip from '@/components/ui/StatusChip'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useCreateStudent, useDepartments, useProfiles, useUpdateProfile } from '@/backend/lib/supabase/queries'
import type { ProfileRow } from '@/backend/lib/supabase/queries'
import { getRoleLabel } from '@/backend/lib/rbac'
import { getErrorMessage } from '@/backend/lib/errors'
import type { SchoolUser } from '@/backend/types/school'

const selectClass = 'rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-text-primary outline-none transition focus:border-primary'
const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

export default function UsersPage({ user }: { user: SchoolUser }) {
	const { data, isLoading } = useProfiles()
	const { data: departments } = useDepartments()
	const updateProfile = useUpdateProfile()
	const createStudent = useCreateStudent()

	const canEditRoleAndDept = user.role === 'super_admin'
	const canToggleStatus = (row: ProfileRow) => user.role === 'super_admin' || (user.role === 'department_admin' && row.department_id === user.departmentId)
	const canCreateStudent = user.role === 'super_admin' || user.role === 'department_admin'

	const [open, setOpen] = useState(false)
	const [fullName, setFullName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [departmentId, setDepartmentId] = useState('')
	const [studentId, setStudentId] = useState('')
	const [error, setError] = useState<string | null>(null)

	const resetForm = () => {
		setFullName('')
		setEmail('')
		setPassword('')
		setDepartmentId('')
		setStudentId('')
		setError(null)
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		// Department admins may only create students in their own department.
		const effectiveDepartmentId = user.role === 'department_admin' ? user.departmentId ?? '' : departmentId
		try {
			await createStudent.mutateAsync({
				full_name: fullName,
				email,
				password,
				department_id: effectiveDepartmentId,
				student_id: studentId.trim() || undefined,
			})
			resetForm()
			setOpen(false)
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to create student account.'))
		}
	}

	return (
		<>
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
									<option value="staff">Faculty</option>
									<option value="student">Student</option>
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
						{canCreateStudent ? (
							<Button size="sm" onClick={() => setOpen(true)}>
								Add Student
							</Button>
						) : null}
					</div>
				}
			/>
	
			<Modal open={open} onClose={() => setOpen(false)} title="Add Student">
				<form className="space-y-4" onSubmit={handleSubmit}>
					{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
					<div>
						<label className={labelClass} htmlFor="student-name">
							Full Name
						</label>
						<input id="student-name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} required />
					</div>
					<div>
						<label className={labelClass} htmlFor="student-email">
							Email
						</label>
						<input id="student-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} required />
					</div>
					<div>
						<label className={labelClass} htmlFor="student-password">
							Password
						</label>
						<input
							id="student-password"
							type="password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							className={inputClass}
							minLength={8}
							required
						/>
					</div>
					{user.role === 'super_admin' ? (
						<div>
							<label className={labelClass} htmlFor="student-department">
								Department
							</label>
							<select
								id="student-department"
								value={departmentId}
								onChange={(event) => setDepartmentId(event.target.value)}
								className={inputClass}
								required
							>
								<option value="" disabled>
									Select a department
								</option>
								{departments?.map((department) => (
									<option key={department.id} value={department.id}>
										{department.name}
									</option>
								))}
							</select>
						</div>
					) : (
						<p className="text-sm text-text-muted">Department: {user.department} (your own department)</p>
					)}
					<div>
						<label className={labelClass} htmlFor="student-id">
							Student ID (optional)
						</label>
						<input id="student-id" value={studentId} onChange={(event) => setStudentId(event.target.value)} className={inputClass} />
					</div>
					<Button type="submit" className="w-full" disabled={createStudent.isPending}>
						{createStudent.isPending ? 'Creating…' : 'Create Student Account'}
					</Button>
				</form>
			</Modal>
		</>
	)
}
