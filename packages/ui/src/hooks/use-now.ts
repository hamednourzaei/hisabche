'use client'

import { useEffect, useState } from 'react'

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
 * paint the same neutral text; the effect then supplies the real time. Pass
 * `tickMs` to keep relative text ("minutes ago") current while mounted.
 */
export function useNow(tickMs?: number | undefined): number | null {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    if (!tickMs) return
    const id = setInterval(() => setNow(Date.now()), tickMs)
    return () => clearInterval(id)
  }, [tickMs])

  return now
}
