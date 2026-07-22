import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AtSign, GraduationCap, History, PackageCheck, Repeat, ShieldCheck, UserCircle2, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { signIn, signUp } from '@/backend/lib/supabase/auth'
import { supabase } from '@/backend/lib/supabase/client'
import Button from '@/components/ui/Button'

type DepartmentOption = {
	id: string
	name: string
	programs: string[]
}

const features: { label: string; icon: LucideIcon }[] = [
	{ label: 'Fast Equipment Borrowing', icon: Repeat },
	{ label: 'Real-time Status Updates', icon: PackageCheck },
	{ label: 'Complete Inventory Control', icon: ShieldCheck },
	{ label: 'Detailed History Tracking', icon: History },
]

const demoAccounts = [
	{ label: 'Super Admin', department: 'Institution-wide', username: 'superadmin', password: 'Super123!', icon: ShieldCheck },
	{ label: 'Dept Admin', department: 'BSCS', username: 'bscs.admin', password: 'Admin123!', icon: Users },
	{ label: 'Dept Admin', department: 'BSIT Electricity', username: 'bsit.admin', password: 'Admin123!', icon: Users },
	{ label: 'Dept Admin', department: 'Inland Fisheries', username: 'bsf.admin', password: 'Admin123!', icon: Users },
	{ label: 'Dept Admin', department: 'Teacher Education', username: 'cte.admin', password: 'Admin123!', icon: Users },
	{ label: 'Dept Admin', department: 'Midwifery', username: 'midwifery.admin', password: 'Admin123!', icon: Users },
	{ label: 'Staff', department: 'BSCS', username: 'bscs.staff', password: 'Staff123!', icon: UserCircle2 },
	{ label: 'Staff', department: 'BSIT Electricity', username: 'bsit.staff', password: 'Staff123!', icon: UserCircle2 },
	{ label: 'Staff', department: 'Inland Fisheries', username: 'bsf.staff', password: 'Staff123!', icon: UserCircle2 },
	{ label: 'Staff', department: 'Teacher Education', username: 'cte.staff', password: 'Staff123!', icon: UserCircle2 },
	{ label: 'Staff', department: 'Midwifery', username: 'midwifery.staff', password: 'Staff123!', icon: UserCircle2 },
	{ label: 'Student', department: 'BSCS', username: 'bscs.student', password: 'Student123!', icon: GraduationCap },
]

const inputClass =
	'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary-light'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

function EyeIcon({ open }: { open: boolean }) {
	if (open) {
		return (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
				<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12Z" strokeLinecap="round" strokeLinejoin="round" />
				<circle cx="12" cy="12" r="3" />
			</svg>
		)
	}
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
			<path d="M3 3l18 18" strokeLinecap="round" />
			<path
				d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6 0 9.5 7 9.5 7a15.6 15.6 0 0 1-3.15 4.2M6.6 6.6C4 8.3 2.5 12 2.5 12s3.5 7 9.5 7c1.3 0 2.5-.3 3.55-.75"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	)
}

function PasswordField({
	id,
	label,
	value,
	onChange,
	placeholder,
}: {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	placeholder: string
}) {
	const [visible, setVisible] = useState(false)

	return (
		<div>
			<label className={labelClass} htmlFor={id}>
				{label}
			</label>
			<div className="relative">
				<input
					id={id}
					type={visible ? 'text' : 'password'}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className={`${inputClass} pr-12`}
					placeholder={placeholder}
					required
				/>
				<button
					type="button"
					onClick={() => setVisible((current) => !current)}
					className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-bg text-text-muted transition hover:bg-border"
					aria-label={visible ? 'Hide password' : 'Show password'}
				>
					<EyeIcon open={visible} />
				</button>
			</div>
		</div>
	)
}

function Tab({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={
				active
					? 'flex-1 rounded-lg bg-surface py-2.5 text-sm font-semibold text-text-primary shadow-sm transition'
					: 'flex-1 rounded-lg py-2.5 text-sm font-medium text-text-muted transition hover:text-text-primary'
			}
		>
			{children}
		</button>
	)
}

