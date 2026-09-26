// «Your plan's ceiling is reached» in the user's language — for every screen
// whose save the server can refuse with PLAN_LIMIT_REACHED (402).
//
// The raw code on screen says nothing to a shop owner; this says which
// ceiling, how high, and what to do (upgrade on /billing).

type Translate = (key: string, values?: Record<string, number>) => string

export function planLimitMessage(cause: unknown, t: Translate): string | null {
  const error = cause as { code?: unknown; limit?: { feature?: unknown; limit?: unknown } } | null
  if (error?.code !== 'PLAN_LIMIT_REACHED') return null
  const feature = error.limit?.feature === 'users' ? 'users' : 'invoices'
  const limit = typeof error.limit?.limit === 'number' ? error.limit.limit : 0
  return t(`billing.limitReached.${feature}`, { limit })
}
