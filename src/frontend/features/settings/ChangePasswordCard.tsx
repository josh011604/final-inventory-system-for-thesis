import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { changePassword } from '@/backend/lib/supabase/auth'

const inputClass = 'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none transition focus:border-primary'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

const NEW_PASSWORD_PATTERN = /^(?=.*\d).{8,}$/

// Takes no props: the account to re-authenticate is read from the live auth
// session inside changePassword, not passed in from the profile row.
export default function ChangePasswordCard() {
	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [pending, setPending] = useState(false)
	const [error, setError] = useState('')
	const [success, setSuccess] = useState('')

	const newPasswordValid = NEW_PASSWORD_PATTERN.test(newPassword)
	const canSubmit = currentPassword.length > 0 && newPasswordValid && newPassword === confirmPassword

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError('')
		setSuccess('')

		if (!newPasswordValid) {
			setError('New password must be at least 8 characters and contain at least one digit.')
			return
		}
		if (newPassword !== confirmPassword) {
			setError('New Password and Confirm New Password must match.')
			return
		}

		setPending(true)
		// try/finally so the button cannot stick on "Updating…". Without it any
		// rejection — a dropped connection mid-request, say — skips setPending(false)
		// and leaves the form permanently disabled with no error shown, which
		// reads exactly like the feature being broken.
		try {
			const result = await changePassword(currentPassword, newPassword)

			if (result.error) {
				setError(result.error)
				return
			}

			setCurrentPassword('')
			setNewPassword('')
			setConfirmPassword('')
			setSuccess('Password updated successfully.')
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : 'Could not update the password. Try again.')
		} finally {
			setPending(false)
		}
	}

	return (
		<Card title="Change Password" subtitle="Update your account password" action={<KeyRound className="h-5 w-5 text-primary" />}>
			<form className="space-y-4" onSubmit={handleSubmit}>
				{error ? <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
				{success ? <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{success}</div> : null}
				<div>
					<label className={labelClass} htmlFor="current-password">Current Password</label>
					<input
						id="current-password"
						type="password"
						value={currentPassword}
						onChange={(event) => setCurrentPassword(event.target.value)}
						className={inputClass}
						required
					/>
				</div>
				<div>
					<label className={labelClass} htmlFor="new-password">New Password</label>
					<input
						id="new-password"
						type="password"
						value={newPassword}
						onChange={(event) => setNewPassword(event.target.value)}
						className={inputClass}
						required
					/>
				</div>
				<div>
					<label className={labelClass} htmlFor="confirm-new-password">Confirm New Password</label>
					<input
						id="confirm-new-password"
						type="password"
						value={confirmPassword}
						onChange={(event) => setConfirmPassword(event.target.value)}
						className={inputClass}
						required
					/>
				</div>
				<Button type="submit" disabled={pending || !canSubmit}>
					{pending ? 'Updating…' : 'Update Password'}
				</Button>
			</form>
		</Card>
	)
}
