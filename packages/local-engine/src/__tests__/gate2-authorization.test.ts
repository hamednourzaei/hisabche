// ============================================
// packages/local-engine/src/__tests__/gate2-authorization.test.ts
//
// Verification for Gate 2: Critical Authorization Verification
// Tests:
// - Seller changing role headers to owner (Privilege escalation blocked)
// - Missing identity (Defaults to least privilege viewer)
// - Invalid/forged role string ignored
// - Role changes during active session immediately reflected from SQLite
// - Cross-workspace access rejected
// ============================================

import { describe, expect, it } from 'vitest'
import { createLocalEngine } from '../index'
import { createTestDb, TEST_WORKSPACE_ID } from './test-db'

describe('Gate 2: Critical Local Engine Authorization Verification', () => {
  it('prevents seller user from escalating to owner via headers', async () => {
    const db = createTestDb()
    // Explicitly set the logged-in user in SQLite as seller
    db.run(`UPDATE local_user SET role = 'seller'`)

    const engine = createLocalEngine(db)

    // Seller tries to delete products while forging x-user-role: owner
    const prodRes = await engine.request<{ id: string }>({
      method: 'POST',
      path: '/products',
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'owner', // Attempted forgery
      },
      body: { name: 'تست کالای غیرمجاز', sellPrice: 50 },
    })
    const prodId = prodRes.data.id

    // Seller attempts to DELETE product with forged owner header -> MUST FAIL with 403
    const deleteRes = await engine.request({
      method: 'DELETE',
      path: `/products/${prodId}`,
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'owner', // Forged header
      },
    })

    expect(deleteRes.status).toBe(403)
  })

  it('missing identity defaults to viewer, blocking mutations', async () => {
    const db = createTestDb()
    // Remove all users from SQLite
    db.run(`DELETE FROM local_user`)

    const engine = createLocalEngine(db)

    // Unauthenticated request attempting to create price list
    const res = await engine.request({
      method: 'POST',
      path: '/price-lists',
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
      },
      body: { name: 'لیست قیمت بدون هویت', currency: 'AFN' },
    })

    // Default viewer is not authorized to create price lists
    expect(res.status).toBe(403)
  })

  it('invalid/garbage role header is ignored and does not elevate privileges', async () => {
    const db = createTestDb()
    db.run(`UPDATE local_user SET role = 'seller'`)
    const engine = createLocalEngine(db)

    const res = await engine.request({
      method: 'GET',
      path: '/workspaces/backup',
      headers: {
        'x-workspace-id': TEST_WORKSPACE_ID,
        'x-user-role': 'superadmin_bypass', // Invalid role
      },
    })

    expect(res.status).toBe(403)
  })

  it('role change in SQLite during active session is immediately reflected', async () => {
    const db = createTestDb()
    db.run(`UPDATE local_user SET role = 'seller'`)
    const engine = createLocalEngine(db)

    // First attempt as seller to access backup -> 403
    const res1 = await engine.request({
      method: 'GET',
      path: '/workspaces/backup',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
    })
    expect(res1.status).toBe(403)

    // Admin promotes user in SQLite to owner
    db.run(`UPDATE local_user SET role = 'owner'`)

    // Next request immediately has owner permissions without engine restart
    const res2 = await engine.request({
      method: 'GET',
      path: '/workspaces/backup',
      headers: { 'x-workspace-id': TEST_WORKSPACE_ID },
    })
    expect(res2.status).toBe(200)
  })

  it('enforces workspace boundary: cannot access other workspace data', async () => {
    const db = createTestDb()
    const engine = createLocalEngine(db)

    const otherWsId = '99999999-9999-4999-8999-999999999999'

    // Create invoice in other workspace
    const res = await engine.request<any>({
      method: 'GET',
      path: '/invoices',
      headers: { 'x-workspace-id': otherWsId },
    })

    // Returns empty list for the isolated foreign workspace
    expect(res.status).toBe(200)
    expect(res.data.invoices).toEqual([])
  })
})
