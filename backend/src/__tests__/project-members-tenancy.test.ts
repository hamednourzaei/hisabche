// ============================================
// backend/src/__tests__/project-members-tenancy.test.ts
//
// Regression tests for N-31: Project Members and Tasks Tenancy Isolation
//
// Verifies that:
// 1. Cross-tenant members read: Workspace A cannot list members of Workspace B's project.
// 2. Cross-tenant members write: Workspace A cannot add or remove members in Workspace B's project.
// 3. Cross-tenant tasks: Workspace A cannot list or create tasks for Workspace B's project.
// 4. Cross-tenant time entries: Workspace A cannot list or add time entries for Workspace B's project.
// ============================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '../errors/database.error'

interface Row {
  [key: string]: unknown
}

const tables = new Map<string, Row[]>()

function reset(): void {
  tables.clear()
  tables.set('projects', [])
  tables.set('project_members', [])
  tables.set('project_tasks', [])
  tables.set('project_time_entries', [])
  tables.set('employees', [])
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
    order: () => builder,
    limit: () => builder,
    single: async () => {
      const current = getRows()
      const found = current.find((r) => matches(r, eqs))
      if (!found) {
        return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
      }
      return { data: { ...found }, error: null }
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
        for (const r of toAdd) {
          const item = { id: `id-${Math.random()}`, ...r }
          current.push(item)
        }
        resolve({ data: toAdd, error: null })
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

vi.mock('../utils/pagination', () => ({
  memoryCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../services/event-log.service', () => ({
  logBusinessEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/base-currency', () => ({
  baseCurrencyOf: vi.fn().mockResolvedValue('AFN'),
}))

describe('N-31: Project Members and Tasks Tenancy Isolation', () => {
  const WORKSPACE_A = '11111111-1111-1111-1111-111111111111'
  const WORKSPACE_B = '22222222-2222-2222-2222-222222222222'
  const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const PROJECT_B_ID = '33333333-3333-3333-3333-333333333333'
  const MEMBER_B_ID = '44444444-4444-4444-4444-444444444444'

  let projectService: any

  const ctxA = {
    workspaceId: WORKSPACE_A,
    userId: USER_A,
    role: 'owner',
    capabilities: ['*'],
  } as any

  const ctxB = {
    workspaceId: WORKSPACE_B,
    userId: USER_B,
    role: 'owner',
    capabilities: ['*'],
  } as any

  beforeEach(async () => {
    reset()
    // Seed Workspace B project and member
    tables.get('projects')!.push({
      id: PROJECT_B_ID,
      workspace_id: WORKSPACE_B,
      name: 'Workspace B Secret Project',
      status: 'planning',
    })
    tables.get('project_members')!.push({
      id: MEMBER_B_ID,
      project_id: PROJECT_B_ID,
      user_id: USER_B,
      role: 'manager',
    })

    const mod = await import('../services/project.service')
    projectService = new mod.ProjectService()
  })

  it('blocks Workspace A from listing members of Workspace B project with 404 NotFoundError', async () => {
    await expect(projectService.listMembers(ctxA, PROJECT_B_ID)).rejects.toThrow(NotFoundError)
  })

  it('allows Workspace B to list members of its own project', async () => {
    const members = await projectService.listMembers(ctxB, PROJECT_B_ID)
    expect(members).toHaveLength(1)
    expect(members[0].id).toBe(MEMBER_B_ID)
  })

  it('blocks Workspace A from adding a member to Workspace B project', async () => {
    await expect(
      projectService.addMember(ctxA, {
        projectId: PROJECT_B_ID,
        userId: USER_A,
        role: 'member',
      }),
    ).rejects.toThrow(NotFoundError)

    // Verify member was not added to DB
    const members = tables.get('project_members')!.filter((m) => m.project_id === PROJECT_B_ID)
    expect(members).toHaveLength(1)
  })

  it('blocks Workspace A from removing a member from Workspace B project', async () => {
    await expect(projectService.removeMember(ctxA, PROJECT_B_ID, MEMBER_B_ID)).rejects.toThrow(
      NotFoundError,
    )

    // Verify member still exists in DB
    const member = tables.get('project_members')!.find((m) => m.id === MEMBER_B_ID)
    expect(member).toBeDefined()
  })

  it('blocks Workspace A from listing tasks of Workspace B project', async () => {
    await expect(projectService.listTasks(ctxA, PROJECT_B_ID)).rejects.toThrow(NotFoundError)
  })

  it('blocks Workspace A from creating a task in Workspace B project', async () => {
    await expect(
      projectService.createTask(ctxA, {
        projectId: PROJECT_B_ID,
        title: 'Unauthorized Task',
        status: 'todo',
        priority: 'medium',
      }),
    ).rejects.toThrow(NotFoundError)
  })

  it('blocks Workspace A from listing time entries of Workspace B project', async () => {
    await expect(projectService.listTimeEntries(ctxA, PROJECT_B_ID)).rejects.toThrow(NotFoundError)
  })

  it('blocks Workspace A from creating a time entry in Workspace B project', async () => {
    await expect(
      projectService.createTimeEntry(ctxA, {
        projectId: PROJECT_B_ID,
        employeeId: '55555555-5555-5555-5555-555555555555',
        date: '2026-10-26',
        hours: 4,
        billable: true,
        hourlyRate: 50,
      }),
    ).rejects.toThrow(NotFoundError)
  })
})
