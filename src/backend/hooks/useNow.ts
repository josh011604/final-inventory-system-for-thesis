import { useEffect, useState } from 'react'

// A Date that re-renders the caller once a minute, so time-derived UI stays
// true on its own — a facility flips to "Occupied" the minute its booking
// starts, without the user refreshing the page.
//
// Each tick is scheduled to the next minute boundary rather than every 60s
// from mount, so the flip lands when the wall clock changes rather than up to
// a minute late.
export function useNow(): Date {
	const [now, setNow] = useState(() => new Date())

	useEffect(() => {
		let timeoutId: number

		const scheduleNextTick = () => {
			timeoutId = window.setTimeout(() => {
				setNow(new Date())
				scheduleNextTick()
			}, 60_000 - (Date.now() % 60_000))
		}

		scheduleNextTick()
		return () => window.clearTimeout(timeoutId)
	}, [])

	return now
}
