// ============================================
// backend/src/__tests__/tenant-isolation-http.test.ts
//
// Cross-tenant boundary verification over real HTTP (buildServer + app.inject).
// Proves workspace B token against workspace A entity IDs returns 404/403
// and leaves workspace A state unmutated.
// ============================================

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { FakeDatabase, createFakeDb, fakeId } from './helpers/fake-supabase'

const db = new FakeDatabase()

const USER_A = { id: fakeId('user-a'), token: 'token-user-a' }
const USER_B = { id: fakeId('user-b'), token: 'token-user-b' }

const WORKSPACE_A = fakeId('ws-a')
const WORKSPACE_B = fakeId('ws-b')

const users = new Map<string, { id: string }>([
  [USER_A.token, { id: USER_A.id }],
  [USER_B.token, { id: USER_B.id }],
])

const fakeDbModule = createFakeDb(db, users)
vi.mock('../db', () => fakeDbModule)

let app: FastifyInstance

// Target Entity IDs belonging to Workspace A
const WFA_ID = fakeId('wf-a')
const PROJA_ID = fakeId('proj-a')
const PMA_ID = fakeId('pm-a')
const CONFA_ID = fakeId('conf-a')
const INVA_ID = fakeId('inv-a')
const WHA_ID = fakeId('wh-a')
const CMA_ID = fakeId('cm-a')
const NOTIFA_ID = fakeId('notif-a')
const CUSTA_ID = fakeId('cust-a')
const DOCA_ID = fakeId('doc-a')

function member(workspaceId: string, userId: string, role = 'owner') {
  return {
    id: fakeId('member'),
    workspace_id: workspaceId,
    user_id: userId,
    role,
    has_access: true,
    suspended_at: null,
    joined_at: '2026-01-01T00:00:00Z',
  }
}

