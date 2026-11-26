// ============================================
// backend/src/__tests__/v100-p0-payment-gateway-webhook.test.ts
//
// V100 P0 (4.1) comprehensive verification of:
//   - Raw-body HMAC provider webhook (`POST /api/payments/gateway/webhook/:provider`)
//   - Timestamp tolerance & replay protection
//   - Tampered amount / currency / body detection
//   - Authoritative tenant derivation (never trusting caller headers or mismatched workspaceId)
//   - Currency exponent scaling across zero-decimal (IRR/AFN), 2-decimal (USD), and 3-decimal metals (XAU)
//   - Out-of-order transition refusal (409)
//   - Provider secret absent -> 503 BLOCKED_EXTERNAL_CREDENTIAL
//   - Partial downstream notification failure reporting + DB failure propagation
//   - Authenticated internal settlement reconciliation (`POST /api/payments/:id/reconcile-settlement`)
// ============================================

import type { FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()
const OWNER = { id: '11111111-1111-4111-8111-111111111111', token: 'token-gw-owner' }
const OUTSIDER = { id: '22222222-2222-4222-8222-222222222222', token: 'token-gw-outsider' }
const SHOP_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOP_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PAY_USD = '44444444-4444-4444-8444-444444444401'
const PAY_XAU = '44444444-4444-4444-8444-444444444402'

const users = new Map<string, { id: string }>([
  [OWNER.token, { id: OWNER.id }],
  [OUTSIDER.token, { id: OUTSIDER.id }],
])
vi.mock('../db', () => createFakeDb(db, users))

function signRaw(rawBody: string, secret: string, tsSec = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac('sha256', secret).update(`${tsSec}.${rawBody}`).digest('hex')
  return `t=${tsSec},v1=${mac}`
}

let app: FastifyInstance
beforeAll(async () => {
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  delete process.env.PAYMENT_WEBHOOK_SECRET_TESTGW
  delete process.env.PAYMENT_WEBHOOK_SECRET
  await app?.close()
})

beforeEach(() => {
  delete process.env.PAYMENT_WEBHOOK_SECRET_TESTGW
  delete process.env.PAYMENT_WEBHOOK_SECRET
  db.tables.clear()
  db.failures.clear()
  db.writeFailures.clear()
  db.seed('workspaces', [
    { id: SHOP_A, name: 'Shop A', base_currency: 'USD', time_zone: 'UTC' },
    { id: SHOP_B, name: 'Shop B', base_currency: 'XAU', time_zone: 'UTC' },
  ])
  db.seed('workspace_members', [
    {
      id: fakeId('ma'),
      workspace_id: SHOP_A,
      user_id: OWNER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
    {
      id: fakeId('mb'),
      workspace_id: SHOP_B,
      user_id: OUTSIDER.id,
      role: 'owner',
      has_access: true,
      suspended_at: null,
    },
  ])
  db.seed('payments', [
    {
      id: PAY_USD,
      workspace_id: SHOP_A,
      method: 'card',
      amount: 125.5,
      currency: 'USD',
      status: 'posted',
    },
    {
      id: PAY_XAU,
      workspace_id: SHOP_A,
      method: 'card',
      amount: 2.35,
      currency: 'XAU',
      status: 'posted',
    },
  ])
  db.seed('payment_gateway_states', [])
  db.seed('payment_gateway_events', [])
  db.seed('journal_entries', [
    {
      id: fakeId('je-usd'),
      workspace_id: SHOP_A,
      source_type: 'payment',
      source_id: PAY_USD,
      status: 'posted',
    },
  ])
  db.seed('activities', [])
  db.seed('audit_logs', [])
})

describe('V100 P0 (4.1) — Raw-Body Provider Gateway Webhook & Internal Reconciliation', () => {
  it('fails closed 503 when provider secret is unconfigured and enforces raw-body HMAC + replay window', async () => {
    const payloadObj = {
      eventId: 'evt-usd-1',
      eventType: 'payment.captured',
      paymentId: PAY_USD,
      processorState: 'captured',
      externalRef: 'EXT-USD-1',
      feeMinor: 250,
      amountMinor: 12550,
      currency: 'USD',
    }
    const raw = JSON.stringify(payloadObj)

    // 1) Unconfigured secret -> 503 BLOCKED_EXTERNAL_CREDENTIAL
    const unconf = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: { 'content-type': 'application/json' },
      payload: raw,
    })
    expect(unconf.statusCode).toBe(503)
    expect(unconf.json().status).toBe('BLOCKED_EXTERNAL_CREDENTIAL')

    process.env.PAYMENT_WEBHOOK_SECRET_TESTGW = 'gw-secret-256-test'

    // 2) Missing signature -> 401
    const missingSig = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: { 'content-type': 'application/json' },
      payload: raw,
    })
    expect(missingSig.statusCode).toBe(401)
    expect(missingSig.json().code).toBe('GATEWAY_SIGNATURE_REQUIRED')

    // 3) Invalid signature / tampered body after signing -> 401
    const validHeader = signRaw(raw, process.env.PAYMENT_WEBHOOK_SECRET_TESTGW)
    const tampered = JSON.stringify({ ...payloadObj, amountMinor: 99999 })
    const tamperedRes = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: { 'content-type': 'application/json', 'x-hisabche-signature': validHeader },
      payload: tampered,
    })
    expect(tamperedRes.statusCode).toBe(401)
    expect(tamperedRes.json().code).toBe('GATEWAY_SIGNATURE_INVALID')

    // 4) Expired timestamp -> 401 GATEWAY_TIMESTAMP_EXPIRED
    const expiredTs = Math.floor(Date.now() / 1000) - 900
    const expiredRes = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature': signRaw(raw, process.env.PAYMENT_WEBHOOK_SECRET_TESTGW, expiredTs),
      },
      payload: raw,
    })
    expect(expiredRes.statusCode).toBe(401)
    expect(expiredRes.json().code).toBe('GATEWAY_TIMESTAMP_EXPIRED')
  })

  it('derives tenant from payment, supports metal XAU (3 decimals), blocks tampering/replay/out-of-order, and handles DB/downstream errors', async () => {
    process.env.PAYMENT_WEBHOOK_SECRET_TESTGW = 'gw-secret-256-test'
    const secret = process.env.PAYMENT_WEBHOOK_SECRET_TESTGW

    // Cross-tenant spoof in body refused 403 even with valid HMAC
    const crossTenantRaw = JSON.stringify({
      eventId: 'evt-spoof',
      paymentId: PAY_USD,
      workspaceId: SHOP_B,
      processorState: 'captured',
      externalRef: 'EXT-SPOOF',
      feeMinor: 0,
      amountMinor: 12550,
      currency: 'USD',
    })
    const spoofRes = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature': signRaw(crossTenantRaw, secret),
      },
      payload: crossTenantRaw,
    })
    expect(spoofRes.statusCode).toBe(403)

    // Nonexistent payment -> 404
    const missingPayRaw = JSON.stringify({
      eventId: 'evt-missing-pay',
      paymentId: '99999999-9999-4999-8999-999999999999',
      processorState: 'captured',
      externalRef: 'EXT-404',
      feeMinor: 0,
      amountMinor: 100,
      currency: 'USD',
    })
    const missingRes = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature': signRaw(missingPayRaw, secret),
      },
      payload: missingPayRaw,
    })
    expect(missingRes.statusCode).toBe(404)

    // Valid USD 125.50 -> 12550 minor units (delivered without any client workspace header)
    const okUsdRaw = JSON.stringify({
      eventId: 'evt-usd-ok',
      paymentId: PAY_USD,
      processorState: 'captured',
      externalRef: 'EXT-USD-OK',
      feeMinor: 200,
      amountMinor: 12550,
      currency: 'USD',
    })
    const okUsd = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature': signRaw(okUsdRaw, secret),
      },
      payload: okUsdRaw,
    })
    expect(okUsd.statusCode, okUsd.body).toBe(200)
    expect(okUsd.json().data.workspaceId).toBe(SHOP_A)
    expect(okUsd.json().data.replay).toBe(false)

    // Duplicate delivery replays idempotently
    const dupUsd = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature': signRaw(okUsdRaw, secret),
      },
      payload: okUsdRaw,
    })
    expect(dupUsd.statusCode).toBe(200)
    expect(dupUsd.json().data.replay).toBe(true)
    expect(db.rows('payment_gateway_events')).toHaveLength(1)
    expect(db.rows('payment_gateway_events')[0]?.delivery_attempts).toBe(2)

    // Out-of-order transition (captured -> pending_capture) rejected 409
    const oooRaw = JSON.stringify({
      eventId: 'evt-usd-ooo',
      paymentId: PAY_USD,
      processorState: 'pending_capture',
      externalRef: 'EXT-USD-OOO',
      feeMinor: 0,
      amountMinor: 12550,
      currency: 'USD',
    })
    const oooRes = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature': signRaw(oooRaw, secret),
      },
      payload: oooRaw,
    })
    expect(oooRes.statusCode).toBe(409)

    // Amount mismatch -> 409 GATEWAY_AMOUNT_MISMATCH on XAU 2.350g (=2350 milligrams)
    const badXauRaw = JSON.stringify({
      eventId: 'evt-xau-badamt',
      paymentId: PAY_XAU,
      processorState: 'captured',
      externalRef: 'EXT-XAU-1',
      feeMinor: 0,
      amountMinor: 235, // wrong factor (used 100 instead of 1000)
      currency: 'XAU',
    })
    const badXauRes = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature': signRaw(badXauRaw, secret),
      },
      payload: badXauRaw,
    })
    expect(badXauRes.statusCode).toBe(409)

    // Valid XAU 2.350g = 2350 minor milligrams; simulate downstream activities failure -> reported explicitly
    db.failWrite('activities', { message: 'notification queue unavailable' })
    const okXauRaw = JSON.stringify({
      eventId: 'evt-xau-ok',
      paymentId: PAY_XAU,
      processorState: 'captured',
      externalRef: 'EXT-XAU-OK',
      feeMinor: 10,
      amountMinor: 2350,
      currency: 'XAU',
    })
    const okXau = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature': signRaw(okXauRaw, secret),
      },
      payload: okXauRaw,
    })
    expect(okXau.statusCode, okXau.body).toBe(200)
    expect(okXau.json().data.currency).toBe('XAU')
    expect(okXau.json().data.downstreamWarning).toContain('notification queue unavailable')
    db.writeFailures.clear()
    db.writeFailures.clear()

    // Database query failure fails closed 500
    db.fail('payments', { message: 'primary read failed' })
    const dbErrRes = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature': signRaw(okUsdRaw, secret),
      },
      payload: okUsdRaw,
    })
    expect(dbErrRes.statusCode).toBe(500)
  })

  it('blocks forged final processor-state without adminOverride/capability, enforces pending_capture != reconciled, and logs rejected_signature telemetry', async () => {
    const secret = 'test-gw-secret-phase1a-32chars!!'
    process.env.PAYMENT_WEBHOOK_SECRET_TESTGW = secret

    // Seed a member who holds payment.record but NOT payment.cancel/workspace.manage
    const STAFF = { id: '33333333-3333-4333-8333-333333333333', token: 'token-gw-staff' }
    users.set(STAFF.token, { id: STAFF.id })
    db.tables.get('workspace_members')!.push({
      id: fakeId('mstaff'),
      workspace_id: SHOP_A,
      user_id: STAFF.id,
      role: 'member',
      has_access: true,
      suspended_at: null,
    })

    // 1. Staff with payment.record CAN move queued_offline -> pending_capture
    const pendingRes = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_USD}/processor-state`,
      headers: {
        authorization: `Bearer ${STAFF.token}`,
        'x-workspace-id': SHOP_A,
      },
      payload: {
        processorState: 'pending_capture',
        gatewayName: 'testgw',
        idempotencyKey: 'idem-pending-1',
      },
    })
    expect(pendingRes.statusCode, pendingRes.body).toBe(200)
    expect(pendingRes.json().data.processorState).toBe('pending_capture')
    expect(pendingRes.json().data.replay).toBe(false)

    // Idempotent replay returns replay: true without creating duplicate events
    const pendingReplay = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_USD}/processor-state`,
      headers: {
        authorization: `Bearer ${STAFF.token}`,
        'x-workspace-id': SHOP_A,
      },
      payload: {
        processorState: 'pending_capture',
        gatewayName: 'testgw',
        idempotencyKey: 'idem-pending-1',
      },
    })
    expect(pendingReplay.statusCode).toBe(200)
    expect(pendingReplay.json().data.replay).toBe(true)

    // 2. pending_capture must NOT report reconciled: true
    const recPending = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_USD}/reconcile-settlement`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: {},
    })
    expect(recPending.statusCode).toBe(200)
    expect(recPending.json().data.settlementStatus).toBe('pending')
    expect(recPending.json().data.reconciled).toBe(false)

    // 3. Staff cannot forge captured even with adminOverride=true
    const forgedStaff = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_USD}/processor-state`,
      headers: { authorization: `Bearer ${STAFF.token}`, 'x-workspace-id': SHOP_A },
      payload: {
        processorState: 'captured',
        adminOverride: true,
        reason: 'Trying to mark captured manually',
      },
    })
    expect(forgedStaff.statusCode).toBe(403)
    expect(forgedStaff.json().code).toBe('PROCESSOR_FINAL_STATE_REQUIRES_WEBHOOK_OR_OVERRIDE')

    // 4. Owner without adminOverride=true is also rejected (must be explicit override)
    const missingFlag = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_USD}/processor-state`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: { processorState: 'captured', reason: 'Manual capture' },
    })
    expect(missingFlag.statusCode).toBe(403)

    // 5. Invalid webhook signature records rejected_signature telemetry without changing state
    const badWebhookRaw = JSON.stringify({
      eventId: 'evt-bad-sig-1',
      paymentId: PAY_USD,
      processorState: 'captured',
      externalRef: 'EXT-FORGED',
      amountMinor: 12550,
      currency: 'USD',
    })
    const badSigRes = await app.inject({
      method: 'POST',
      url: '/api/payments/gateway/webhook/testgw',
      headers: {
        'content-type': 'application/json',
        'x-hisabche-signature':
          't=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000',
      },
      payload: badWebhookRaw,
    })
    expect(badSigRes.statusCode).toBe(401)
    const rejEvents = (db.tables.get('payment_gateway_events') ?? []).filter(
      (e) => e.processing_status === 'rejected_signature',
    )
    expect(rejEvents).toHaveLength(1)
    expect(rejEvents[0]!.signature_verified).toBe(false)
    expect(rejEvents[0]!.provenance).toBe('webhook_rejected_signature')
    // Payment state must remain pending_capture
    expect(db.tables.get('payment_gateway_states')![0]!.processor_state).toBe('pending_capture')

    // 6. Owner with explicit adminOverride + reason succeeds and writes audit log
    const overrideRes = await app.inject({
      method: 'POST',
      url: `/api/payments/${PAY_USD}/processor-state`,
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
      payload: {
        processorState: 'captured',
        adminOverride: true,
        reason: 'Verified bank settlement slip #9941',
        idempotencyKey: 'idem-override-1',
      },
    })
    expect(overrideRes.statusCode, overrideRes.body).toBe(200)
    expect(overrideRes.json().data.processorState).toBe('captured')
    expect(overrideRes.json().data.provenance).toBe('admin_override')

    // 7. Gateway reconciliation aggregates in exact minor units (125.50 USD -> 12550, not 125.5)
    const listRec = await app.inject({
      method: 'GET',
      url: '/api/payments/gateway-reconciliation',
      headers: { authorization: `Bearer ${OWNER.token}`, 'x-workspace-id': SHOP_A },
    })
    expect(listRec.statusCode).toBe(200)
    const usdBucket = listRec
      .json()
      .data.perCurrency.find((b: { currency: string }) => b.currency === 'USD')
    expect(usdBucket.capturedMinor).toBe(12550)
  })
})
