import type { ReactNode } from 'react'

// Decorative artwork for the login hero: a central holographic database with
// every school asset this system actually tracks wired back into it.
//
// The icons are deliberately specific — chair, projector, printer, aircon,
// facilities, vehicles — rather than generic "tech" glyphs. A person landing
// here should be able to tell it is a school facilities and inventory system,
// not an anonymous IT dashboard.
//
// Inline SVG rather than an exported image: crisp at any size, a few KB, and
// recolourable from code. Purely presentational — aria-hidden and
// pointer-events-none, so assistive tech goes straight to the sign-in form.

const NAVY = '#071A52'
const DEEP = '#0A2A7D'
const MID = '#123EAF'
const SHADE = '#162C7E'
const CYAN = '#00D4FF'
const BLUE = '#355CFF'

// Ring of assets around the hub. Angles are degrees clockwise from 12 o'clock;
// the radius varies slightly so the ring reads as a loose orbit rather than a
// mechanical circle.
const HUB = { x: 200, y: 306 }

type Asset = { angle: number; radius: number; label: string; caption: string; icon: ReactNode }

// Each icon is drawn inside a 20x20 box centred on (0,0) — translated into
// place by the ring maths below, so the artwork stays declarative.
//
// This set mirrors the nine tiles in the hero artwork exactly. It used to carry
// COMPUTER, BOOKS, LAB EQUIPMENT, RECORDS, QR CODE and BARCODE, none of which
// survive in the design — QR and barcode were dropped deliberately, and the
// system has no barcode or QR feature to advertise. A fallback that promises
// capabilities the product does not have is worse than a plain background, and
// this one only renders when the JPEG fails to load, so the mismatch would have
// surfaced exactly when nobody was looking for it.
const ASSETS: Asset[] = [
	{
		angle: 0,
		radius: 132,
		label: 'television',
		caption: 'TV',
		icon: (
			<>
				<rect x="-11" y="-8" width="22" height="14" rx="1.4" />
				<path d="M-5 10 L5 10" />
				<path d="M0 6 L0 10" />
			</>
		),
	},
	{
		angle: 40,
		radius: 146,
		label: 'laptop',
		caption: 'LAPTOP',
		icon: (
			<>
				<path d="M-8 -7 L8 -7 L8 4 L-8 4 Z" />
				<path d="M-11 4 L11 4 L9 9 L-9 9 Z" strokeOpacity="0.5" />
			</>
		),
	},
	{
		angle: 80,
		radius: 134,
		label: 'printer',
		caption: 'PRINTER',
		icon: (
			<>
				<rect x="-10" y="-3" width="20" height="10" rx="1.6" />
				<path d="M-6 -3 L-6 -9 L6 -9 L6 -3" />
				<path d="M-6 7 L-6 11 L6 11 L6 7" />
				<path d="M6 0.5 L8 0.5" strokeOpacity="0.6" />
			</>
		),
	},
	{
		angle: 120,
		radius: 148,
		label: 'storage rack',
		caption: 'STORAGE',
		icon: (
			<>
				<path d="M-9 -8 L-9 9 M9 -8 L9 9" />
				<path d="M-9 -8 L9 -8 M-9 -2 L9 -2 M-9 4 L9 4" />
				<path d="M-9 9 L9 9" strokeOpacity="0.5" />
			</>
		),
	},
	{
		angle: 160,
		radius: 138,
		label: 'facilities',
		caption: 'FACILITIES',
		icon: (
			<>
				<path d="M-9 9 L-9 -4 L0 -9 L9 -4 L9 9 Z" />
				<rect x="-5.5" y="-2" width="4" height="4" strokeOpacity="0.6" />
				<rect x="1.5" y="-2" width="4" height="4" strokeOpacity="0.6" />
				<path d="M-2 9 L-2 3.5 L2 3.5 L2 9" />
			</>
		),
	},
	{
		angle: 200,
		radius: 144,
		label: 'vehicle',
		caption: 'CARS',
		icon: (
			<>
				<path d="M-11 3 L-9.5 -1 C -8.5 -4, -6.5 -5, -3.5 -5 L3 -5 C 6 -5, 8 -3.5, 9.5 -1 L11 3 Z" />
				<path d="M-11 3 L11 3" strokeOpacity="0.5" />
				<circle cx="-6" cy="6" r="2.2" />
				<circle cx="6" cy="6" r="2.2" />
			</>
		),
	},
	{
		angle: 240,
		radius: 134,
		label: 'air conditioner',
		caption: 'AIRCON',
		icon: (
			<>
				<rect x="-11" y="-6" width="22" height="9" rx="2.2" />
				<path d="M-8 1 L8 1" strokeOpacity="0.5" />
				<path d="M-6 6 C -5 8, -3 8, -2 10" strokeOpacity="0.6" />
				<path d="M2 6 C 3 8, 5 8, 6 10" strokeOpacity="0.6" />
			</>
		),
	},
	{
		angle: 280,
		radius: 146,
		label: 'projector',
		caption: 'PROJECTOR',
		icon: (
			<>
				<rect x="-10" y="-5" width="20" height="11" rx="2.5" />
				<circle cx="-3" cy="0.5" r="3.2" />
				<path d="M5 -2 L8 -2" />
				<path d="M-8 6 L-8 9 M7 6 L7 9" />
			</>
		),
	},
	{
		angle: 320,
		radius: 136,
		label: 'chair',
		caption: 'CHAIR',
		icon: (
			<>
				<path d="M-6 -9 L-6 1 L6 1 L6 -9" />
				<path d="M-8 1 L8 1" />
				<path d="M-6 1 L-7 10 M6 1 L7 10" />
				<path d="M-6 -4 L6 -4" strokeOpacity="0.45" />
			</>
		),
	},
]

