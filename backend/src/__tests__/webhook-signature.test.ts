// ============================================
// webhook-signature domain — deterministic tests.
//
// The clock is a parameter, so every case is exact: the live signature, an
// expired one, a future one, a tampered payload, a wrong secret, a
// missing/malformed header. No network, no provider, no randomness.
// ============================================

import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  verifyWebhookSignature,
  DEFAULT_TOLERANCE_SECONDS,
} from '../services/payments/webhook-signature.domain'

const SECRET = 'whsec_test_secret_value'
const BODY = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' })
const NOW = new Date('2026-01-15T12:00:00.000Z')

function signed(body: string, timestampSeconds: number, secret = SECRET): string {
  const mac = createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex')
  return `t=${timestampSeconds},v1=${mac}`
}

describe('verifyWebhookSignature', () => {
  it('accepts a live, correctly signed request', () => {
    const t = Math.floor(NOW.getTime() / 1000)
    const outcome = verifyWebhookSignature(BODY, signed(BODY, t), SECRET, NOW)
    expect(outcome).toEqual({ ok: true, timestamp: new Date(t * 1000) })
  })

  it('accepts any of several v1 signatures (rotation)', () => {
    const t = Math.floor(NOW.getTime() / 1000)
    const oldSig = `v1=${createHmac('sha256', 'whsec_old').update(`${t}.${BODY}`).digest('hex')}`
    const header = `t=${t},${oldSig},${signed(BODY, t)}`
    const outcome = verifyWebhookSignature(BODY, header, SECRET, NOW)
    expect(outcome.ok).toBe(true)
  })

  it('refuses a missing header', () => {
    const outcome = verifyWebhookSignature(BODY, undefined, SECRET, NOW)
    expect(outcome).toMatchObject({ ok: false, reason: 'missing_header' })
  })

  it('refuses a header without a timestamp or without v1', () => {
    expect(verifyWebhookSignature(BODY, 'v1=abc', SECRET, NOW)).toMatchObject({
      ok: false,
      reason: 'malformed_header',
    })
    expect(
      verifyWebhookSignature(BODY, `t=${Math.floor(NOW.getTime() / 1000)}`, SECRET, NOW),
    ).toMatchObject({ ok: false, reason: 'malformed_header' })
  })

  it('refuses a replayed request outside the tolerance window', () => {
    const t = Math.floor(NOW.getTime() / 1000) - DEFAULT_TOLERANCE_SECONDS - 1
    const outcome = verifyWebhookSignature(BODY, signed(BODY, t), SECRET, NOW)
    expect(outcome).toMatchObject({ ok: false, reason: 'timestamp_out_of_tolerance' })
  })

  it('refuses a timestamp from the future beyond the tolerance', () => {
    const t = Math.floor(NOW.getTime() / 1000) + DEFAULT_TOLERANCE_SECONDS + 60
    const outcome = verifyWebhookSignature(BODY, signed(BODY, t), SECRET, NOW)
    expect(outcome).toMatchObject({ ok: false, reason: 'timestamp_out_of_tolerance' })
  })

  it('refuses a tampered payload — the signature was over other bytes', () => {
    const t = Math.floor(NOW.getTime() / 1000)
    const tampered = BODY.replace('evt_1', 'evt_evil')
    const outcome = verifyWebhookSignature(tampered, signed(BODY, t), SECRET, NOW)
    expect(outcome).toMatchObject({ ok: false, reason: 'signature_mismatch' })
  })

  it('refuses a signature made with a different secret', () => {
    const t = Math.floor(NOW.getTime() / 1000)
    const outcome = verifyWebhookSignature(BODY, signed(BODY, t, 'whsec_other'), SECRET, NOW)
    expect(outcome).toMatchObject({ ok: false, reason: 'signature_mismatch' })
  })

  it('honors a per-call tolerance — an older request passes a wider window', () => {
    const t = Math.floor(NOW.getTime() / 1000) - 600
    expect(verifyWebhookSignature(BODY, signed(BODY, t), SECRET, NOW)).toMatchObject({
      ok: false,
      reason: 'timestamp_out_of_tolerance',
    })
    expect(verifyWebhookSignature(BODY, signed(BODY, t), SECRET, NOW, 700).ok).toBe(true)
  })
})
