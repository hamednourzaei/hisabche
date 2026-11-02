// ============================================
// packages/local-engine/src/__tests__/service-delivery.test.ts
//
// M4 — SERVICE DELIVERY & ATTENDANCE CORE
// Integration tests for Service Delivery & Attendance in Local Engine (SQLite)
// ============================================

import { describe, expect, it } from 'vitest'
import { createTestDb, createTestEngine, TEST_WORKSPACE_ID, TEST_USER_ID } from './test-db'
import type { ServiceDeliverySession } from '@hisabche/validation'

describe('M4: Service Delivery & Attendance Local Engine Integration', () => {
  const ws1 = TEST_WORKSPACE_ID
  const user1 = TEST_USER_ID
  const custId = '44444444-4444-4444-8444-444444444444'
  const serviceOfferingId = '55555555-5555-4555-8555-555555555555'
  const pkgProductId = '66666666-6666-4666-8666-666666666666'
  const practitionerId = '77777777-7777-4777-8777-777777777777'

  function setupEngine() {
    const db = createTestDb()
    const engine = createTestEngine(db)

    // Seed Customer
    db.run(
      `INSERT OR REPLACE INTO customer (id, workspace_id, full_name, phone, created_at, updated_at)
       VALUES (?, ?, 'Zahra Moradi', '0799887766', '2026-11-01', '2026-11-01')`,
      [custId, ws1],
    )

    // Seed Service Offering (Offering Type = 'service')
    db.run(
      `INSERT OR REPLACE INTO product (
        id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at
      ) VALUES (
        ?, ?, 'Physiotherapy Session', 0, 1500, 0, 1, 'service', '2026-11-01'
      )`,
      [serviceOfferingId, ws1],
    )

    // Seed Package Product (Offering Type = 'package')
    db.run(
      `INSERT OR REPLACE INTO product (
        id, workspace_id, name, buy_price, sell_price, quantity, is_active, offering_type, updated_at
      ) VALUES (
        ?, ?, '10-Session Physio Package', 0, 12000, 0, 1, 'package', '2026-11-01'
      )`,
      [pkgProductId, ws1],
    )

    // Seed Practitioner Employee
    db.run(
      `INSERT OR REPLACE INTO employee (
        id, workspace_id, full_name, phone, role, is_active, created_at, updated_at
      ) VALUES (
        ?, ?, 'Dr. Ahmad', '0700112233', 'Physiotherapist', 1, '2026-11-01', '2026-11-01'
      )`,
      [practitionerId, ws1],
    )

    const headers = {
      'x-workspace-id': ws1,
      'x-user-id': user1,
      'x-user-role': 'owner',
    }

    return { db, engine, headers }
  }

  it('1. schedules a service delivery session and queries it', async () => {
    const { engine, headers } = setupEngine()

    const createRes = await engine.request<ServiceDeliverySession>({
      method: 'POST',
      path: '/service-delivery/sessions',
      body: {
        workspaceId: ws1,
        customerId: custId,
        serviceOfferingId,
        practitionerId,
        sessionDate: '2026-11-02',
        startTime: '10:00',
        endTime: '11:00',
        status: 'scheduled',
        settlementMethod: 'package_credit',
        clientNotes: 'Shoulder rehabilitation',
      },
      headers,
    })

    expect(createRes.status).toBe(201)
    expect(createRes.data.id).toBeDefined()
    expect(createRes.data.durationMinutes).toBe(60)
    expect(createRes.data.status).toBe('scheduled')

    // Query list
    const listRes = await engine.request<{ data: ServiceDeliverySession[] }>({
      method: 'GET',
      path: '/service-delivery/sessions',
      params: { sessionDate: '2026-11-02' },
      headers,
    })

    expect(listRes.status).toBe(200)
    expect(listRes.data.data.length).toBe(1)
    expect(listRes.data.data[0]?.customerId).toBe(custId)
  })

  it('2. delivers session with package credit redemption when customer has balance', async () => {
    const { db, engine, headers } = setupEngine()

    // Grant 5 credits to customer
    db.run(
      `INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity, effective_date, created_at, updated_at
      ) VALUES (
        'grant-1', ?, ?, ?, 'GRANT', 5, '2026-11-01', '2026-11-01', '2026-11-01'
      )`,
      [ws1, custId, pkgProductId],
    )

    // Create session
    const createRes = await engine.request<ServiceDeliverySession>({
      method: 'POST',
      path: '/service-delivery/sessions',
      body: {
        workspaceId: ws1,
        customerId: custId,
        serviceOfferingId,
        sessionDate: '2026-11-02',
        startTime: '14:00',
        endTime: '15:30',
        settlementMethod: 'package_credit',
      },
      headers,
    })

    const sessionId = createRes.data.id

    // Deliver session
    const deliverRes = await engine.request<{
      session: ServiceDeliverySession
      consumptionEntry: { entryType: string; quantity: number } | null
    }>({
      method: 'POST',
      path: `/service-delivery/sessions/${sessionId}/deliver`,
      body: {
        packageProductId: pkgProductId,
        settlementMethod: 'package_credit',
      },
      headers,
    })

    expect(deliverRes.status).toBe(200)
    expect(deliverRes.data.session.status).toBe('delivered')
    expect(deliverRes.data.session.settlementMethod).toBe('package_credit')
    expect(deliverRes.data.session.packageCreditId).toBeDefined()
    expect(deliverRes.data.consumptionEntry?.entryType).toBe('CONSUME')
    expect(deliverRes.data.consumptionEntry?.quantity).toBe(1)

    // Verify package balance is now 5 - 1 = 4
    const balRes = await engine.request<{ balance: number }>({
      method: 'GET',
      path: '/package-credits/balance',
      params: { customerId: custId, packageProductId: pkgProductId },
      headers,
    })
    expect(balRes.data.balance).toBe(4)
  })

  it('3. REFUSES delivery when the customer has 0 package credits - it no longer falls back to an unbilled invoice', async () => {
    const { db, engine, headers } = setupEngine()

    const createRes = await engine.request<ServiceDeliverySession>({
      method: 'POST',
      path: '/service-delivery/sessions',
      body: {
        workspaceId: ws1,
        customerId: custId,
        serviceOfferingId,
        sessionDate: '2026-11-02',
        startTime: '09:00',
        endTime: '09:45',
        settlementMethod: 'package_credit',
      },
      headers,
    })

    const sessionId = createRes.data.id

    const deliverRes = await engine.request<{ message?: string; error?: string }>({
      method: 'POST',
      path: `/service-delivery/sessions/${sessionId}/deliver`,
      body: {
        packageProductId: pkgProductId,
      },
      headers,
    })

    expect(deliverRes.status).toBe(409)
    expect(JSON.stringify(deliverRes.data)).toContain('INSUFFICIENT_PACKAGE_CREDIT')
    const row = db.get<{ status: string }>(
      'SELECT status FROM service_delivery_sessions WHERE id = ?',
      [sessionId],
    )
    expect(row?.status).toBe('scheduled')
  })

  it('4. cancels delivered session and reverses package credit', async () => {
    const { db, engine, headers } = setupEngine()

    // Grant 10 credits
    db.run(
      `INSERT INTO package_credit_ledger (
        id, workspace_id, customer_id, package_product_id, entry_type, quantity, effective_date, created_at, updated_at
      ) VALUES (
        'grant-1', ?, ?, ?, 'GRANT', 10, '2026-11-01', '2026-11-01', '2026-11-01'
      )`,
      [ws1, custId, pkgProductId],
    )

    // Create & deliver session
    const createRes = await engine.request<ServiceDeliverySession>({
      method: 'POST',
      path: '/service-delivery/sessions',
      body: {
        workspaceId: ws1,
        customerId: custId,
        serviceOfferingId,
        sessionDate: '2026-11-02',
        startTime: '10:00',
        endTime: '11:00',
        settlementMethod: 'package_credit',
      },
      headers,
    })

    const sessionId = createRes.data.id

    await engine.request({
      method: 'POST',
      path: `/service-delivery/sessions/${sessionId}/deliver`,
      body: { packageProductId: pkgProductId },
      headers,
    })

    // Balance after delivery = 9
    let balRes = await engine.request<{ balance: number }>({
      method: 'GET',
      path: '/package-credits/balance',
      params: { customerId: custId, packageProductId: pkgProductId },
      headers,
    })
    expect(balRes.data.balance).toBe(9)

    // Cancel delivered session
    const cancelRes = await engine.request<{
      session: ServiceDeliverySession
      reversalEntry: { entryType: string; quantity: number } | null
    }>({
      method: 'POST',
      path: `/service-delivery/sessions/${sessionId}/cancel`,
      headers,
      body: { reason: 'customer asked' },
    })

    expect(cancelRes.status).toBe(200)
    expect(cancelRes.data.session.status).toBe('cancelled')
    expect(cancelRes.data.reversalEntry?.entryType).toBe('REVERSAL')
    expect(cancelRes.data.reversalEntry?.quantity).toBe(1)

    // Balance restored back to 10
    balRes = await engine.request<{ balance: number }>({
      method: 'GET',
      path: '/package-credits/balance',
      params: { customerId: custId, packageProductId: pkgProductId },
      headers,
    })
    expect(balRes.data.balance).toBe(10)
  })

  it('5. fails delivery when assigned practitioner is marked absent in attendance', async () => {
    const { db, engine, headers } = setupEngine()

    // Mark practitioner as absent on that day in attendance table
    db.run(
      `INSERT INTO attendance (
        id, workspace_id, employee_id, date, status, created_at, updated_at
      ) VALUES (
        'att-1', ?, ?, '2026-11-02', 'absent', '2026-11-02', '2026-11-02'
      )`,
      [ws1, practitionerId],
    )

    // Schedule session with this practitioner
    const createRes = await engine.request<ServiceDeliverySession>({
      method: 'POST',
      path: '/service-delivery/sessions',
      body: {
        workspaceId: ws1,
        customerId: custId,
        serviceOfferingId,
        practitionerId,
        sessionDate: '2026-11-02',
        startTime: '10:00',
        endTime: '11:00',
        settlementMethod: 'package_credit',
      },
      headers,
    })

    const sessionId = createRes.data.id

    // Delivery must fail closed because practitioner was absent
    const failRes = await engine.request<{ message?: string; error?: string }>({
      method: 'POST',
      path: `/service-delivery/sessions/${sessionId}/deliver`,
      headers,
    })

    expect(failRes.status).toBe(400)
    expect(failRes.data.message || failRes.data.error).toContain(
      'PRACTITIONER_ABSENT_ON_SESSION_DATE',
    )
  })
})