const BINARY_MOTES: { x: number; y: number; text: string; size: number; opacity: number }[] = [
	{ x: 26, y: 96, text: '010101010101', size: 8, opacity: 0.18 },
	{ x: 250, y: 132, text: '101100101', size: 7, opacity: 0.16 },
	{ x: 44, y: 250, text: '001010101', size: 7, opacity: 0.14 },
	{ x: 268, y: 452, text: '110010110', size: 8, opacity: 0.16 },
	{ x: 32, y: 500, text: '010011010', size: 7, opacity: 0.13 },
	{ x: 232, y: 640, text: '101010011', size: 7, opacity: 0.12 },
]

// Falling binary strands. Fixed digit strings, not random ones, so the artwork
// renders identically on every load rather than reshuffling on each render.
// Durations are all different and the delays are negative, so every column
// starts part-way through its fall and they never fall in lockstep.
const RAIN: { x: number; size: number; duration: number; delay: number; digits: string }[] = [
	{ x: 22, size: 10, duration: 27, delay: -4, digits: '10110100101101' },
	{ x: 88, size: 9, duration: 35, delay: -13, digits: '01101011001010' },
	{ x: 150, size: 8, duration: 30, delay: -21, digits: '11001011010011' },
	{ x: 232, size: 9, duration: 39, delay: -7, digits: '00101101011010' },
	{ x: 300, size: 10, duration: 25, delay: -17, digits: '10100110110101' },
	{ x: 366, size: 8, duration: 33, delay: -2, digits: '01011010010110' },
]

const PARTICLES: [number, number, number, number, number][] = [
	[58, 150, 1.6, 0.5, 0],
	[330, 208, 1.3, 0.4, 1.6],
	[286, 96, 1.8, 0.35, 3.1],
	[68, 402, 1.5, 0.45, 0.8],
	[352, 372, 1.7, 0.3, 2.4],
	[150, 92, 1.4, 0.4, 4],
	[344, 546, 1.6, 0.3, 1.2],
	[40, 604, 1.8, 0.3, 3.6],
]

function polar(angle: number, radius: number) {
	const rad = ((angle - 90) * Math.PI) / 180
	return { x: HUB.x + radius * Math.cos(rad), y: HUB.y + radius * Math.sin(rad) }
}

