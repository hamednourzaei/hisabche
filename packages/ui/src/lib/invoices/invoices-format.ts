// packages/ui/src/lib/invoices-format.ts

import { formatDate } from '@hisabche/formatting'

// ⚠️ `lang` IS A PARAMETER, NOT A DEFAULT. This was pinned to `"fa-AF"`, so
// every invoice list showed the Afghan solar calendar whatever the reader
// chose — English readers got Persian digits with it. A default would have
// left the existing callers silently wrong with nothing to find them;
// required, the compiler lists every one.
//
// This is a plain module, not a component, so it cannot read a hook — and a
// module-level «current language» is unsafe here: `apps/web` renders on the
// SERVER, where one process serves a Persian request and an English one at the
// same time. In a component, get `lang` from `useDateFormat()`.
export const fmtDate = (d: string, lang: string): string => {
  try {
    return formatDate(d, lang)
  } catch {
    return ''
  }
}

export const STATUS_MAP: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  completed: 'success',
  pending: 'warning',
  partial: 'secondary',
  cancelled: 'destructive',
}
