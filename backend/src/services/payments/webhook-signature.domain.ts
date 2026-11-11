// ============================================
// backend/src/services/payments/webhook-signature.domain.ts
//
// V58 · P0-4 — Stripe webhook signature verification, without the stripe
// package (no dependency is added that the task did not name; the scheme is
// stable and documented by the provider).
//
// The scheme: the header carries `t=<unix-seconds>` and one or more
// `v1=<hex-hmac>` entries. The signature is HMAC-SHA256 over
// `<timestamp>.<raw-body>` keyed with the endpoint's webhook secret. The RAW
// body — the bytes the provider signed — never a re-serialized parse of it.
//
// WHAT IT REFUSES
//   · a missing or malformed header
//   · a timestamp older than the tolerance (replay protection: a captured
//     request cannot be replayed next week)
//   · a timestamp in the future beyond the tolerance (clock games)
//   · any v1 that does not match (tampered payload or wrong secret)
//   · comparison via timingSafeEqual, so the check itself leaks no prefix
//
// The secret arrives by name through the environment
// (STRIPE_WEBHOOK_SECRET). Its value is never logged, never returned, never
// embedded in an error message.
// ============================================

import { createHmac, timingSafeEqual } from 'node:crypto'

/** The default replay window Stripe documents for its own SDK. */
export const DEFAULT_TOLERANCE_SECONDS = 300

export type SignatureOutcome =
  | { ok: true; timestamp: Date }
  | {
      ok: false
      reason:
        'missing_header' | 'malformed_header' | 'timestamp_out_of_tolerance' | 'signature_mismatch'
    }

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // Length difference alone is a refusal — timingSafeEqual would throw.
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

/**
 * Verify one Stripe-style signed webhook. Pure: no clock reads inside — the
 * caller passes `now`, so a test is deterministic.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | string[] | undefined,
  secret: string,
  now: Date = new Date(),
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): SignatureOutcome {
  if (!signatureHeader) return { ok: false, reason: 'missing_header' }
  const header = (Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader) ?? ''

  let timestampPart: string | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2).map((s) => s?.trim())
    if (!key || value === undefined) continue
    if (key === 't' && timestampPart === null) timestampPart = value
    if (key === 'v1') signatures.push(value)
  }
  if (!timestampPart || signatures.length === 0) {
    return { ok: false, reason: 'malformed_header' }
  }

  const timestampSeconds = Number(timestampPart)
  if (!Number.isFinite(timestampSeconds)) {
    return { ok: false, reason: 'malformed_header' }
  }
  const age = Math.abs(now.getTime() / 1000 - timestampSeconds)
  if (age > toleranceSeconds) {
    return { ok: false, reason: 'timestamp_out_of_tolerance' }
  }

  const expected = createHmac('sha256', secret).update(`${timestampPart}.${rawBody}`).digest('hex')
  for (const candidate of signatures) {
    if (safeEquals(candidate.toLowerCase(), expected)) {
      return { ok: true, timestamp: new Date(timestampSeconds * 1000) }
    }
  }
  return { ok: false, reason: 'signature_mismatch' }
}
