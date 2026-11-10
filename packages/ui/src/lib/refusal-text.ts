// ============================================
// packages/ui/src/lib/refusal-text.ts
//
// A server refusal, in the person's words. A route refuses with a CODE
// («WASTE_MORE_THAN_STOCK»); a panel names the codes it has words for, and
// anything else falls back to the server's own message (apiErrorMessage).
// The code is read from the reply body first — axios's own `code` is never a
// reason (see lib/ai-error-text.ts).
// ============================================

import { apiErrorMessage } from '@hisabche/api'

type Translate = (key: string, fallback?: string) => string

export function refusalCode(error: unknown): string | null {
  const shape = error as { code?: unknown; response?: { data?: { code?: unknown } } } | null
  const fromBody = shape?.response?.data?.code
  if (typeof fromBody === 'string') return fromBody
  return typeof shape?.code === 'string' ? shape.code : null
}

export function refusalText(
  error: unknown,
  t: Translate,
  prefix: string,
  known: readonly string[],
  fallback: string,
): string {
  const code = refusalCode(error)
  return code && known.includes(code)
    ? t(`${prefix}.errors.${code}`)
    : apiErrorMessage(error, fallback)
}
