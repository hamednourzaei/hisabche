// ============================================
// backend/src/__tests__/offline-license-policy.test.ts
// E3 Licence Policy Integration Tests: Seats, Reinstall, Transfers, Two-Tier Enforcement, Ban Effects & Log Privacy
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import fastify, { FastifyInstance, FastifyRequest } from 'fastify'
import {
  generateOfflineLicenseKeyPair,
  resolveEntitlement,
  type FeatureKey,
} from '@hisabche/validation'
import { billingRoutes } from '../routes/billing.routes'
import { sanitizeLicenseLogEvidence } from '../services/offline-license.service'

const WS_ID = '11111111-1111-1111-1111-111111111111'
const ADMIN_ID = '22222222-2222-2222-2222-222222222222'
const TEST_KEYPAIR = generateOfflineLicenseKeyPair()

interface MockState {
  subscription: { plan: string; status: string; period_end: string | null } | null
  licenses: Array<Record<string, unknown>>
  devices: Array<Record<string, unknown>>
  logs: Array<Record<string, unknown>>
  reviewQueue: Array<Record<string, unknown>>
  events: Array<Record<string, unknown>>
  currentUserRole: 'owner' | 'manager' | 'seller'
  /** Inserts the fake refused because the numbered place was already held. */
  slotConflicts: number
  currentUserId: string
}

