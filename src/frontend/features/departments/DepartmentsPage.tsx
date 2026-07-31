import { useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useCreateDepartment, useDeleteDepartment, useDepartments, useUpdateDepartment } from '@/backend/lib/supabase/queries'
import type { Tables } from '@/backend/types/supabase'
import type { SchoolUser } from '@/backend/types/school'
import { getErrorMessage } from '@/backend/lib/errors'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

type Department = Tables<'departments'>

const programsToText = (programs: string[]) => programs.join(', ')
const textToPrograms = (text: string) =>
	text
		.split(',')
		.map((program) => program.trim())
		.filter(Boolean)

export default function DepartmentsPage({ user }: { user: SchoolUser }) {
	const { data, isLoading } = useDepartments()
	const createDepartment = useCreateDepartment()
	const updateDepartment = useUpdateDepartment()
	const deleteDepartment = useDeleteDepartment()

	// The route is already restricted to super admins in navigation.ts; this is
	// the second check, so the buttons can never appear for anyone else even if
	// the page is reached another way. The database agrees independently — the
	// "departments admin write" policy only permits is_super_admin().
	const canManage = user.role === 'super_admin'

	const [open, setOpen] = useState(false)
	const [name, setName] = useState('')
	const [shortName, setShortName] = useState('')
	const [programs, setPrograms] = useState('')
	const [error, setError] = useState<string | null>(null)

	const [editTarget, setEditTarget] = useState<Department | null>(null)
	const [editName, setEditName] = useState('')
	const [editShortName, setEditShortName] = useState('')
	const [editPrograms, setEditPrograms] = useState('')
	const [editError, setEditError] = useState<string | null>(null)

	const [deleteTarget, setDeleteTarget] = useState<Department | null>(null)
	const [deleteError, setDeleteError] = useState<string | null>(null)

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		try {
			await createDepartment.mutateAsync({
				name,
				short_name: shortName,
				programs: textToPrograms(programs),
			})
			setName('')
			setShortName('')
			setPrograms('')
			setOpen(false)
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to create department.'))
		}
	}

	const openEdit = (row: Department) => {
		setEditTarget(row)
		setEditName(row.name)
		setEditShortName(row.short_name)
		setEditPrograms(programsToText(row.programs))
		setEditError(null)
	}

	const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!editTarget) return
		setEditError(null)
		try {
			await updateDepartment.mutateAsync({
				id: editTarget.id,
				updates: { name: editName, short_name: editShortName, programs: textToPrograms(editPrograms) },
			})
			setEditTarget(null)
		} catch (mutationError) {
			setEditError(getErrorMessage(mutationError, 'Failed to update department.'))
		}
	}

	const handleDelete = async () => {
		if (!deleteTarget) return
		setDeleteError(null)
		try {
			await deleteDepartment.mutateAsync(deleteTarget.id)
			setDeleteTarget(null)
		} catch (mutationError) {
			// Student accounts cannot exist without a department
			// (profiles_student_requires_department), so detaching them on delete
			// breaks that rule and Postgres refuses. Say what to do about it instead
			// of showing the raw constraint name.
			const raw = mutationError as { code?: string; message?: string }
			const blockedByStudents =
				raw?.code === '23514' || (typeof raw?.message === 'string' && raw.message.includes('profiles_student_requires_department'))
			setDeleteError(
				blockedByStudents
					? 'This department still has student accounts. Move those students to another department (or deactivate them) before deleting it.'
					: getErrorMessage(mutationError, 'Failed to delete department.'),
			)
		}
	}

	return (
		<>
			<EntityTablePage<Department>
				title="Departments"
				subtitle={`${data?.length ?? 0} departments`}
				rows={data}
				isLoading={isLoading}
				searchKeys={['name', 'short_name']}
				action={
					canManage ? (
						<Button size="sm" onClick={() => setOpen(true)}>
							Add Department
						</Button>
					) : undefined
				}
				columns={[
					{ header: 'Name', render: (row) => <span className="font-medium text-text-primary">{row.name}</span> },
					{ header: 'Short Name', render: (row) => row.short_name },
					{ header: 'Programs', render: (row) => (row.programs.length > 0 ? row.programs.join(', ') : '—') },
					...(canManage
						? [
								{
									header: 'Actions',
									render: (row: Department) => (
										<div className="flex gap-2">
											<Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
												Edit
											</Button>
											<Button
												size="sm"
												variant="danger"
												onClick={() => {
													setDeleteTarget(row)
													setDeleteError(null)
												}}
											>
												Delete
											</Button>
										</div>
									),
								},
							]
						: []),
				]}
			/>

			<Modal open={open} onClose={() => setOpen(false)} title="Add Department">
				<form className="space-y-4" onSubmit={handleSubmit}>
					{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
					<div>
						<label className={labelClass} htmlFor="dept-name">
							Name
						</label>
						<input id="dept-name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} required />
					</div>
					<div>
						<label className={labelClass} htmlFor="dept-short">
							Short Name
						</label>
						<input id="dept-short" value={shortName} onChange={(event) => setShortName(event.target.value)} className={inputClass} required />
						<p className="mt-1 text-xs text-text-muted">Shown on the Inventory department tabs — keep it brief (e.g. BSCS, MIDWIFERY).</p>
					</div>
					<div>
						<label className={labelClass} htmlFor="dept-programs">
							Programs (comma-separated)
						</label>
						<input id="dept-programs" value={programs} onChange={(event) => setPrograms(event.target.value)} className={inputClass} placeholder="BS Fisheries, BS Aquaculture" />
					</div>
					<Button type="submit" className="w-full" disabled={createDepartment.isPending}>
						{createDepartment.isPending ? 'Creating…' : 'Create Department'}
					</Button>
				</form>
			</Modal>

			{editTarget ? (
				<Modal open onClose={() => setEditTarget(null)} title={`Edit ${editTarget.name}`}>
					<form className="space-y-4" onSubmit={handleEdit}>
						{editError ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{editError}</div> : null}
						<div>
							<label className={labelClass} htmlFor="dept-edit-name">
								Name
							</label>
							<input id="dept-edit-name" value={editName} onChange={(event) => setEditName(event.target.value)} className={inputClass} required />
						</div>
						<div>
							<label className={labelClass} htmlFor="dept-edit-short">
								Short Name
							</label>
							<input id="dept-edit-short" value={editShortName} onChange={(event) => setEditShortName(event.target.value)} className={inputClass} required />
							<p className="mt-1 text-xs text-text-muted">Shown on the Inventory department tabs — keep it brief (e.g. BSCS, MIDWIFERY).</p>
						</div>
						<div>
							<label className={labelClass} htmlFor="dept-edit-programs">
								Programs (comma-separated)
							</label>
							<input id="dept-edit-programs" value={editPrograms} onChange={(event) => setEditPrograms(event.target.value)} className={inputClass} placeholder="BS Fisheries, BS Aquaculture" />
						</div>
						<div className="flex gap-2">
							<Button type="button" variant="secondary" className="flex-1" onClick={() => setEditTarget(null)}>
								Cancel
							</Button>
							<Button type="submit" className="flex-1" disabled={updateDepartment.isPending}>
								{updateDepartment.isPending ? 'Saving…' : 'Save Changes'}
							</Button>
						</div>
					</form>
				</Modal>
			) : null}

			{deleteTarget ? (
				<Modal open onClose={() => setDeleteTarget(null)} title="Delete Department">
					<div className="space-y-4">
						{deleteError ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{deleteError}</div> : null}
						<p className="text-sm text-text-primary">
							Delete <span className="font-semibold">{deleteTarget.name}</span>? This cannot be undone.
						</p>
						{/* Every foreign key onto departments is ON DELETE SET NULL, so
						    nothing is destroyed with it — but the detached rows change
						    meaning, and equipment with no department reads as Supply
						    Office stock, which students cannot see or borrow. */}
						<div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
							<p className="font-medium">Its records are not deleted — they are detached:</p>
							<ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
								<li>Equipment moves to the Supply Office pool, where students can no longer see or borrow it.</li>
								<li>Facilities become central (no department), visible to everyone.</li>
								<li>Faculty and admin accounts lose their department assignment.</li>
							</ul>
						</div>
						<div className="flex gap-2">
							<Button type="button" variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>
								Cancel
							</Button>
							<Button type="button" variant="danger" className="flex-1" onClick={handleDelete} disabled={deleteDepartment.isPending}>
								{deleteDepartment.isPending ? 'Deleting…' : 'Delete Department'}
							</Button>
						</div>
					</div>
				</Modal>
			) : null}
		</>
	)
}