export default function AuthScreen() {
	const [tab, setTab] = useState<'login' | 'register'>('login')

	const [identifier, setIdentifier] = useState('')
	const [password, setPassword] = useState('')
	const [loginVisible, setLoginVisible] = useState(false)
	const [loginBusy, setLoginBusy] = useState(false)
	const [loginError, setLoginError] = useState<string | null>(null)

	const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([])
	const [accountType, setAccountType] = useState<'employee' | 'student'>('employee')
	const [fullName, setFullName] = useState('')
	const [employeeId, setEmployeeId] = useState('')
	const [departmentId, setDepartmentId] = useState('')
	const [email, setEmail] = useState('')
	const [regUsername, setRegUsername] = useState('')
	const [regPassword, setRegPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [registerBusy, setRegisterBusy] = useState(false)
	const [registerMessage, setRegisterMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

	useEffect(() => {
		supabase
			.from('departments')
			.select('id, name, programs')
			.order('name')
			.then(({ data }) => {
				const options = (data ?? []).map((row) => ({ id: row.id, name: row.name, programs: row.programs ?? [] }))
				setDepartmentOptions(options)
				setDepartmentId((current) => current || options[0]?.id || '')
			})
	}, [])

	const fillDemoAccount = (account: (typeof demoAccounts)[number]) => {
		setIdentifier(account.username)
		setPassword(account.password)
		setLoginError(null)
	}

	const resetRegisterForm = () => {
		setAccountType('employee')
		setFullName('')
		setEmployeeId('')
		setEmail('')
		setRegUsername('')
		setRegPassword('')
		setConfirmPassword('')
	}

	const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setLoginBusy(true)
		setLoginError(null)

		const result = await signIn(identifier, password)
		setLoginBusy(false)
		if (result.error) {
			setLoginError(result.error)
		}
		// on success, App's onAuthStateChange listener takes over.
	}

	const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (regPassword !== confirmPassword) {
			setRegisterMessage({ tone: 'error', text: 'Passwords do not match.' })
			return
		}

		setRegisterBusy(true)
		setRegisterMessage(null)

		const result = await signUp({
			email,
			password: regPassword,
			fullName,
			username: regUsername,
			departmentId,
			employeeId,
		})

		setRegisterBusy(false)

		if (result.error) {
			setRegisterMessage({ tone: 'error', text: result.error })
			return
		}

		setRegisterMessage({ tone: 'success', text: 'Account created. A Super Administrator must activate it before you can sign in.' })
		setIdentifier(regUsername)
		resetRegisterForm()
		setTab('login')
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
			<div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] shadow-2xl shadow-black/10 lg:grid-cols-2">
				<section className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-hover px-10 py-12 text-white">
					<div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
					<div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

					<div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white/10 ring-4 ring-white/10">
						<img src="/bisu-logo.png" alt="Bohol Island State University seal" className="h-24 w-24 drop-shadow-lg" />
					</div>

					<p className="relative mt-6 text-lg font-extrabold uppercase leading-snug tracking-wide text-accent">Bohol Island State University</p>
					<p className="relative text-sm font-semibold uppercase tracking-[0.3em] text-white">Calape Campus</p>
					<div className="relative mt-4 h-0.5 w-28 bg-accent" />

					<h1 className="relative mt-10 font-serif text-2xl font-semibold">Inventory</h1>
					<p className="relative mt-2 text-white/80">Smart Equipment Management</p>

					<ul className="relative mt-8 space-y-4">
						{features.map((feature) => (
							<li key={feature.label} className="flex items-center gap-3">
								<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-accent ring-1 ring-white/10">
									<feature.icon className="h-4 w-4" />
								</span>
								<span className="text-white/90">{feature.label}</span>
							</li>
						))}
					</ul>
				</section>

				<section className="flex flex-col justify-center bg-surface px-10 py-12">
					<div className="flex rounded-xl bg-bg p-1">
						<Tab active={tab === 'login'} onClick={() => setTab('login')}>
							Login
						</Tab>
						<Tab active={tab === 'register'} onClick={() => setTab('register')}>
							Register
						</Tab>
					</div>

					{tab === 'login' ? (
						<form className="mt-8 space-y-5" onSubmit={handleLogin}>
							{loginError ? <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{loginError}</div> : null}

							<div>
								<label className={labelClass} htmlFor="identifier">
									Username or Email
								</label>
								<div className="relative">
									<AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
									<input
										id="identifier"
										value={identifier}
										onChange={(event) => setIdentifier(event.target.value)}
										className={`${inputClass} pl-10`}
										placeholder="Enter your username"
										required
									/>
								</div>
							</div>

							<div>
								<label className={labelClass} htmlFor="password">
									Password
								</label>
								<div className="relative">
									<input
										id="password"
										type={loginVisible ? 'text' : 'password'}
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										className={`${inputClass} pr-12`}
										placeholder="Enter your password"
										required
									/>
									<button
										type="button"
										onClick={() => setLoginVisible((current) => !current)}
										className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-bg text-text-muted transition hover:bg-border"
										aria-label={loginVisible ? 'Hide password' : 'Show password'}
									>
										<EyeIcon open={loginVisible} />
									</button>
								</div>
							</div>

							<Button type="submit" className="w-full" disabled={loginBusy}>
								{loginBusy ? 'Signing in…' : 'Login'}
							</Button>

							<div className="pt-2">
								<p className="text-center text-xs uppercase tracking-[0.25em] text-text-muted">Demo Accounts</p>
								<div className="mt-3 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
									{demoAccounts.map((account) => (
										<button
											key={account.username}
											type="button"
											onClick={() => fillDemoAccount(account)}
											className="group rounded-xl border border-border bg-bg px-3 py-2.5 text-left transition hover:border-primary hover:bg-primary-light"
										>
											<div className="flex items-center gap-1.5">
												<account.icon className="h-3.5 w-3.5 shrink-0 text-text-muted transition group-hover:text-primary" />
												<p className="truncate text-xs font-semibold text-text-primary">{account.label}</p>
											</div>
											<p className="mt-1 truncate text-[11px] text-text-muted">{account.department}</p>
											<p className="mt-0.5 text-[11px] font-medium text-primary">{account.username}</p>
										</button>
									))}
								</div>
							</div>
						</form>
					) : (
						<form className="mt-8 space-y-4" onSubmit={handleRegister}>
							{registerMessage ? (
								<div
									className={
										registerMessage.tone === 'success'
											? 'rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success'
											: 'rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger'
									}
								>
									{registerMessage.text}
								</div>
							) : null}

							<div>
								<span className={labelClass}>Account Type</span>
								<div className="flex rounded-xl bg-bg p-1">
									<button
										type="button"
										onClick={() => setAccountType('employee')}
										className={
											accountType === 'employee'
												? 'flex flex-1 items-center justify-center gap-2 rounded-lg bg-surface py-2.5 text-sm font-semibold text-text-primary shadow-sm transition'
												: 'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-text-muted transition hover:text-text-primary'
										}
									>
										<UserCircle2 className="h-4 w-4" />
										Employee
									</button>
									<button
										type="button"
										onClick={() => setAccountType('student')}
										className={
											accountType === 'student'
												? 'flex flex-1 items-center justify-center gap-2 rounded-lg bg-surface py-2.5 text-sm font-semibold text-text-primary shadow-sm transition'
												: 'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-text-muted transition hover:text-text-primary'
										}
									>
										<GraduationCap className="h-4 w-4" />
										Student
									</button>
								</div>
							</div>

							<div className="grid gap-4 sm:grid-cols-2">
								<div>
									<label className={labelClass} htmlFor="fullName">
										Full Name
									</label>
									<input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} placeholder="Juan Dela Cruz" required />
								</div>
								<div>
									<label className={labelClass} htmlFor="employeeId">
										{accountType === 'student' ? 'Student ID' : 'Employee ID'}
									</label>
									<input
										id="employeeId"
										value={employeeId}
										onChange={(event) => setEmployeeId(event.target.value)}
										className={inputClass}
										placeholder={accountType === 'student' ? '2023-00123' : 'ST-1003'}
									/>
								</div>
							</div>

							<div>
								<label className={labelClass} htmlFor="department">
									Department
								</label>
								<select id="department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className={inputClass}>
									{departmentOptions.map((dept) => (
										<option key={dept.id} value={dept.id}>
											{dept.name} — {dept.programs.join(', ')}
										</option>
									))}
								</select>
							</div>

							<div>
								<label className={labelClass} htmlFor="email">
									Email
								</label>
								<input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="you@school.edu" required />
							</div>

							<div>
								<label className={labelClass} htmlFor="regUsername">
									Username
								</label>
								<input id="regUsername" value={regUsername} onChange={(event) => setRegUsername(event.target.value)} className={inputClass} placeholder="Choose a username" required />
							</div>

							<div className="grid gap-4 sm:grid-cols-2">
								<PasswordField id="regPassword" label="Password" value={regPassword} onChange={setRegPassword} placeholder="Create a password" />
								<PasswordField id="confirmPassword" label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" />
							</div>

							<Button type="submit" className="w-full" disabled={registerBusy}>
								{registerBusy ? 'Creating account…' : 'Register'}
							</Button>
						</form>
					)}
				</section>
			</div>
		</div>
	)
}