const dbState: MockState = {
  subscription: { plan: 'OFFLINE', status: 'active', period_end: '2027-10-20T00:00:00.000Z' },
  licenses: [],
  devices: [],
  logs: [],
  reviewQueue: [],
  events: [],
  currentUserRole: 'owner',
  currentUserId: ADMIN_ID,
  slotConflicts: 0,
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => {
      // The signing key lives ONLY in this table (owner decision, 9 Nov 2026).
      if (table === 'offline_license_signing_keys') {
        return {
          select: () => ({
            is: () => ({
              maybeSingle: async () => ({
                data: {
                  key_id: 'v1',
                  private_key_hex: TEST_KEYPAIR.secretKeyHex,
                  public_key_hex: TEST_KEYPAIR.publicKeyHex,
                },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: dbState.subscription,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'offline_licenses') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            dbState.licenses.push({ ...payload })
            return { error: null }
          },
          update: (payload: Record<string, unknown>) => ({
            eq: (col1: string, val1: unknown) => ({
              eq: (col2: string, val2: unknown) => {
                const target = dbState.licenses.find((l) => l[col1] === val1 && l[col2] === val2)
                if (target) Object.assign(target, payload)
                return { error: null }
              },
              then: (resolve: (val: unknown) => void) => {
                const target = dbState.licenses.find((l) => l[col1] === val1)
                if (target) Object.assign(target, payload)
                return resolve({ error: null })
              },
            }),
          }),
          select: (_cols?: string) => ({
            eq: (col1: string, val1: unknown) => ({
              eq: (col2: string, val2: unknown) => ({
                maybeSingle: async () => {
                  const item = dbState.licenses.find((l) => l[col1] === val1 && l[col2] === val2)
                  return { data: item ?? null, error: null }
                },
              }),
              maybeSingle: async () => {
                const item = dbState.licenses.find((l) => l[col1] === val1)
                return { data: item ?? null, error: null }
              },
              order: () => ({
                data: dbState.licenses.filter((l) => l[col1] === val1),
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'devices') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            // Yield, so concurrent requests really interleave between their read and this write.
            await Promise.resolve()
            // devices_active_slot_uq: one ACTIVE device per numbered place (docs/device-slot-01-migration.sql).
            const taken = dbState.devices.some(
              (d) =>
                d.is_active === true &&
                payload.is_active === true &&
                payload.slot != null &&
                d.license_id === payload.license_id &&
                d.seat === payload.seat &&
                d.slot === payload.slot,
            )
            if (taken) {
              dbState.slotConflicts += 1
              return {
                error: {
                  code: '23505',
                  message:
                    'duplicate key value violates unique constraint "devices_active_slot_uq" (slot)',
                },
              }
            }
            dbState.devices.push({ ...payload })
            return { error: null }
          },
          upsert: async (payload: Record<string, unknown>) => {
            const existing = dbState.devices.find((d) => d.device_id === payload.device_id)
            if (existing) Object.assign(existing, payload)
            else dbState.devices.push({ ...payload })
            return {
              select: () => ({
                single: async () => ({ data: payload, error: null }),
              }),
              data: payload,
              error: null,
            }
          },
          update: (payload: Record<string, unknown>) => ({
            eq: (col1: string, val1: unknown) => {
              const matches = dbState.devices.filter((d) => d[col1] === val1)
              for (const m of matches) Object.assign(m, payload)
              return { error: null }
            },
          }),
          select: () => ({
            eq: (col1: string, val1: unknown) => ({
              eq: (col2: string, val2: unknown) => ({
                eq: (col3: string, val3: unknown) => {
                  const filtered = dbState.devices.filter(
                    (d) => d[col1] === val1 && d[col2] === val2 && d[col3] === val3,
                  )
                  // Answer after a real delay: every concurrent request READS before any of them
                  // WRITES, which is the interleaving a database race needs.
                  return new Promise((resolve) =>
                    setTimeout(() => resolve({ data: filtered, error: null }), 5),
                  )
                },
              }),
            }),
          }),
        }
      }
      if (table === 'license_logs') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            dbState.logs.push({ ...payload })
            return { error: null }
          },
          select: () => ({
            eq: (col1: string, val1: unknown) => ({
              order: () => ({
                data: dbState.logs.filter((l) => l[col1] === val1),
                error: null,
              }),
              eq: (col2: string, val2: unknown) => ({
                order: () => ({
                  data: dbState.logs.filter((l) => l[col1] === val1 && l[col2] === val2),
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'license_review_queue') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            dbState.reviewQueue.push({ ...payload })
            return { error: null }
          },
          select: () => ({
            eq: (col1: string, val1: unknown) => ({
              order: () => ({
                data: dbState.reviewQueue.filter((q) => q[col1] === val1),
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'subscription_events') {
        return {
          insert: async (payload: Record<string, unknown>) => {
            dbState.events.push({ ...payload })
            return { error: null }
          },
        }
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }
    },
  },
}))

vi.mock('../middleware/auth.middleware', () => ({
  authenticate: async (request: FastifyRequest & Record<string, unknown>) => {
    request.userId = dbState.currentUserId
  },
}))

vi.mock('../middleware/workspace.middleware', () => ({
  requireWorkspaceContext: async (request: FastifyRequest & Record<string, unknown>) => {
    request.tenancy = {
      workspaceId: WS_ID,
      role: dbState.currentUserRole,
      userId: dbState.currentUserId,
    }
  },
}))

describe('E3 Offline Licence Policy Integration', () => {
  let app: FastifyInstance
  const licenseId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

  beforeEach(async () => {
    dbState.subscription = {
      plan: 'OFFLINE',
      status: 'active',
      period_end: '2027-10-20T00:00:00.000Z',
    }
    dbState.licenses = [
      {
        license_id: licenseId,
        workspace_id: WS_ID,
        account_id: ADMIN_ID,
        plan: 'OFFLINE',
        status: 'active',
        banned_at: null,
        ban_reason: null,
        transfer_count: 0,
        transfer_year: new Date().getFullYear(),
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
        features: ['invoice.create', 'reports.view'],
        version: 1,
        revoked_at: null,
      },
    ]
    dbState.devices = []
    dbState.logs = []
    dbState.reviewQueue = []
    dbState.events = []
    dbState.currentUserRole = 'owner'
    dbState.currentUserId = ADMIN_ID
    dbState.slotConflicts = 0

    app = fastify()
    await app.register(billingRoutes)
    await app.ready()
  })

  // ─── 1. SEATS: 2 COMPUTERS + 2 MOBILES (windows, mac, android, ios) ──
  it('allows two computers and two mobiles concurrently — four devices', async () => {
    // Activate 1st computer
    const compRes = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-stable-01',
        devicePublicKey: 'pk-pc-01',
        label: 'Shop Counter PC',
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(compRes.statusCode).toBe(200)
    expect(compRes.json().success).toBe(true)
    expect(compRes.json().seat).toBe('computer')
    expect(compRes.json().isReinstall).toBe(false)
    expect(compRes.json().isTransfer).toBe(false)

    // Activate 1st mobile (e.g. tablet/phone)
    const mobileRes = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'mobile',
        stableId: 'mobile-stable-01',
        devicePublicKey: 'pk-mob-01',
        label: 'Warehouse Mobile',
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(mobileRes.statusCode).toBe(200)
    expect(mobileRes.json().success).toBe(true)
    expect(mobileRes.json().seat).toBe('mobile')

    // The second computer (Mac next to Windows) and the second mobile (iOS next to Android)
    const secondComputer = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-stable-02',
        devicePublicKey: 'pk-pc-stable-02',
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    const secondMobile = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'mobile',
        stableId: 'mobile-stable-02',
        devicePublicKey: 'pk-mobile-stable-02',
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(secondComputer.statusCode).toBe(200)
    expect(secondMobile.statusCode).toBe(200)

    const activeSeats = dbState.devices.filter((d) => d.is_active)
    expect(activeSeats).toHaveLength(4)
  })

  it('refuses a 3rd computer with LICENSE_SEATS_FULL (HTTP 409)', async () => {
    // Occupy both computer places
    await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-stable-01',
        devicePublicKey: 'pk-pc-stable-01',
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-stable-02',
        devicePublicKey: 'pk-pc-stable-02',
      },
      headers: { 'x-workspace-id': WS_ID },
    })

    // Attempt a 3rd computer with a different device
    const secondComp = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-stable-03',
        devicePublicKey: 'pk-pc-03',
      },
      headers: { 'x-workspace-id': WS_ID },
    })

    expect(secondComp.statusCode).toBe(409)
    const body = secondComp.json()
    expect(body.code).toBe('LICENSE_SEATS_FULL')
    // Rejected activation event logged
    expect(
      dbState.logs.some(
        (l) => l.event === 'rejected_activation' && l.reason === 'LICENSE_SEATS_FULL',
      ),
    ).toBe(true)
  })

  it('refuses a 3rd mobile with LICENSE_SEATS_FULL (HTTP 409)', async () => {
    // Occupy both mobile places
    await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'mobile',
        stableId: 'mob-stable-01',
        devicePublicKey: 'pk-mob-stable-01',
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'mobile',
        stableId: 'mob-stable-02',
        devicePublicKey: 'pk-mob-stable-02',
      },
      headers: { 'x-workspace-id': WS_ID },
    })

    // Attempt a 3rd mobile with a different device
    const secondMob = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'mobile',
        stableId: 'mob-stable-03',
        devicePublicKey: 'pk-mob-03',
      },
      headers: { 'x-workspace-id': WS_ID },
    })

    expect(secondMob.statusCode).toBe(409)
    expect(secondMob.json().code).toBe('LICENSE_SEATS_FULL')
  })

  // ─── 1b. THE CAP HOLDS UNDER CONCURRENCY (25C) ───────────────────
  const activate = (seat: 'computer' | 'mobile', id: string) =>
    app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: { licenseId, seat, stableId: id, devicePublicKey: 'pk-' + id },
      headers: { 'x-workspace-id': WS_ID },
    })

  it('five devices activating at the same moment get four places, never five', async () => {
    const results = await Promise.all([
      activate('computer', 'pc-a'),
      activate('computer', 'pc-b'),
      activate('computer', 'pc-c'),
      activate('mobile', 'mob-a'),
      activate('mobile', 'mob-b'),
      activate('mobile', 'mob-c'),
    ])
    const codes = results.map((r) => r.statusCode).sort()
    expect(codes).toEqual([200, 200, 200, 200, 409, 409])
    expect(
      results
        .filter((r) => r.statusCode === 409)
        .every((r) => r.json().code === 'LICENSE_SEATS_FULL'),
    ).toBe(true)

    const active = dbState.devices.filter((d) => d.is_active)
    expect(active).toHaveLength(4)
    for (const seat of ['computer', 'mobile']) {
      const places = active
        .filter((d) => d.seat === seat)
        .map((d) => d.slot)
        .sort()
      expect(places).toEqual([1, 2])
    }
    // The race really happened: at least one insert lost to the unique index.
    expect(dbState.slotConflicts).toBeGreaterThan(0)
  })

  it('the same device asking twice at once is one device, not two', async () => {
    const [a, b] = await Promise.all([
      activate('computer', 'pc-twice'),
      activate('computer', 'pc-twice'),
    ])
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(dbState.devices.filter((d) => d.is_active && d.stable_id === 'pc-twice')).toHaveLength(1)
  })

  // ─── 2. REINSTALL ON SAME DEVICE: FREE FOREVER ──────────────────
  it('allows reinstall on the same device free forever (stable-id match) without transfer count', async () => {
    // First activation
    await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-stable-01',
        devicePublicKey: 'pk-pc-old',
        label: 'Desktop Office',
      },
      headers: { 'x-workspace-id': WS_ID },
    })

    // Reinstall: same stableId, new device key
    const reinstallRes = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-stable-01',
        devicePublicKey: 'pk-pc-new-key',
        label: 'Desktop Office Reinstalled',
      },
      headers: { 'x-workspace-id': WS_ID },
    })

    expect(reinstallRes.statusCode).toBe(200)
    const body = reinstallRes.json()
    expect(body.isReinstall).toBe(true)
    expect(body.isTransfer).toBe(false)

    // Licence transfer count remains 0
    const lic = dbState.licenses.find((l) => l.license_id === licenseId)
    expect(lic?.transfer_count).toBe(0)

    // Reinstall event logged
    expect(
      dbState.logs.some((l) => l.event === 'reinstall' && l.stable_id === 'pc-stable-01'),
    ).toBe(true)
  })

  // ─── 3. TRANSFERS: 3 PER YEAR & ADMIN OVERRIDE ───────────────────
  it('allows up to 3 transfers per calendar year and enforces 4th transfer refusal', async () => {
    // Initial activation: both computer places are taken, so a new device is a TRANSFER
    await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: { licenseId, seat: 'computer', stableId: 'pc-0', devicePublicKey: 'pk-pc-0' },
      headers: { 'x-workspace-id': WS_ID },
    })
    await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: { licenseId, seat: 'computer', stableId: 'pc-00', devicePublicKey: 'pk-pc-00' },
      headers: { 'x-workspace-id': WS_ID },
    })

    // 1st transfer
    const t1 = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-1',
        devicePublicKey: 'pk-1',
        allowTransfer: true,
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(t1.statusCode).toBe(200)
    expect(t1.json().isTransfer).toBe(true)

    // 2nd transfer
    const t2 = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-2',
        devicePublicKey: 'pk-2',
        allowTransfer: true,
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(t2.statusCode).toBe(200)

    // 3rd transfer
    const t3 = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-3',
        devicePublicKey: 'pk-3',
        allowTransfer: true,
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(t3.statusCode).toBe(200)

    // 4th transfer without admin override -> refused!
    const t4Refused = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-4',
        devicePublicKey: 'pk-4',
        allowTransfer: true,
        adminOverride: false,
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(t4Refused.statusCode).toBe(409)
    expect(t4Refused.json().code).toBe('LICENSE_TRANSFERS_EXCEEDED')

    // The OWNER asking for an override is still refused — the owner is the customer.
    const t4Allowed = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: {
        licenseId,
        seat: 'computer',
        stableId: 'pc-4',
        devicePublicKey: 'pk-4',
        allowTransfer: true,
        adminOverride: true,
      },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(t4Allowed.statusCode).toBe(409)
    expect(t4Allowed.json().code).toBe('LICENSE_TRANSFERS_EXCEEDED')
  })

  // ─── 4. A DEVICE'S OWN «TIER-1» REPORT IS A CLAIM, NOT A BAN ──────
  it('a device self-report goes to the review queue and does NOT ban the licence', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/activate-seat',
      payload: { licenseId, seat: 'computer', stableId: 'pc-01', devicePublicKey: 'pk-01' },
      headers: { 'x-workspace-id': WS_ID },
    })
    const queuedBefore = dbState.reviewQueue.length

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/tier1-report',
      payload: {
        licenseId,
        violation: 'unregistered_device_key',
        evidence: { key_hash: 'sha256:abc123456789', client_platform: 'windows' },
        deviceSeat: 'computer',
        stableId: 'pc-01',
      },
      headers: { 'x-workspace-id': WS_ID },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ queued: true, signalType: 'device_self_report' })
    expect(dbState.reviewQueue.length).toBe(queuedBefore + 1)

    // The licence is untouched: any member could otherwise ban their own shop.
    const lic = dbState.licenses.find((l) => l.license_id === licenseId)
    expect(lic?.status).toBe('active')
    expect(dbState.logs.some((l) => l.event === 'ban')).toBe(false)
    expect(dbState.devices.some((d) => d.is_active === true)).toBe(true)
  })

  it('an unknown violation name is refused', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/tier1-report',
      payload: { licenseId, violation: 'admin_confirmed_review' },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(res.statusCode).toBe(400)
  })

  // ─── 5. TIER 2 ENFORCEMENT: HEURISTIC SIGNALS → QUEUED NOT BANNED ─
  it('tier-2 heuristic signals are enqueued for review and NEVER auto-ban', async () => {
    const reportRes = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/tier2-report',
      payload: {
        licenseId,
        signalType: 'two_business_identities',
        details: {
          detected_names: ['Shop A', 'Shop B'],
          client_ip: '192.168.1.1',
        },
        deviceSeat: 'computer',
        stableId: 'pc-01',
      },
      headers: { 'x-workspace-id': WS_ID },
    })

    expect(reportRes.statusCode).toBe(200)
    expect(reportRes.json().queued).toBe(true)
    expect(reportRes.json().status).toBe('pending')

    // Licence is NOT banned
    const lic = dbState.licenses.find((l) => l.license_id === licenseId)
    expect(lic?.status).toBe('active')
    expect(lic?.banned_at).toBeNull()

    // Item exists in review queue
    expect(
      dbState.reviewQueue.some(
        (q) => q.signal_type === 'two_business_identities' && q.status === 'pending',
      ),
    ).toBe(true)

    // Event logged as tier2_flagged, not ban
    expect(dbState.logs.some((l) => l.event === 'tier2_flagged')).toBe(true)
    expect(dbState.logs.some((l) => l.event === 'ban')).toBe(false)
  })

  // ─── 6. ONLY A HISABCHE ADMIN LIFTS A BAN ────────────────────────
  it('no customer route lifts a ban — not even the workspace owner', async () => {
    // The old route let the workspace OWNER (the customer) unban their own
    // licence. Lifting a ban is POST /api/admin/offline/bans/:id/lift only.
    const lic = dbState.licenses.find((l) => l.license_id === licenseId)
    if (lic) {
      lic.status = 'banned'
      lic.banned_at = new Date().toISOString()
      lic.ban_reason = 'invalid_signature'
    }
    dbState.currentUserRole = 'owner'
    dbState.currentUserId = ADMIN_ID

    const ownerUnban = await app.inject({
      method: 'POST',
      url: `/api/billing/offline-license/${licenseId}/unban`,
      payload: { reason: 'Please unban' },
      headers: { 'x-workspace-id': WS_ID },
    })
    expect(ownerUnban.statusCode).toBe(404)
    expect(lic?.status).toBe('banned')
  })

  // ─── 7. BAN EFFECT & DATA EXPORT PRESERVATION ────────────────────
  it('banned licence stops operational writes but ALWAYS preserves read, print, backup and export', () => {
    // Entitlement resolver for OFFLINE_BANNED
    const writes: FeatureKey[] = [
      'invoice.create',
      'stock.transfer',
      'customer.upsert',
      'payment.record',
    ]
    for (const action of writes) {
      const decision = resolveEntitlement(
        { state: 'OFFLINE_BANNED', plan: 'OFFLINE', edition: 'local' },
        action,
      )
      expect(decision.kind).toBe('NOT_ENTITLED')
    }

    // Always allowed features: export, print, backup, reports
    const preserved: FeatureKey[] = [
      'data.backup',
      'invoice.print',
      'invoice.detail',
      'accounting.reports',
    ]
    for (const action of preserved) {
      const decision = resolveEntitlement(
        { state: 'OFFLINE_BANNED', plan: 'OFFLINE', edition: 'local' },
        action,
      )
      expect(decision.kind).toBe('AVAILABLE')
    }
  })

  it('heartbeat /connect informs device of ban status upon next connection', async () => {
    const lic = dbState.licenses.find((l) => l.license_id === licenseId)
    if (lic) {
      lic.status = 'banned'
      lic.banned_at = '2026-10-20T12:00:00.000Z'
      lic.ban_reason = 'tampered_app_integrity'
    }

    const devId = '99999999-9999-9999-9999-999999999999'
    dbState.devices.push({ device_id: devId, workspace_id: WS_ID, license_id: licenseId })

    const connRes = await app.inject({
      method: 'POST',
      url: '/api/billing/offline-license/connect',
      payload: { licenseId, deviceId: devId },
      headers: { 'x-workspace-id': WS_ID },
    })

    expect(connRes.statusCode).toBe(200)
    const body = connRes.json()
    expect(body.status).toBe('banned')
    expect(body.banned_at).toBe('2026-10-20T12:00:00.000Z')
    expect(body.ban_reason).toBe('tampered_app_integrity')
  })

  // ─── 8. LICENCE LOG PRIVACY FILTER ──────────────────────────────
  it('licence log evidence sanitizer strictly strips invoices, customer names, and money amounts', () => {
    const rawEvidence = {
      client_platform: 'windows',
      integrity_hash: 'abc987654321',
      invoice_id: 'inv-sensitive-1234',
      customer_name: 'Haji Ahmad',
      total_amount: 50000000,
      item_price: 250000,
      money_paid: 100000,
      monthly_revenue: 900000000,
      customer_debt: 4000000,
      network_ip: '10.0.0.1',
    }

    const sanitized = sanitizeLicenseLogEvidence(rawEvidence)
    expect(sanitized).toBeDefined()
    expect(sanitized?.client_platform).toBe('windows')
    expect(sanitized?.integrity_hash).toBe('abc987654321')
    expect(sanitized?.network_ip).toBe('10.0.0.1')

    // Absolutely NO invoices, customer names or amounts
    expect(sanitized?.invoice_id).toBeUndefined()
    expect(sanitized?.customer_name).toBeUndefined()
    expect(sanitized?.total_amount).toBeUndefined()
    expect(sanitized?.item_price).toBeUndefined()
    expect(sanitized?.money_paid).toBeUndefined()
    expect(sanitized?.monthly_revenue).toBeUndefined()
    expect(sanitized?.customer_debt).toBeUndefined()
  })
})
