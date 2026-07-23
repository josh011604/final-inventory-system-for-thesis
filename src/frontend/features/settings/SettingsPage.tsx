import { useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Building2, CircleUserRound, Package, Settings } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Skeleton from '@/components/ui/Skeleton'
import BackupPage from '@/frontend/features/backup/BackupPage'
import {
	useCategories,
	useCreateCategory,
	useCreateSupplier,
	useDeleteCategory,
	useDeleteSupplier,
	useSuppliers,
	useUploadAvatar,
} from '@/backend/lib/supabase/queries'
import { getErrorMessage } from '@/backend/lib/errors'
import type { SchoolUser } from '@/backend/types/school'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

const appName = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'BISU FIMS'

function CategoriesCard() {
	const { data, isLoading } = useCategories()
	const createCategory = useCreateCategory()
	const deleteCategory = useDeleteCategory()
	const [name, setName] = useState('')
	const [error, setError] = useState<string | null>(null)

	const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		const trimmed = name.trim()
		if (!trimmed) return
		try {
			await createCategory.mutateAsync(trimmed)
			setName('')
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to add category.'))
		}
	}

	return (
		<Card title="Equipment Categories" subtitle="Inventory classification" action={<Package className="h-5 w-5 text-primary" />}>
			{error ? <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
			<form className="mb-4 flex gap-2" onSubmit={handleAdd}>
				<input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Add a category (e.g. Networking)" />
				<Button type="submit" size="sm" disabled={createCategory.isPending || !name.trim()}>
					{createCategory.isPending ? 'Adding…' : 'Add'}
				</Button>
			</form>
			{isLoading ? (
				<Skeleton className="h-8 w-full" />
			) : data && data.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					{data.map((category) => (
						<span key={category.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1 text-sm text-text-primary">
							{category.name}
							<button
								type="button"
								onClick={() => deleteCategory.mutate(category.id)}
								disabled={deleteCategory.isPending}
								className="text-text-muted transition hover:text-danger disabled:opacity-50"
								aria-label={`Delete ${category.name}`}
							>
								✕
							</button>
						</span>
					))}
				</div>
			) : (
				<p className="text-sm text-text-muted">No categories yet.</p>
			)}
		</Card>
	)
}