export default function LoginIllustration() {
	return (
		<svg
			viewBox="0 0 400 760"
			preserveAspectRatio="xMidYMid slice"
			className="pointer-events-none absolute inset-0 h-full w-full"
			aria-hidden="true"
			focusable="false"
		>
			<defs>
				<linearGradient id="li-bg" x1="0" y1="0" x2="0.8" y2="1">
					<stop offset="0%" stopColor={NAVY} />
					<stop offset="42%" stopColor={DEEP} />
					<stop offset="78%" stopColor={SHADE} />
					<stop offset="100%" stopColor={MID} />
				</linearGradient>

				<radialGradient id="li-hub-glow" cx="50%" cy="50%" r="50%">
					<stop offset="0%" stopColor={CYAN} stopOpacity="0.32" />
					<stop offset="45%" stopColor={BLUE} stopOpacity="0.14" />
					<stop offset="100%" stopColor={BLUE} stopOpacity="0" />
				</radialGradient>
				<radialGradient id="li-ambient" cx="50%" cy="50%" r="50%">
					<stop offset="0%" stopColor={MID} stopOpacity="0.5" />
					<stop offset="100%" stopColor={MID} stopOpacity="0" />
				</radialGradient>

				<linearGradient id="li-cyl" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0%" stopColor={CYAN} stopOpacity="0.06" />
					<stop offset="45%" stopColor={CYAN} stopOpacity="0.26" />
					<stop offset="100%" stopColor={BLUE} stopOpacity="0.06" />
				</linearGradient>

				<pattern id="li-hex" width="30" height="52" patternUnits="userSpaceOnUse">
					<path d="M15 0 L30 8.6 L30 26 L15 34.6 L0 26 L0 8.6 Z" fill="none" stroke="#ffffff" strokeOpacity="0.045" strokeWidth="0.6" />
				</pattern>
				<pattern id="li-grid" width="40" height="40" patternUnits="userSpaceOnUse">
					<path d="M40 0 L0 0 0 40" fill="none" stroke="#ffffff" strokeOpacity="0.03" strokeWidth="0.7" />
				</pattern>

				<filter id="li-glow" x="-70%" y="-70%" width="240%" height="240%">
					<feGaussianBlur stdDeviation="4.5" result="b" />
					<feMerge>
						<feMergeNode in="b" />
						<feMergeNode in="SourceGraphic" />
					</feMerge>
				</filter>
			</defs>

			{/* ---- layered background -------------------------------------------- */}
			{/* No opaque fill here on purpose: the hero paints the campus photo and
			    the navy veil behind this SVG, so the artwork stays transparent and
			    the photograph reads through it. */}
			<rect width="400" height="760" fill="url(#li-grid)" />
			<rect width="400" height="760" fill="url(#li-hex)" />
			<ellipse cx="200" cy="306" rx="290" ry="270" fill="url(#li-hub-glow)" />
			<ellipse cx="60" cy="60" rx="200" ry="180" fill="url(#li-ambient)" opacity="0.5" />

			{/* thin data-stream waves */}
			<g fill="none" stroke={CYAN} strokeOpacity="0.12" strokeWidth="0.9">
				<path d="M-20 520 C 90 492, 160 552, 262 520 S 400 490, 430 512" />
				<path d="M-20 556 C 96 532, 168 588, 268 556 S 400 528, 430 548" strokeOpacity="0.08" />
			</g>

			{/* Falling binary. Kept deliberately faint — it should register as
			    movement in the corner of your eye, not as text competing with the
			    heading. Each strand fades from its tail up to a brighter leading
			    digit, the way the eye expects falling glyphs to behave. */}
			<g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill={CYAN}>
				{RAIN.map((column) => (
					<g
						key={`rain-${column.x}`}
						className="login-rain"
						style={{ animationDuration: `${column.duration}s`, animationDelay: `${column.delay}s` }}
					>
						<text x={column.x} y="0" fontSize={column.size} letterSpacing="1">
							{[...column.digits].map((digit, index) => (
								<tspan
									key={`${column.x}-${index}`}
									x={column.x}
									dy={index === 0 ? 0 : column.size * 1.85}
									fillOpacity={0.05 + (index / column.digits.length) * 0.17}
								>
									{digit}
								</tspan>
							))}
						</text>
					</g>
				))}
			</g>

			<g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill={CYAN}>
				{BINARY_MOTES.map((m) => (
					<text key={`${m.x}-${m.y}`} x={m.x} y={m.y} fontSize={m.size} fillOpacity={m.opacity} letterSpacing="1.5">
						{m.text}
					</text>
				))}
			</g>

			{/* ---- circuit traces from hub out to each asset --------------------- */}
			<g stroke={CYAN} strokeOpacity="0.3" strokeWidth="0.9" fill="none">
				{ASSETS.map((asset) => {
					const p = polar(asset.angle, asset.radius)
					return <line key={`trace-${asset.label}`} x1={HUB.x} y1={HUB.y} x2={p.x} y2={p.y} />
				})}
			</g>
			{/* one brighter pulse so the network reads as live, not wired */}
			<g stroke={CYAN} strokeOpacity="0.85" strokeWidth="1.4" fill="none" strokeLinecap="round">
				<line
					x1={HUB.x}
					y1={HUB.y}
					x2={polar(104, 148).x}
					y2={polar(104, 148).y}
					strokeDasharray="5 145"
					className="login-pulse"
				/>
			</g>

			{/* faint ring tying the assets together */}
			<circle cx={HUB.x} cy={HUB.y} r="140" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.8" strokeDasharray="2 8" />

			{/* ---- central holographic database ---------------------------------- */}
			<g filter="url(#li-glow)">
				<g transform={`translate(${HUB.x} ${HUB.y})`}>
					<ellipse cx="0" cy="-30" rx="42" ry="14" fill="url(#li-cyl)" stroke={CYAN} strokeOpacity="0.7" strokeWidth="1.2" />
					<path d="M-42 -30 L-42 26" stroke={CYAN} strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
					<path d="M42 -30 L42 26" stroke={CYAN} strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
					<path d="M-42 26 C -42 34, 42 34, 42 26" stroke={CYAN} strokeOpacity="0.55" strokeWidth="1.2" fill="none" />
					<rect x="-42" y="-30" width="84" height="58" fill="url(#li-cyl)" opacity="0.55" />
					{/* stacked platters */}
					<ellipse cx="0" cy="-8" rx="42" ry="13" fill="none" stroke={CYAN} strokeOpacity="0.4" strokeWidth="0.9" />
					<ellipse cx="0" cy="12" rx="42" ry="13" fill="none" stroke={CYAN} strokeOpacity="0.28" strokeWidth="0.9" />
					{/* activity ticks */}
					<path d="M-26 -32 L-26 -26 M-16 -33 L-16 -25 M-6 -32 L-6 -27" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.4" strokeLinecap="round" />
					<circle cx="24" cy="-30" r="2.4" fill={CYAN} fillOpacity="0.95" />
				</g>
			</g>

			{/* ---- asset nodes ---------------------------------------------------- */}
			<g>
				{ASSETS.map((asset) => {
					const p = polar(asset.angle, asset.radius)
					return (
						<g key={asset.label} transform={`translate(${p.x} ${p.y})`}>
							{/* Rounded-square tiles, not circles — they read as asset cards
							    rather than orbiting bubbles. Each is captioned, because an
							    outline of a projector or a microscope is ambiguous at this
							    size and the caption is what makes the scene legible as a
							    school inventory rather than generic tech. */}
							<rect x="-21" y="-24" width="42" height="42" rx="12" fill={NAVY} fillOpacity="0.55" stroke={CYAN} strokeOpacity="0.45" strokeWidth="1" />
							<g
								stroke={CYAN}
								strokeOpacity="0.95"
								strokeWidth="1.15"
								fill="none"
								strokeLinecap="round"
								strokeLinejoin="round"
								transform="translate(0 -3) scale(0.68)"
							>
								{asset.icon}
							</g>
							<text
								y="27"
								textAnchor="middle"
								fill={CYAN}
								fillOpacity="0.85"
								fontSize="6.4"
								fontFamily="ui-sans-serif, system-ui, sans-serif"
								fontWeight="600"
								letterSpacing="0.6"
							>
								{asset.caption}
							</text>
						</g>
					)
				})}
			</g>

			{/* ---- lower-left isometric facility scene, holographic --------------- */}
			<g transform="translate(18 540)" stroke={CYAN} strokeOpacity="0.34" strokeWidth="1" fill="none" strokeLinejoin="round">
				{/* Campus building — the anchor of the lower scene, so it is drawn at
				    real size with a pediment, columns and lit windows rather than as a
				    small silhouette. */}
				<g transform="translate(96 0)">
					<path d="M0 150 L0 66 L88 66 L88 150" />
					<path d="M-10 66 L44 30 L98 66" />
					<path d="M32 30 L32 12 L56 12 L56 24" strokeOpacity="0.5" />
					<circle cx="44" cy="52" r="7" strokeOpacity="0.55" />
					<path d="M44 48 L44 52 L47 54" strokeOpacity="0.55" />
					{/* columned entrance */}
					<path d="M30 150 L30 104 L58 104 L58 150" strokeOpacity="0.45" />
					<path d="M38 150 L38 112 M50 150 L50 112" strokeOpacity="0.3" />
					{/* window grid */}
					<g strokeOpacity="0.22" fill={CYAN} fillOpacity="0.1">
						<rect x="8" y="80" width="13" height="14" />
						<rect x="26" y="80" width="13" height="14" />
						<rect x="49" y="80" width="13" height="14" />
						<rect x="67" y="80" width="13" height="14" />
						<rect x="8" y="106" width="13" height="14" />
						<rect x="67" y="106" width="13" height="14" />
					</g>
				</g>

				{/* stockroom shelving, stacked with cartons */}
				<g transform="translate(0 74)">
					<path d="M0 76 L0 0 M64 76 L64 0 M0 0 L64 0 M0 26 L64 26 M0 52 L64 52" />
					<rect x="8" y="5" width="18" height="16" fill={BLUE} fillOpacity="0.18" />
					<rect x="32" y="5" width="22" height="16" fill={CYAN} fillOpacity="0.12" />
					<rect x="8" y="31" width="23" height="16" fill={CYAN} fillOpacity="0.1" />
					<rect x="37" y="31" width="17" height="16" fill={BLUE} fillOpacity="0.18" />
					<rect x="12" y="57" width="20" height="15" fill={BLUE} fillOpacity="0.1" />
				</g>

				{/* loose cartons on the ground */}
				<g transform="translate(198 118)" strokeOpacity="0.28">
					<rect x="0" y="10" width="22" height="18" fill={CYAN} fillOpacity="0.08" />
					<path d="M0 17 L22 17 M11 10 L11 28" strokeOpacity="0.2" />
					<rect x="26" y="16" width="16" height="12" fill={BLUE} fillOpacity="0.12" />
				</g>

				{/* server rack tying the scene to the hub */}
				<g transform="translate(250 82)">
					<rect x="0" y="0" width="26" height="56" rx="2" />
					<path d="M0 14 L26 14 M0 28 L26 28 M0 42 L26 42" strokeOpacity="0.22" />
					<circle cx="20" cy="7" r="1.6" fill={CYAN} fillOpacity="0.9" stroke="none" />
					<circle cx="20" cy="21" r="1.6" fill={CYAN} fillOpacity="0.5" stroke="none" />
				</g>

				{/* ground plane + glowing pathways between the pieces */}
				<path d="M-18 150 L300 150" strokeOpacity="0.35" />
				<path d="M32 74 C 52 28, 120 26, 140 62" strokeOpacity="0.3" strokeDasharray="2 6" />
				<path d="M184 120 C 214 100, 232 106, 250 118" strokeOpacity="0.25" strokeDasharray="2 6" />
			</g>

			{/* ---- particles ------------------------------------------------------ */}
			<g fill="#ffffff">
				{PARTICLES.map(([cx, cy, r, opacity, delay]) => (
					<circle
						key={`${cx}-${cy}`}
						cx={cx}
						cy={cy}
						r={r}
						fillOpacity={opacity}
						className="login-particle"
						style={{ animationDelay: `${delay}s` }}
					/>
				))}
			</g>

			{/* keeps the overlaid wordmark on a calm base */}
			<rect width="400" height="760" fill={NAVY} opacity="0.16" />
		</svg>
	)
}
