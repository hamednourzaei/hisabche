// ============================================
// One Idempotency-Key per INTENT, not per request.
//
// A payment whose response was lost is still a payment. If the retry carries a
// new key the server cannot tell it from a second payment and records both.
// So the key is kept for as long as the same intent is being retried — after a
// network failure or a 5xx — and dropped only once the server has given a
// definitive answer: success, or a refusal (4xx) that no retry would change.
// The server stores the key (client_request_id) and answers a repeat with the
// original result.
// ============================================

import { useCallback, useRef } from 'react'

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  return (
    c?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  )
}

/** Whether an error is the server's final word on this request. */
export function isDefinitiveRefusal(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return (
    typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429
  )
}

export function useIntentKey(prefix: string) {
  const ref = useRef<string | null>(null)

  /** The key for the intent in progress, created on first use. */
  const current = useCallback(() => (ref.current ??= `${prefix}_${randomId()}`), [prefix])

  /** Call when the attempt ends: forgets the key unless the same intent may be retried. */
  const settle = useCallback((error?: unknown) => {
    if (error === undefined || isDefinitiveRefusal(error)) ref.current = null
  }, [])

  return { current, settle }
}
