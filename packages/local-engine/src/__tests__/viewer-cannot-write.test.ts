// ============================================
// The device refuses a read-only member on EVERY write route, and its capability table agrees with the server's.
//
// Server: `requireCapability('invoice.create')` etc. refuse a viewer at the route. The device had no seller-level
// capabilities at all, so 21 of its 91 write routes answered a viewer — creating invoices, payments, customers, till
// sessions — and the server then refused the same command on sync, after it had changed the device's own books.
//
// The device's check is a convenience (the server stays the authority), but a convenience that lets a viewer move
// stock and money locally is not one. Two guards:
//   1. every write route in the table refuses a viewer with 403, except a closed list that says why
//   2. every capability the device names that the server also names needs the SAME lowest role
// ============================================

import { describe, expect, it } from 'vitest'
import {
  minRoleFor,
  type Capability,
} from '../../../../backend/src/services/authorization/authorization.domain'
import { requireCapability } from '../auth'
import { createLocalEngine } from '../index'
import type { LocalContext, WorkspaceRole } from '../types'
import { createTestDb, TEST_USER_ID, TEST_WORKSPACE_ID } from './test-db'

const ID = '33333333-3333-4333-8333-333333333333'

/** Writes a viewer may do, and why. A route joins this list only with a reason that is not «it was inconvenient». */
const VIEWER_MAY: Readonly<Record<string, string>> = {
  'PATCH /auth/profile': 'the member edits their OWN profile',
  'PATCH /v1/activities/mark-read': "marks the member's OWN feed as read (per-person state)",
  'PATCH /v1/activities/mark-all-read': "marks the member's OWN feed as read (per-person state)",
  'PATCH /v1/notifications/mark-read': "marks the member's OWN notifications as read",
  'PATCH /v1/notifications/mark-all-read': "marks the member's OWN notifications as read",
  'DELETE /invoices/:id/projection':
    'internal reconciliation after the server accepted a row; writes no document',
  'POST /migrations/inspect': 'reads a file and writes nothing (the commit is guarded)',
  'POST /operations/budgets/check': 'a calculation; writes nothing',
  'POST /tax/preview': 'a calculation; writes nothing',
}

const keyOf = (route: { method: string; path: string }) => `${route.method} ${route.path}`

describe('a viewer on the device', () => {
  const table = createLocalEngine(createTestDb())
    .routeTable()
    .filter((route) => route.method !== 'GET')

  it('has a route table to check', () => {
    expect(table.length).toBeGreaterThan(80)
  })

  it('every entry of the closed list is a real write route', () => {
    const present = new Set(table.map(keyOf))
    for (const entry of Object.keys(VIEWER_MAY)) expect(present, entry).toContain(entry)
  })

  it('is refused (403) on every other write route, whatever the body', async () => {
    const offenders: string[] = []
    for (const route of table) {
      if (keyOf(route) in VIEWER_MAY) continue
      const db = createTestDb()
      db.run(`UPDATE local_user SET role = 'viewer'`)
      const res = await createLocalEngine(db).request({
        method: route.method as 'POST',
        path: route.path.replace(/:[a-zA-Z0-9_]+/g, ID),
        headers: { 'x-workspace-id': TEST_WORKSPACE_ID, 'x-user-id': TEST_USER_ID },
        body: {},
      })
      if (res.status !== 403) offenders.push(`${res.status} ${keyOf(route)}`)
    }
    expect(offenders, 'a viewer reached these write routes').toEqual([])
  })
})

describe('the device and the server name the same lowest role', () => {
  const LOCAL_ROLES: ReadonlyArray<[WorkspaceRole, 'seller' | 'manager' | 'owner']> = [
    ['viewer', 'seller'],
    ['seller', 'seller'],
    ['manager', 'manager'],
    ['owner', 'owner'],
  ]
  const SHARED = [
    'invoice.create',
    'invoice.update',
    'invoice.delete',
    'payment.record',
    'payment.cancel',
    'customer.write',
    'product.write',
    'ledger.post',
    'ledger.reverse',
    'ledger.lock_period',
    'inventory.configure',
    'workspace.manage',
    'member.manage',
    'payroll.write',
    'employee.write',
    'leave.write',
    'budget.manage',
    'data.import',
    'account.manage',
  ] as const

  const ctxOf = (role: WorkspaceRole): LocalContext => ({
    workspaceId: TEST_WORKSPACE_ID,
    userId: TEST_USER_ID,
    role,
    baseCurrency: 'AFN',
    timeZone: 'Asia/Kabul',
  })
  const rank = { seller: 1, manager: 2, owner: 3 } as const
  const allowed = (role: WorkspaceRole, capability: string) => {
    try {
      requireCapability(ctxOf(role), capability)
      return true
    } catch {
      return false
    }
  }

  for (const capability of SHARED) {
    it(`${capability}: the lowest role is the server's (${minRoleFor(capability as Capability)})`, () => {
      const lowest = minRoleFor(capability as Capability)
      // viewer never holds a write capability; the others hold it exactly from the server's lowest role up
      expect(allowed('viewer', capability)).toBe(false)
      for (const [role] of LOCAL_ROLES.filter(([name]) => name !== 'viewer')) {
        const held =
          rank[role === 'seller' ? 'seller' : role === 'manager' ? 'manager' : 'owner'] >=
          rank[lowest]
        expect(allowed(role, capability), `${role} on ${capability}`).toBe(held)
      }
    })
  }
})
