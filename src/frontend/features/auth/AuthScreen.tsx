import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowRight, AtSign, GraduationCap, History, Lock, PackageCheck, ShieldCheck, UserCircle2, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import BinaryRain from '@/frontend/features/auth/BinaryRain'
import LoginIllustration from '@/frontend/features/auth/LoginIllustration'
import { sendPasswordReset, signIn, signUp } from '@/backend/lib/supabase/auth'
import { supabase } from '@/backend/lib/supabase/client'

type DepartmentOption = {
	id: string
	name: string
	programs: string[]
}

const features: { label: string; detail: string; icon: LucideIcon }[] = [
	{ label: 'Inventory Monitoring', detail: 'Track every school asset in real time.', icon: PackageCheck },
	{ label: 'Smart Analytics', detail: 'Monitor equipment utilisation and availability.', icon: History },
	{ label: 'Secure Access', detail: 'Role-based permissions for every department.', icon: ShieldCheck },
]

const inputClass =
	'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary-light'
const labelClass = 'mb-1.5 block text-sm font-medium text-text-primary'

// Where "Remember me" stores the username to prefill next visit.
const REMEMBERED_USER_KEY = 'bisu-inventory:remembered-user'

// Pre-rendered hero artwork: the campus composited with the inventory network.
// Stored as JPEG rather than the 2 MB source PNG — at quality 88 it is visually
// identical for a photographic, gradient-heavy image but ~7x smaller, which
// matters on a login screen that must paint before anything else. If the file is
// missing or fails to decode, the page falls back to the inline SVG scene over
// the campus photo, so the login screen is never left blank.
const HERO_IMAGE = '/login-hero.jpg'

// Portrait cut of the same scene, for phones. The landscape artwork puts the
// campus photo on the right and the asset graph on the left; a phone viewport
// is around 1:2, so object-cover on that file crops to a narrow middle strip
// and shows neither. This one stacks them the way the mobile design does —
// photo as a band across the top, graph below it on the right — so the copy
// underneath still has the full width.
const HERO_IMAGE_MOBILE = '/login-hero-mobile.jpg'

// Field filters for the register form. Both strip disallowed characters as the
// user types rather than complaining on submit: a rejected keystroke simply
// never appears, which reads as "this field takes letters" instead of an error
// after the form is already filled in. Paste is covered too — React's onChange
// fires for it, so pasting "Juan2" lands as "Juan".