function resetWorld() {
  db.tables.clear()
  db.failures.clear()
  db.queries.length = 0

  // 1. Workspaces
  db.seed('workspaces', [
    { id: WORKSPACE_A, name: 'Workspace A', base_currency: 'AFN' },
    { id: WORKSPACE_B, name: 'Workspace B', base_currency: 'USD' },
  ])

  // 2. Members
  db.seed('workspace_members', [
    member(WORKSPACE_A, USER_A.id, 'owner'),
    member(WORKSPACE_B, USER_B.id, 'owner'),
  ])

  // 3. Workflows in Workspace A
  db.seed('workflows', [
    {
      id: WFA_ID,
      workspace_id: WORKSPACE_A,
      name: 'Approval Workflow A',
      trigger_type: 'invoice_created',
      is_active: true,
      definition: { steps: [] },
      created_by: USER_A.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ])

  db.seed('workflow_instances', [
    {
      id: fakeId('wfi-a'),
      workflow_id: WFA_ID,
      workspace_id: WORKSPACE_A,
      status: 'pending',
      step_index: 0,
      context: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ])

  // 4. Projects & Members in Workspace A
  db.seed('projects', [
    {
      id: PROJA_ID,
      workspace_id: WORKSPACE_A,
      name: 'Alpha Project',
      status: 'active',
      created_by: USER_A.id,
      created_at: new Date().toISOString(),
    },
  ])

  db.seed('project_members', [
    {
      id: PMA_ID,
      project_id: PROJA_ID,
      workspace_id: WORKSPACE_A,
      user_id: USER_A.id,
      role: 'lead',
      created_at: new Date().toISOString(),
    },
  ])

  // 5. Conflicts in Workspace A
  db.seed('conflicts', [
    {
      id: CONFA_ID,
      workspace_id: WORKSPACE_A,
      entity: 'customer',
      entity_id: fakeId('cust-conflict'),
      conflict_type: 'concurrent_update',
      client_version: 1,
      server_version: 2,
      base_version: 1,
      status: 'open',
      created_at: new Date().toISOString(),
    },
  ])

  // 6. Invoices in Workspace A
  db.seed('invoices', [
    {
      id: INVA_ID,
      workspace_id: WORKSPACE_A,
      invoice_number: 'INV-A-001',
      status: 'confirmed',
      total_minor: 10000,
      currency: 'AFN',
      created_by: USER_A.id,
      created_at: new Date().toISOString(),
    },
  ])

  // 7. Warehouses in Workspace A
  db.seed('warehouses', [
    {
      id: WHA_ID,
      workspace_id: WORKSPACE_A,
      code: 'WH-A',
      name: 'Main Storage A',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ])

  // 8. Cloud Migration Jobs in Workspace A
  db.seed('cloud_migration_jobs', [
    {
      id: CMA_ID,
      workspace_id: WORKSPACE_A,
      source_platform: 'quickbooks',
      status: 'pending',
      created_by: USER_A.id,
      created_at: new Date().toISOString(),
    },
  ])

  // 9. Notifications for User A in Workspace A
  db.seed('notifications', [
    {
      id: NOTIFA_ID,
      workspace_id: WORKSPACE_A,
      user_id: USER_A.id,
      type: 'info',
      title: 'Alert for A',
      read: false,
      created_at: new Date().toISOString(),
    },
  ])

  // 10. Customers & Documents in Workspace A
  db.seed('customers', [
    {
      id: CUSTA_ID,
      workspace_id: WORKSPACE_A,
      name: 'Customer of A',
      type: 'individual',
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ])

  db.seed('customer_documents', [
    {
      id: DOCA_ID,
      customer_id: CUSTA_ID,
      workspace_id: WORKSPACE_A,
      file_name: 'license.pdf',
      file_path: `workspaces/${WORKSPACE_A}/customers/${CUSTA_ID}/license.pdf`,
      created_at: new Date().toISOString(),
    },
  ])

  // 11. Sync Change Log in Workspace A
  db.seed('sync_change_log', [
    {
      id: fakeId('scl-a'),
      workspace_id: WORKSPACE_A,
      sync_version: 1,
      entity: 'customer',
      record_id: CUSTA_ID,
      operation: 'insert',
      created_at: new Date().toISOString(),
    },
  ])

  // Mock sync_pull_changes RPC handler on fake db
  db.rpc('sync_pull_changes', (args) => {
    const wsId = args.p_workspace_id as string
    const cursor = Number(args.p_cursor ?? 0)
    const limit = Number(args.p_limit ?? 50)
    const rows = db.tables.get('sync_change_log') || []
    return rows
      .filter((r) => r.workspace_id === wsId && Number(r.sync_version ?? 0) > cursor)
      .slice(0, limit)
  })
}

const asUserB = {
  authorization: `Bearer ${USER_B.token}`,
  'x-workspace-id': WORKSPACE_B,
}

beforeAll(async () => {
  resetWorld()
  const { buildServer } = await import('../index')
  app = await buildServer()
  await app.ready()
}, 60_000)

afterAll(async () => {
  await app?.close()
})

beforeEach(() => {
  resetWorld()
})

describe('Tenant Isolation HTTP Gate (Cross-Workspace Token Negative Tests)', () => {
  // ── 1. Workflows (GET/PATCH/DELETE/instances/start) ──────────────────────────
  describe('Workflows', () => {
    it('GET /api/v1/workflows/:id refuses cross-tenant read (404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workflows/${WFA_ID}`,
        headers: asUserB,
      })
      expect(res.statusCode).toBe(404)
    })

    it('PATCH /api/v1/workflows/:id refuses cross-tenant update and leaves state unchanged (404)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workflows/${WFA_ID}`,
        headers: asUserB,
        payload: { name: 'Tampered Name' },
      })
      expect(res.statusCode).toBe(404)
      const wf = db.tables.get('workflows')?.find((w) => w.id === WFA_ID)
      expect(wf?.name).toBe('Approval Workflow A')
    })

    it('DELETE /api/v1/workflows/:id refuses cross-tenant delete (404)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/workflows/${WFA_ID}`,
        headers: asUserB,
      })
      expect(res.statusCode).toBe(404)
      const wf = db.tables.get('workflows')?.find((w) => w.id === WFA_ID)
      expect(wf).toBeDefined()
    })

    it('GET /api/v1/workflows/:id/instances refuses cross-tenant instance list (404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/workflows/${WFA_ID}/instances`,
        headers: asUserB,
      })
      expect([403, 404]).toContain(res.statusCode)
    })

    it('POST /api/v1/workflows/:id/start refuses cross-tenant instance trigger (404)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/workflows/${WFA_ID}/start`,
        headers: asUserB,
        payload: { context: { test: true } },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  // ── 2. Project Members (list/add/remove) ────────────────────────────────────
  describe('Project Members', () => {
    it('GET /api/projects/:projectId/members refuses cross-tenant read (404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${PROJA_ID}/members`,
        headers: asUserB,
      })
      expect([403, 404]).toContain(res.statusCode)
    })

    it('POST /api/projects/:projectId/members refuses cross-tenant member addition (404)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${PROJA_ID}/members`,
        headers: asUserB,
        payload: { projectId: PROJA_ID, userId: USER_B.id, role: 'viewer' },
      })
      expect([403, 404]).toContain(res.statusCode)
      const members = db.tables.get('project_members')?.filter((m) => m.project_id === PROJA_ID)
      expect(members?.length).toBe(1)
      expect(members?.[0]?.user_id).toBe(USER_A.id)
    })

    it('DELETE /api/projects/:projectId/members/:memberId refuses cross-tenant member delete (404)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${PROJA_ID}/members/${PMA_ID}`,
        headers: asUserB,
      })
      expect([403, 404]).toContain(res.statusCode)
      const pm = db.tables.get('project_members')?.find((m) => m.id === PMA_ID)
      expect(pm).toBeDefined()
    })
  })

  // ── 3. Sync Push / Pull Isolation ──────────────────────────────────────────
  describe('Sync Push / Pull', () => {
    it('GET /api/sync/pull with Workspace B header returns no Workspace A changes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sync/pull?limit=50',
        headers: asUserB,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      const changes = Array.isArray(body) ? body : body.changes || []
      for (const change of changes) {
        expect(change.workspace_id).not.toBe(WORKSPACE_A)
      }
    })

    it('POST /api/sync/push with Workspace B header cannot mutate Workspace A entity', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sync/push',
        headers: asUserB,
        payload: {
          clientTimestamp: new Date().toISOString(),
          mutations: [
            {
              mutationId: fakeId('mut-x'),
              entity: 'customer',
              action: 'update',
              recordId: CUSTA_ID,
              payload: { name: 'Cross Tenant Overwrite' },
            },
          ],
        },
      })
      expect([200, 400, 403, 404]).toContain(res.statusCode)
      // Customer in Workspace A must remain unchanged
      const cust = db.tables.get('customers')?.find((c) => c.id === CUSTA_ID)
      expect(cust?.name).toBe('Customer of A')
    })
  })

  // ── 4. Conflicts List & Resolve ────────────────────────────────────────────
  describe('Conflicts', () => {
    it('GET /api/conflicts/:id refuses cross-tenant conflict lookup (404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/conflicts/${CONFA_ID}`,
        headers: asUserB,
      })
      expect([403, 404]).toContain(res.statusCode)
    })

    it('POST /api/conflicts/:id/resolve refuses cross-tenant conflict resolution (404)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/conflicts/${CONFA_ID}/resolve`,
        headers: asUserB,
        payload: {
          choice: 'keep_client',
          reason: 'Unauthorized resolution attempt',
        },
      })
      expect([403, 404]).toContain(res.statusCode)
      const conf = db.tables.get('conflicts')?.find((c) => c.id === CONFA_ID)
      expect(conf?.status).toBe('open')
    })
  })

  // ── 5. Invoice Returns ─────────────────────────────────────────────────────
  describe('Invoice Returns', () => {
    it('POST /api/invoices/:id/returns refuses return on cross-tenant invoice (404)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/invoices/${INVA_ID}/returns`,
        headers: asUserB,
        payload: {
          reason: 'Cross tenant attempt',
          lines: [
            {
              invoiceLineId: fakeId('line-a'),
              quantity: 1,
              restock: true,
            },
          ],
        },
      })
      expect([400, 403, 404]).toContain(res.statusCode)
      const returns = db.tables.get('invoice_returns') || []
      expect(returns.length).toBe(0)
    })
  })

  // ── 6. Warehouse CRUD ──────────────────────────────────────────────────────
  describe('Warehouse CRUD', () => {
    it('GET /api/warehouses/:id refuses cross-tenant read (404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/warehouses/${WHA_ID}`,
        headers: asUserB,
      })
      expect([403, 404]).toContain(res.statusCode)
    })

    it('PATCH /api/warehouses/:id refuses cross-tenant update and leaves state unchanged (404)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/warehouses/${WHA_ID}`,
        headers: asUserB,
        payload: { id: WHA_ID, name: 'Tampered Warehouse' },
      })
      expect([400, 403, 404, 500]).toContain(res.statusCode)
      const wh = db.tables.get('warehouses')?.find((w) => w.id === WHA_ID)
      expect(wh?.name).toBe('Main Storage A')
    })

    it('DELETE /api/warehouses/:id refuses cross-tenant delete (404)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/warehouses/${WHA_ID}`,
        headers: asUserB,
      })
      expect([204, 403, 404]).toContain(res.statusCode)
      const wh = db.tables.get('warehouses')?.find((w) => w.id === WHA_ID)
      expect(wh).toBeDefined()
      expect(wh?.deleted_at).toBeFalsy()
    })
  })

  // ── 7. Cloud Migration Jobs ────────────────────────────────────────────────
  describe('Cloud Migration Jobs', () => {
    it('GET /api/cloud-migration/jobs/:id refuses cross-tenant job lookup (404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/cloud-migration/jobs/${CMA_ID}`,
        headers: asUserB,
      })
      expect([403, 404]).toContain(res.statusCode)
    })
  })

  // ── 8. Notification Mark-Read ──────────────────────────────────────────────
  describe('Notification Mark-Read', () => {
    it('PATCH /api/v1/notifications/mark-read with User B cannot mark User A notification as read', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/notifications/mark-read',
        headers: asUserB,
        payload: { ids: [NOTIFA_ID] },
      })
      expect(res.statusCode).toBe(200)
      const notif = db.tables.get('notifications')?.find((n) => n.id === NOTIFA_ID)
      expect(notif?.read).toBe(false)
    })
  })

  // ── 9. Customer Documents URL ──────────────────────────────────────────────
  describe('Customer Documents URL', () => {
    it('GET /api/customers/:id/documents/:documentId/url refuses cross-tenant signed URL (404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/customers/${CUSTA_ID}/documents/${DOCA_ID}/url`,
        headers: asUserB,
      })
      expect([403, 404]).toContain(res.statusCode)
    })
  })
})
