'use client'

// ============================================
// One calendar day kept in the address: `?date=YYYY-MM-DD`.
//
// A screen that shows «one day» and links away from it (the attendance sheet →
// an employee's file) loses the day on the way back if it lives in component
// state. In the address, Back returns to the same day and a refresh keeps it.
//
// Today carries no parameter — the plain address IS today. A value that is not
// a real Gregorian day is ignored, never guessed at.
// ============================================

import { useCallback, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toIsoDay } from '@hisabche/formatting'

/** `2026-02-30` looks like a day and is not one. */
export function isRealIsoDay(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export function useAddressDay(param = 'date'): [string, (day: string) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // The device's own day, fixed for the life of the screen.
  const [today] = useState(() => toIsoDay(new Date()))

  const asked = searchParams.get(param)
  const day = isRealIsoDay(asked) ? asked : today

  const setDay = useCallback(
    (next: string) => {
      if (!isRealIsoDay(next)) return
      const params = new URLSearchParams(searchParams.toString())
      if (next === today) params.delete(param)
      else params.set(param, next)
      const query = params.toString()
      // Replace, not push: stepping through days should not fill the history
      // a person has to walk back through.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [param, pathname, router, searchParams, today],
  )

  return [day, setDay]
}
