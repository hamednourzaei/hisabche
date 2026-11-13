'use client'

import { useMemo, useSyncExternalStore } from 'react'

/**
 * The current time, read AFTER MOUNT — never during render. React #418 (text).
 *
 * A component rendered on the server reads the clock twice with different
 * clocks and zones: once on the server (UTC), once in the browser (Kabul is
 * +4:30), and on cached/ISR pages the server's reading can be hours old. Any
 * text derived from that — a year, «۵ دقیقه پیش», a greeting — then differs
 * between the HTML and the first client render, and React throws the whole
 * tree away.
 *
 * Returns `null` on the server and on the first client render, so both sides
 * paint the same neutral text; subscribing (after commit) then supplies the real
 * time. Pass `tickMs` to keep relative text ("minutes ago") current while mounted.
 *
 * A small clock store per `tickMs` read with `useSyncExternalStore` (13 Nov 2026) —
 * the clock is read in the subscription, never in render and never set from an effect.
 */
function clockStore(tickMs: number | undefined) {
  let now: number | null = null
  return {
    subscribe(onChange: () => void) {
      now = Date.now()
      onChange()
      if (!tickMs) return () => undefined
      const id = setInterval(() => {
        now = Date.now()
        onChange()
      }, tickMs)
      return () => clearInterval(id)
    },
    read: (): number | null => now,
  }
}

const serverNow = (): number | null => null

export function useNow(tickMs?: number | undefined): number | null {
  const clock = useMemo(() => clockStore(tickMs), [tickMs])
  return useSyncExternalStore(clock.subscribe, clock.read, serverNow)
}
