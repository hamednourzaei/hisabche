'use client'

import { useState } from 'react'

/**
 * React's «adjust some state when a prop changes», as one hook (13 Nov 2026).
 *
 * `adjust` runs DURING RENDER — on the first render and whenever one of `deps` changes
 * (`Object.is`, one by one) — and may only set THIS component's own state. React re-renders
 * the component at once with that state, before anything is painted.
 *
 * It replaces `useEffect(() => { setX(…) }, [deps])` for state derived from props or query data
 * (a form filled from the saved record, a dialog reset when it opens): the effect showed one frame
 * of stale UI, rendered twice, and is what `react-hooks/set-state-in-effect` flags.
 *
 * ⚠️ Not for side effects (network, DOM, storage) — those stay in effects. And `adjust` must not
 * change a value in `deps` unconditionally, or it loops like an effect would.
 */
export function useAdjustOnChange(deps: readonly unknown[], adjust: () => void): void {
  const [seen, setSeen] = useState<readonly unknown[] | null>(null)
  const changed =
    seen === null ||
    seen.length !== deps.length ||
    deps.some((value, index) => !Object.is(value, seen[index]))
  if (changed) {
    setSeen(deps)
    adjust()
  }
}
