// ============================================
// backend/src/__tests__/workflow-tenancy-isolation.test.ts
//
// Regression tests for N-18: Workflow Tenancy Isolation
//
// Verifies that:
// 1. Cross-tenant GET: Workspace A cannot read Workspace B's workflows or instances.
// 2. Cross-tenant PATCH: Workspace A cannot update Workspace B's workflows.
// 3. Cross-tenant DELETE: Workspace A cannot delete Workspace B's workflows.
// 4. Cross-tenant START: Workspace A cannot start an execution of Workspace B's workflows.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Row {
  [key: string]: unknown
}

const tables = new Map<string, Row[]>()

function reset(): void {
  tables.clear()
  tables.set('workflows', [])
  tables.set('workflow_instances', [])
  tables.set('workflow_steps', [])
  tables.set('workflow_triggers', [])
}

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([column, value]) => row[column] === value)
}

function makeQuery(table: string) {
  const eqs: Array<[string, unknown]> = []
  let pendingKind: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let pendingValues: Row | Row[] | undefined

  const getRows = () => tables.get(table) ?? (tables.set(table, []), tables.get(table)!)

  const builder: any = {
    select: () => {
      pendingKind = 'select'
      return builder
    },
    insert: (values: Row | Row[]) => {
      pendingKind = 'insert'
      pendingValues = values
      return builder
    },
    update: (values: Row) => {
      pendingKind = 'update'
      pendingValues = values
      return builder
    },
    delete: () => {
      pendingKind = 'delete'
      return builder
    },
    eq: (column: string, value: unknown) => {
      eqs.push([column, value])
      return builder
    },
    is: (column: string, value: unknown) => {
      eqs.push([column, value])
      return builder
    },
    in: (column: string, values: unknown[]) => {
      return builder
    },
    order: () => builder,
    single: async () => {
      const current = getRows()
      if (pendingKind === 'select') {
        const found = current.find((r) => matches(r, eqs))
        if (!found) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
        }
        return { data: { ...found }, error: null }
      }
      if (pendingKind === 'update') {
        const idx = current.findIndex((r) => matches(r, eqs))
        if (idx === -1) {
          return { data: null, error: { message: 'No row matched update', code: 'PGRST116' } }
        }
        current[idx] = { ...current[idx], ...(pendingValues as Row) }
        return { data: { ...current[idx] }, error: null }
      }
      return { data: null, error: null }
    },
    maybeSingle: async () => {
      const current = getRows()
      const found = current.find((r) => matches(r, eqs))
      return { data: found ? { ...found } : null, error: null }
    },
    then: (resolve: (result: { data: Row[] | Row | null; error: unknown }) => void) => {
      const current = getRows()
      if (pendingKind === 'select') {
        const found = current.filter((r) => matches(r, eqs))
        resolve({ data: found.map((r) => ({ ...r })), error: null })
        return
      }
      if (pendingKind === 'insert') {
        const toAdd = Array.isArray(pendingValues) ? pendingValues : [pendingValues!]
        for (const r of toAdd) current.push({ ...r })
        resolve({ data: toAdd, error: null })
        return
      }
      if (pendingKind === 'update') {
        let updatedCount = 0
        for (let i = 0; i < current.length; i++) {
          if (matches(current[i]!, eqs)) {
            current[i] = { ...current[i], ...(pendingValues as Row) }
            updatedCount++
          }
        }
        resolve({ data: null, error: null })
        return
      }
      if (pendingKind === 'delete') {
        const remaining = current.filter((r) => !matches(r, eqs))
        tables.set(table, remaining)
        resolve({ data: null, error: null })
        return
      }
      resolve({ data: null, error: null })
    },
  }

  return builder
}

vi.mock('../db', () => ({
  supabase: {
    from: (table: string) => makeQuery(table),
  },
}))

vi.mock('../services/cache.service', () => ({
  cacheService: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    clearPattern: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('N-18: Workflow Tenancy Isolation', () => {
  const WORKSPACE_A = '11111111-1111-1111-1111-111111111111'
  const WORKSPACE_B = '22222222-2222-2222-2222-222222222222'
  const WORKFLOW_B_ID = '33333333-3333-3333-3333-333333333333'
  const INSTANCE_B_ID = '44444444-4444-4444-4444-444444444444'

  let workflowService: any

  beforeEach(async () => {
    reset()
    // Seed Workspace B workflow
    tables.get('workflows')!.push({
      id: WORKFLOW_B_ID,
      workspace_id: WORKSPACE_B,
      name: 'Workspace B Secret Flow',
      status: 'active',
      is_deleted: false,
    })
    tables.get('workflow_instances')!.push({
      id: INSTANCE_B_ID,
      workspace_id: WORKSPACE_B,
      workflow_id: WORKFLOW_B_ID,
      status: 'running',
    })

    const mod = await import('../services/workflow.service')
    workflowService = new mod.WorkflowService()
  })

  it('blocks Workspace A from fetching Workspace B workflow', async () => {
    await expect(workflowService.getWorkflow(WORKSPACE_A, WORKFLOW_B_ID)).rejects.toThrow()
  })

  it('allows Workspace B to fetch its own workflow', async () => {
    const wf = await workflowService.getWorkflow(WORKSPACE_B, WORKFLOW_B_ID)
    expect(wf.id).toBe(WORKFLOW_B_ID)
    expect(wf.workspace_id).toBe(WORKSPACE_B)
  })

  it('blocks Workspace A from updating Workspace B workflow', async () => {
    await expect(
      workflowService.updateWorkflow(WORKSPACE_A, WORKFLOW_B_ID, { name: 'Hacked Name' }),
    ).rejects.toThrow()

    // Verify row in DB was not updated
    const wfInDb = tables.get('workflows')!.find((w) => w.id === WORKFLOW_B_ID)
    expect(wfInDb?.name).toBe('Workspace B Secret Flow')
  })

  it('blocks Workspace A from deleting Workspace B workflow', async () => {
    await expect(workflowService.deleteWorkflow(WORKSPACE_A, WORKFLOW_B_ID)).rejects.toThrow()

    // Verify row in DB was not marked deleted
    const wfInDb = tables.get('workflows')!.find((w) => w.id === WORKFLOW_B_ID)
    expect(wfInDb?.is_deleted).toBe(false)
  })

  it('blocks Workspace A from starting execution of Workspace B workflow', async () => {
    await expect(
      workflowService.startWorkflow(WORKSPACE_A, {
        workflow_id: WORKFLOW_B_ID,
        trigger_type: 'manual',
        context: {},
      }),
    ).rejects.toThrow()
  })

  it('blocks Workspace A from fetching Workspace B workflow instance', async () => {
    await expect(workflowService.getInstance(WORKSPACE_A, INSTANCE_B_ID)).rejects.toThrow()
  })
})