function SuppliersCard() {
	const { data, isLoading } = useSuppliers()
	const createSupplier = useCreateSupplier()
	const deleteSupplier = useDeleteSupplier()

	const [open, setOpen] = useState(false)
	const [name, setName] = useState('')
	const [contact, setContact] = useState('')
	const [phone, setPhone] = useState('')
	const [email, setEmail] = useState('')
	const [error, setError] = useState<string | null>(null)

	const reset = () => {
		setName('')
		setContact('')
		setPhone('')
		setEmail('')
		setError(null)
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		try {
			await createSupplier.mutateAsync({
				name: name.trim(),
				contact_person: contact.trim() || null,
				phone: phone.trim() || null,
				email: email.trim() || null,
			})
			reset()
			setOpen(false)
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to add supplier.'))
		}
	}

	return (
		<>
			<Card
				title="Suppliers"
				subtitle="Procurement sources"
				action={
					<Button size="sm" onClick={() => setOpen(true)}>
						Add Supplier
					</Button>
				}
			>
				{isLoading ? (
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : data && data.length > 0 ? (
					<div className="overflow-x-auto rounded-xl border border-border">
						<table className="min-w-full divide-y divide-border">
							<thead className="bg-gradient-to-r from-primary-light via-primary-light/60 to-transparent">
								<tr>
									{['Supplier', 'Contact', 'Phone', 'Email', ''].map((header) => (
										<th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-primary">
											{header}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{data.map((supplier) => (
									<tr key={supplier.id} className="text-sm text-text-primary">
										<td className="px-4 py-3 font-medium">{supplier.name}</td>
										<td className="px-4 py-3 text-text-muted">{supplier.contact_person ?? '—'}</td>
										<td className="px-4 py-3 text-text-muted">{supplier.phone ?? '—'}</td>
										<td className="px-4 py-3 text-text-muted">{supplier.email ?? '—'}</td>
										<td className="px-4 py-3 text-right">
											<button
												type="button"
												onClick={() => deleteSupplier.mutate(supplier.id)}
												disabled={deleteSupplier.isPending}
												className="text-xs font-semibold text-text-muted transition hover:text-danger disabled:opacity-50"
											>
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p className="text-sm text-text-muted">No suppliers yet.</p>
				)}
			</Card>

			<Modal open={open} onClose={() => { setOpen(false); reset() }} title="Add Supplier">
				<form className="space-y-4" onSubmit={handleSubmit}>
					{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
					<div>
						<label className={labelClass} htmlFor="sup-name">Name</label>
						<input id="sup-name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} required />
					</div>
					<div>
						<label className={labelClass} htmlFor="sup-contact">Contact Person</label>
						<input id="sup-contact" value={contact} onChange={(event) => setContact(event.target.value)} className={inputClass} placeholder="Optional" />
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className={labelClass} htmlFor="sup-phone">Phone</label>
							<input id="sup-phone" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} placeholder="Optional" />
						</div>
						<div>
							<label className={labelClass} htmlFor="sup-email">Email</label>
							<input id="sup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="Optional" />
						</div>
					</div>
					<Button type="submit" className="w-full" disabled={createSupplier.isPending || !name.trim()}>
						{createSupplier.isPending ? 'Saving…' : 'Save Supplier'}
					</Button>
				</form>
			</Modal>
		</>
	)
}

function ProfileCard({ user, onAvatarUpdated }: { user: SchoolUser; onAvatarUpdated: (avatarUrl: string) => void }) {
	const uploadAvatar = useUploadAvatar()
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [preview, setPreview] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		if (!file) return

		setError(null)

		if (!file.type.startsWith('image/')) {
			setError('Please select an image file.')
			return
		}
		if (file.size > MAX_AVATAR_BYTES) {
			setError('Image must be smaller than 5MB.')
			return
		}

		const localPreview = URL.createObjectURL(file)
		setPreview(localPreview)

		try {
			const avatarUrl = await uploadAvatar.mutateAsync({ userId: user.id, file })
			onAvatarUpdated(avatarUrl)
		} catch (mutationError) {
			setError(getErrorMessage(mutationError, 'Failed to upload profile picture.'))
		} finally {
			URL.revokeObjectURL(localPreview)
			setPreview(null)
		}
	}

	const avatarSrc = preview ?? user.avatarUrl

	return (
		<Card title="Profile" subtitle="Your account" action={<CircleUserRound className="h-5 w-5 text-primary" />}>
			<div className="flex flex-wrap items-center gap-5">
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					disabled={uploadAvatar.isPending}
					className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-hover text-xl font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
					aria-label="Change profile picture"
				>
					{avatarSrc ? <img src={avatarSrc} alt={user.fullName} className="h-full w-full object-cover" /> : user.profilePicture}
					<span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100">
						{uploadAvatar.isPending ? 'Uploading…' : 'Change'}
					</span>
				</button>
				<div>
					<p className="text-base font-semibold text-text-primary">{user.fullName}</p>
					<p className="text-sm text-text-muted">{user.email}</p>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						className="mt-2"
						onClick={() => fileInputRef.current?.click()}
						disabled={uploadAvatar.isPending}
					>
						{uploadAvatar.isPending ? 'Uploading…' : 'Upload new picture'}
					</Button>
				</div>
				<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
			</div>
			{error ? <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
		</Card>
	)
}

export default function SettingsPage({ user, onAvatarUpdated }: { user: SchoolUser; onAvatarUpdated: (avatarUrl: string) => void }) {
	const isSuperAdmin = user.role === 'super_admin'
	const { data: categories } = useCategories()
	const { data: suppliers } = useSuppliers()
	const [tab, setTab] = useState<'profile' | 'general' | 'backup'>('profile')

	const tabClass = (active: boolean) =>
		`rounded-lg px-4 py-2 text-sm font-semibold transition ${
			active ? 'bg-gradient-to-r from-primary to-primary-hover text-white shadow-sm' : 'text-text-muted hover:text-primary'
		}`

	return (
		<div className="space-y-6">
			<Card title={isSuperAdmin ? 'System Settings' : 'Account Settings'} subtitle="Administration" action={<Settings className="h-5 w-5 text-primary" />}>
				<div className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-bg p-1">
					<button type="button" className={tabClass(tab === 'profile')} onClick={() => setTab('profile')}>
						Profile
					</button>
					{isSuperAdmin ? (
						<>
							<button type="button" className={tabClass(tab === 'general')} onClick={() => setTab('general')}>
								General
							</button>
							<button type="button" className={tabClass(tab === 'backup')} onClick={() => setTab('backup')}>
								Backup &amp; Restore
							</button>
						</>
					) : null}
				</div>
			</Card>

			{tab === 'profile' ? (
				<ProfileCard user={user} onAvatarUpdated={onAvatarUpdated} />
			) : tab === 'general' && isSuperAdmin ? (
				<>
					<div className="grid gap-3 sm:grid-cols-3">
						<div className="rounded-xl border border-border bg-surface p-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Application</p>
							<p className="mt-1 flex items-center gap-2 font-semibold text-text-primary">
								<Building2 className="h-4 w-4 text-primary" />
								{appName}
							</p>
						</div>
						<div className="rounded-xl border border-border bg-surface p-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Categories</p>
							<p className="mt-1 text-2xl font-semibold text-primary">{categories?.length ?? 0}</p>
						</div>
						<div className="rounded-xl border border-border bg-surface p-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Suppliers</p>
							<p className="mt-1 text-2xl font-semibold text-accent">{suppliers?.length ?? 0}</p>
						</div>
					</div>
					<div className="grid gap-6 lg:grid-cols-2">
						<CategoriesCard />
						<SuppliersCard />
					</div>
				</>
			) : (
				<BackupPage />
			)}
		</div>
	)
}
