import { useState } from 'react'
import type { FormEvent } from 'react'
import EntityTablePage from '@/components/ui/EntityTablePage'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useCreateDepartment, useDepartments } from '@/backend/lib/supabase/queries'
import type { Tables } from '@/backend/types/supabase'
import { getErrorMessage } from '@/backend/lib/errors'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

export default function DepartmentsPage() {
	const { data, isLoading } = useDepartments()
	const createDepartment = useCreateDepartment()
	const [open, setOpen] = useState(false)
	const [name, setName] = useState('')
	const [shortName, setShortName] = useState('')
	const [programs, setPrograms] = useState('')
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		try {
			await createDepartment.mutateAsync({
				name,
				short_name: shortName,
				programs: programs
					.split(',')
					.map((program) => program.trim())
					.filter(Boolean),
			})
			setName('')
			setShortName('')
			setPrograms('')
			setOpen(false)
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to create department.'))
		}
	}

	return (
		<>
			<EntityTablePage<Tables<'departments'>>
				title="Departments"
				subtitle={`${data?.length ?? 0} departments`}
				rows={data}
				isLoading={isLoading}
				searchKeys={['name', 'short_name']}
				action={
					<Button size="sm" onClick={() => setOpen(true)}>
						Add Department
					</Button>
				}
				columns={[
					{ header: 'Name', render: (row) => <span className="font-medium text-text-primary">{row.name}</span> },
					{ header: 'Short Name', render: (row) => row.short_name },
					{ header: 'Programs', render: (row) => (row.programs.length > 0 ? row.programs.join(', ') : '—') },
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
		</>
	)
}
