// The falling binary that used to be baked into the hero JPEG, redrawn as live
// elements so it actually falls. It was erased from the artwork in the same
// change — leaving it there would have parked a static copy behind the moving
// one.
//
// Column positions, digit strings and timings mirror LoginIllustration's RAIN,
// which drives the same `login-rain` keyframe for the fallback scene, so the
// photographic hero and the drawn one read as the same effect. That keyframe is
// already listed in the prefers-reduced-motion block in index.css, so anyone who
// has asked the OS for less motion gets the strands standing still.
const COLUMNS: { left: string; size: number; opacity: number; duration: number; delay: number; digits: string }[] = [
	{ left: '3%', size: 10, opacity: 0.3, duration: 27, delay: -4, digits: '10110100101101' },
	{ left: '11%', size: 9, opacity: 0.22, duration: 35, delay: -13, digits: '01101011001010' },
	{ left: '19%', size: 8, opacity: 0.26, duration: 30, delay: -21, digits: '11001011010011' },
	{ left: '29%', size: 9, opacity: 0.2, duration: 39, delay: -7, digits: '00101101011010' },
	{ left: '37%', size: 10, opacity: 0.28, duration: 25, delay: -17, digits: '10100110110101' },
	{ left: '46%', size: 8, opacity: 0.22, duration: 33, delay: -2, digits: '01011010010110' },
	{ left: '56%', size: 9, opacity: 0.26, duration: 29, delay: -11, digits: '11010010110100' },
	{ left: '65%', size: 8, opacity: 0.18, duration: 37, delay: -24, digits: '00110101101001' },
	{ left: '74%', size: 10, opacity: 0.24, duration: 31, delay: -9, digits: '10011010011011' },
]

// Hidden below lg on purpose, not as an oversight: the portrait artwork leads
// with the campus photograph, and binary falling across a photo of the gate
// reads as a glitch rather than as a motif.
export default function BinaryRain() {
	return (
		<div
			aria-hidden="true"
			// Faded out before it reaches the asset graph. The artwork only ever
			// carried binary across its top band; strands running the full height
			// would rain over the equipment tiles.
			className="pointer-events-none absolute inset-0 hidden overflow-hidden [mask-image:linear-gradient(to_bottom,black_0%,black_22%,transparent_52%)] lg:block"
		>
			{COLUMNS.map((column) => (
				<span
					key={column.left}
					className="login-rain absolute top-0 whitespace-pre font-mono tabular-nums text-cyan-300"
					style={{
						left: column.left,
						fontSize: `${column.size}px`,
						lineHeight: 1.85,
						opacity: column.opacity,
						animationDuration: `${column.duration}s`,
						animationDelay: `${column.delay}s`,
					}}
				>
					{[...column.digits].join('\n')}
				</span>
			))}
		</div>
	)
}