// Full name: letters plus the punctuation real names actually use — spaces,
// hyphens, apostrophes and periods (Ma. Dela Cruz-Reyes, O'Brien). \p{L}\p{M}
// rather than A-Z so Ñ, é and other accented letters survive; only digits and
// symbols are dropped.
const lettersOnly = (value: string) => value.replace(/[^\p{L}\p{M}.'\- ]/gu, '')

// School / employee ID: digits only.
const digitsOnly = (value: string) => value.replace(/\D/g, '')

// The sign-in call to action, as a native button rather than the shared
// <Button>. That component's primary variant sets its own from-/to- gradient
// stops, and two competing sets of gradient utilities resolve by stylesheet
// order — not by the order they appear in the class string — so the app's
// purple was winning and this rendered plum instead of blue. Owning the element
// sidesteps the collision entirely.
function CtaButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
	return (
		<button
			type="submit"
			disabled={busy}
			className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#355CFF] to-[#6B3DF5] py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#355CFF]/25 transition hover:shadow-xl hover:shadow-[#355CFF]/35 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none disabled:active:scale-100"
		>
			{busy ? busyLabel : label}
			{busy ? null : <ArrowRight className="h-4 w-4" />}
		</button>
	)
}

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
				<Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
				<input
					id={id}
					type={visible ? 'text' : 'password'}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className={`${inputClass} pl-10 pr-12`}
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

// Underline tabs rather than a segmented pill: the underline is its own element
// that scales in, so switching reads as a slide along the rail instead of a
// block swapping colour.
function Tab({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-selected={active}
			className={`relative flex flex-1 items-center justify-center gap-2 pb-3 pt-1 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
				active ? 'font-semibold text-text-primary' : 'font-medium text-text-muted hover:text-text-primary'
			}`}
		>
			{children}
			<span
				aria-hidden="true"
				className={`absolute inset-x-0 bottom-0 h-0.5 origin-center rounded-full bg-linear-to-r from-[#355CFF] to-[#6B3DF5] transition-transform duration-200 ease-out ${
					active ? 'scale-x-100' : 'scale-x-0'
				}`}
			/>
		</button>
	)
}

export default function AuthScreen() {
	const [tab, setTab] = useState<'login' | 'register'>('login')
	// Flipped by the <img>'s onError when public/login-hero.png is not there, so
	// the screen degrades to the inline artwork instead of rendering bare navy.
	const [heroImageOk, setHeroImageOk] = useState(true)

	// "Remember me" prefills the username next time. It deliberately does NOT
	// change how long the session lasts — Supabase already persists sessions, and
	// a checkbox that silently claimed to shorten or extend that would be a lie
	// about how the auth actually behaves.
	const [identifier, setIdentifier] = useState(() => localStorage.getItem(REMEMBERED_USER_KEY) ?? '')
	const [rememberMe, setRememberMe] = useState(() => localStorage.getItem(REMEMBERED_USER_KEY) != null)
	const [password, setPassword] = useState('')
	const [loginVisible, setLoginVisible] = useState(false)
	const [loginBusy, setLoginBusy] = useState(false)
	const [loginError, setLoginError] = useState<string | null>(null)
	const [loginNotice, setLoginNotice] = useState<string | null>(null)

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
		setLoginNotice(null)

		const result = await signIn(identifier, password)
		setLoginBusy(false)
		if (result.error) {
			setLoginError(result.error)
			return
		}
		if (rememberMe) localStorage.setItem(REMEMBERED_USER_KEY, identifier)
		else localStorage.removeItem(REMEMBERED_USER_KEY)
		// on success, App's onAuthStateChange listener takes over.
	}

	const handleForgotPassword = async () => {
		setLoginError(null)
		setLoginNotice(null)
		const result = await sendPasswordReset(identifier)
		if (result.error) setLoginError(result.error)
		else setLoginNotice('Password reset link sent. Check the inbox for that account.')
	}

	const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (regPassword !== confirmPassword) {
			setRegisterMessage({ tone: 'error', text: 'Passwords do not match.' })
			return
		}
		// Every student must belong to exactly one department — the
		// profiles_student_requires_department constraint rejects the row
		// otherwise, and the failure would surface only as an opaque
		// "Database error saving new user".
		if (!departmentId) {
			setRegisterMessage({
				tone: 'error',
				text:
					accountType === 'student'
						? 'Select a department. Every student account must belong to one.'
						: 'Select a department.',
			})
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
			idNumber: employeeId,
			accountType,
		})

		setRegisterBusy(false)

		if (result.error) {
			setRegisterMessage({ tone: 'error', text: result.error })
			return
		}

		// Two different gates, and confusing them is why "the admin approved me but
		// I still cannot log in" happens: the email link proves the address is
		// real, the admin activation grants access. Only mention the one that is
		// actually outstanding.
		setRegisterMessage({
			tone: 'success',
			text: result.needsEmailConfirmation
				? 'Account created. Confirm your email using the link we just sent, then wait for an administrator to activate the account before signing in.'
				: 'Account created. An administrator must activate it before you can sign in.',
		})
		setIdentifier(regUsername)
		resetRegisterForm()
		setTab('login')
	}

	// Defined once, rendered in two places: along the base of the hero column on
	// desktop, and below the sign-in card on phones, which is where the mobile
	// design puts them. They cannot simply be reordered with CSS because the two
	// positions live in different grid children. Whichever copy is not in use is
	// display:none, so it is out of the accessibility tree as well as invisible.
	const featureCards = (
		<ul className="grid grid-cols-3 gap-3">
			{features.map((feature) => (
				<li
					key={feature.label}
					className="rounded-2xl bg-white/8 p-3.5 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/12 hover:ring-cyan-300/40"
				>
					<span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-300/25">
						<feature.icon className="h-4 w-4" />
					</span>
					<p className="mt-2.5 text-[13px] font-semibold leading-tight text-white">{feature.label}</p>
					<p className="mt-1.5 text-[11px] leading-snug text-white/65">{feature.detail}</p>
				</li>
			))}
		</ul>
	)

	return (
		// Full-bleed: the navy scene IS the page, edge to edge. The campus
		// photograph runs underneath the whole thing — the same image the
		// signed-in app sits on — so login and the dashboard share one place.
		<div className="relative min-h-screen bg-[#071A52] text-white">
			{/* The pre-rendered hero artwork, spanning the whole page. On desktop its
			    network of assets falls on the left where the copy sits and the campus
			    gate on the right, behind the sign-in card; phones get the portrait cut
			    instead, which stacks the same two elements. The <source> is keyed to
			    the same 1024px breakpoint as the lg: grid below, so the artwork and
			    the layout switch together. */}
			{heroImageOk ? (
				<picture>
					<source media="(min-width: 1024px)" srcSet={HERO_IMAGE} />
					<img
						src={HERO_IMAGE_MOBILE}
						alt=""
						aria-hidden="true"
						className="pointer-events-none fixed inset-0 h-full w-full object-cover"
						onError={() => setHeroImageOk(false)}
					/>
				</picture>
			) : (
				/* Fallback while the artwork file is absent: the campus photo,
				   blurred and desaturated so it reads as depth rather than subject. */
				<div
					aria-hidden="true"
					className="pointer-events-none fixed inset-0 bg-[url('/bisucal.webp')] bg-cover bg-center opacity-75 filter-[blur(1px)_saturate(0.75)_brightness(0.95)]"
				/>
			)}
			{/* Navy veil. Much lighter over the finished artwork — that image is
			    already dark and colour-graded, so it only needs enough to keep white
			    text off the brightest highlights; the fallback photo needs far more. */}
			<div
				aria-hidden="true"
				className={`pointer-events-none fixed inset-0 bg-linear-to-b ${
					heroImageOk
						? 'from-[#071A52]/45 via-[#0A2A7D]/25 to-[#071A52]/45'
						: 'from-[#071A52]/88 via-[#0A2A7D]/72 to-[#123EAF]/62'
				}`}
			/>

			<div className="relative grid min-h-screen lg:grid-cols-[62fr_38fr]">
				{/* Hero: the illustration is the background of this column, everything
				    below sits on top of it. The composition keeps its middle clear,
				    which is where this copy lands.
				    The mobile top padding clears the portrait artwork's photo band and
				    asset graph, which together occupy its top ~43%. That maps straight
				    to vh because the artwork is 1:2 and every phone viewport is taller
				    than that, so object-cover always scales it to full viewport height
				    and trims the sides instead. */}
				<section className="relative flex flex-col justify-between overflow-hidden px-7 pb-8 pt-[46vh] sm:px-10 lg:pt-11 lg:pb-11">
					{/* Only when the artwork file is missing — that image already contains
					    the hub, the asset tiles and the isometric campus, so drawing them
					    again would double up. The binary is the exception: it was erased
					    from the JPEG so it could be animated, and LoginIllustration draws
					    its own, so exactly one of these two renders it either way. */}
					{heroImageOk ? <BinaryRain /> : <LoginIllustration />}

					{/* branding — desktop only. On a phone the artwork's photo band leads
					    with the campus gate, which carries the university's name in the
					    photograph itself, so repeating the seal and wordmark above the
					    copy just pushes the form further down. */}
					<div className="relative hidden items-center gap-4 lg:flex">
						{/* Concentric rings around the seal, echoing the hub's orbits so the
						    badge belongs to the artwork rather than sitting on top of it. */}
						<div className="relative flex h-28 w-28 shrink-0 items-center justify-center sm:h-32 sm:w-32">
							<span aria-hidden="true" className="absolute inset-0 rounded-full ring-1 ring-cyan-300/25" />
							<span aria-hidden="true" className="absolute inset-2 rounded-full ring-1 ring-cyan-300/40" />
							<span aria-hidden="true" className="absolute -inset-2 rounded-full bg-cyan-400/10 blur-lg" />
							<div className="relative flex h-22 w-22 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30 backdrop-blur-sm sm:h-24 sm:w-24">
								<img src="/bisu-logo.png" alt="Bohol Island State University seal" className="h-19 w-19 drop-shadow-lg sm:h-21 sm:w-21" />
							</div>
						</div>
						<div className="min-w-0">
							<p className="text-sm font-bold uppercase leading-tight tracking-wide text-white">Bohol Island State University</p>
							<p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-300">Calape Campus</p>
						</div>
					</div>

					{/* welcome — left-aligned, capped short of the asset graph. The graph
					    was moved to the right of the navy panel (x≈390–770 of 1536) so the
					    copy gets the clear left side; this width stops it at x≈371. The
					    percentage resolves against the hero column's content box, and it
					    tracks the artwork because object-cover scales that to viewport
					    WIDTH on any viewport wider than 3:2, which every desktop is. */}
					<div className="relative pb-10 lg:mr-[62%] lg:pt-10">
						<p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-300/90">Welcome to</p>
						<h1 className="mt-3 max-w-sm text-3xl font-semibold leading-[1.15] tracking-tight">
							School Facilities Management &amp; <span className="text-cyan-300">Inventory</span> System
						</h1>
						<div className="mt-5 h-0.5 w-24 bg-linear-to-r from-cyan-400 to-transparent" />
						<p className="mt-5 max-w-xs text-sm leading-relaxed text-white/70">
							Manage school assets efficiently, securely, and intelligently.
						</p>
					</div>

					{/* feature cards — three across, along the base of the hero. On phones
					    they render below the sign-in card instead; see featureCards. */}
					<div className="relative hidden lg:block">{featureCards}</div>
				</section>

				{/* glass-panel-strong, not glass-panel: at 0.92 alpha the campus still
				    shows through but labels and inputs keep full contrast. The inputs
				    themselves stay on solid bg-surface, so nothing typed is ever read
				    against the photo. Browsers without backdrop-filter fall back to an
				    opaque surface (see the @supports rule in index.css). */}
				{/* Frosted rather than solid, so the campus photo behind the card reads
				    through this half too and the two panels feel like one surface
				    instead of a white box bolted to an illustration. glass-panel (0.82)
				    over glass-panel-strong (0.92): enough of the backdrop to see, still
				    opaque enough that labels keep their contrast. */}
				{/* Sign-in column: a solid card floating on the navy, so the form has
				    the flat, high-contrast surface a password field wants while the
				    scene continues behind it. */}
				{/* flex-col so the phone-only feature cards can stack under the card;
				    on desktop that column holds the card alone and still centres it. */}
				<section className="relative flex flex-col items-center justify-center px-5 pb-10 pt-2 sm:px-8 lg:py-10">
					{/* Frosted, not solid white: the campus now shows through the card the
					    same way it shows through the hero, so the two halves read as one
					    surface. glass-panel keeps the fill at 0.82 with a 16px backdrop
					    blur, which is opaque enough for the labels to hold contrast — and
					    the inputs inside stay on solid bg-surface, so nothing typed is
					    ever read against the photograph. */}
					<div className="glass-panel relative w-full max-w-md rounded-3xl px-7 py-9 text-text-primary shadow-2xl shadow-black/40 ring-1 ring-white/45 sm:px-9">
	
					<div className="relative flex gap-6 border-b border-border">
						<Tab active={tab === 'login'} onClick={() => setTab('login')}>
							<UserCircle2 className="h-4 w-4" />
							Login
						</Tab>
						<Tab active={tab === 'register'} onClick={() => setTab('register')}>
							<UserPlus className="h-4 w-4" />
							Register
						</Tab>
					</div>

					{tab === 'login' ? (
						<form className="relative mt-8 space-y-5" onSubmit={handleLogin}>
							{loginError ? <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{loginError}</div> : null}
							{loginNotice ? <div className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{loginNotice}</div> : null}

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
									<Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
									<input
										id="password"
										type={loginVisible ? 'text' : 'password'}
										value={password}
										onChange={(event) => setPassword(event.target.value)}
										className={`${inputClass} pl-10 pr-12`}
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

							<div className="flex items-center justify-between gap-3">
								<label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
									<input
										type="checkbox"
										checked={rememberMe}
										onChange={(event) => setRememberMe(event.target.checked)}
										className="h-4 w-4 rounded border-border accent-[#355CFF]"
									/>
									Remember me
								</label>
								<button
									type="button"
									onClick={handleForgotPassword}
									className="text-sm font-medium text-[#355CFF] transition hover:underline"
								>
									Forgot password?
								</button>
							</div>

							<CtaButton busy={loginBusy} label="Login" busyLabel="Signing in…" />
						</form>
					) : (
						<form className="relative mt-8 space-y-4" onSubmit={handleRegister}>
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
									<input
										id="fullName"
										value={fullName}
										onChange={(event) => setFullName(lettersOnly(event.target.value))}
										className={inputClass}
										placeholder="Juan Dela Cruz"
										autoCapitalize="words"
										required
									/>
								</div>
								<div>
									<label className={labelClass} htmlFor="employeeId">
										{accountType === 'student' ? 'Student ID' : 'Employee ID'}
									</label>
									<input
										id="employeeId"
										value={employeeId}
										onChange={(event) => setEmployeeId(digitsOnly(event.target.value))}
										className={inputClass}
										inputMode="numeric"
										// Placeholders show digits only — the old samples ('2023-00123',
										// 'ST-1003') carried a hyphen and letters this field no longer accepts.
										placeholder={accountType === 'student' ? '202300123' : '1003'}
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

							<CtaButton busy={registerBusy} label="Register" busyLabel="Creating account…" />
						</form>
					)}

					{/* Rendered as text, not links: this system has no public Terms or
					    Privacy pages to point at, and a dead href is worse than none.
					    Swap in <a> tags once those pages exist. */}
					<p className="relative mt-8 text-center text-[11px] text-text-muted">
						By logging in, you agree to our <span className="font-medium text-[#355CFF]">Terms of Service</span> and{' '}
						<span className="font-medium text-[#355CFF]">Privacy Policy</span>.
					</p>
					</div>

					{/* Phone placement for the feature cards: below the form, where the
					    mobile design has them, rather than above it — pushing the login
					    fields off the first screen to make room for them is the one thing
					    a login page must not do. */}
					<div className="mt-7 w-full max-w-md lg:hidden">{featureCards}</div>
				</section>
			</div>
		</div>
	)
}
