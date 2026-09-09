'use client'

// ============================================
// packages/ui/src/hooks/use-date-format.ts
//
// The date formatters for the language the reader actually chose.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY A HOOK AND NOT A `formatDate(value)`
//
// Dozens of components formatted dates with a hardcoded `'fa-AF'`, and one of
// them — `lib/utils.ts#formatDate` — was a SHARED helper whose doc comment
// promised «Jalali (Shamsi) or Gregorian» while accepting no language at all.
// The abstraction existed; it just never took the one input that mattered.
//
// The obvious repair is a module-level «current language» that the app sets on
// every locale change, so callers keep their one-argument signature. That is
// wrong here and would be worse than the bug: `apps/web` renders on the
// SERVER, where one Node process handles a Persian request and an English one
// concurrently. A module-level language is shared between them, so the last
// request to set it decides what the other one renders. A hook reads the
// locale of the tree being rendered, which is the only correct source.
//
// Desktop mounts these components through its `next-intl` shim, so `useLocale`
// resolves there too.
// ============================================

import { useMemo } from 'react'

import { useLocale } from 'next-intl'
import { formatDate, formatDateLong, formatDateTime, type DateInput } from '@hisabche/formatting'

export interface DateFormatters {
  /** `۱۴۰۵/۰۶/۱۸` · `1405/06/18` · `09/09/2026` */
  date: (value: DateInput, options?: Intl.DateTimeFormatOptions) => string
  /** `۱۸ شهریور ۱۴۰۵` (fa) · `۱۸ سنبلهٔ ۱۴۰۵` (af) · `September 9, 2026` (en) */
  dateLong: (value: DateInput) => string
  /** A date and a time of day. */
  dateTime: (value: DateInput) => string
  /** The resolved UI language, for anything that needs to pass it onward. */
  lang: string
}

export function useDateFormat(): DateFormatters {
  const lang = useLocale()

  return useMemo(
    () => ({
      date: (value: DateInput, options?: Intl.DateTimeFormatOptions) =>
        formatDate(value, lang, options),
      dateLong: (value: DateInput) => formatDateLong(value, lang),
      dateTime: (value: DateInput) => formatDateTime(value, lang),
      lang,
    }),
    [lang],
  )
}
