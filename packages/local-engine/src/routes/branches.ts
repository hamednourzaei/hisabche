// ============================================
// packages/local-engine/src/routes/branches.ts
//
// Branches, offline: the list, the tree for the «شعب» tab, create and update.
//
// ⚠️ THE SERVER'S RULES, NOT A COPY: nesting and placement (a duplicate code, a
// parent that is not there, a cycle) are `nestBranches` and
// `validateBranchPlacement` from @hisabche/validation — the functions
// backend/src/services/branch uses. Before this the device answered «not
// available offline» and a shop could not add its second branch.
//
// What the device honestly does NOT hold:
//   · a branch MANAGER — it is an employee, and the device keeps no employee
//     directory to verify one against. A manager sent offline is refused out
//     loud (BRANCH_MANAGER_OFFLINE), never accepted and dropped.
//   · who is posted to a branch — so the tree shows branches with no people,
//     `headCount: 0`. That is «unknown here», and the tab says nothing more.
// ============================================

import {
  nestBranches,
  validateBranchPlacement,
  type Branch,
  type BranchTreeNode,
} from '@hisabche/validation'
import { NotFoundError, ValidationError } from '../errors'
import type { LocalDb } from '../db'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'

interface BranchRow {
  id: string
  workspace_id: string
  code: string
  name: string
  parent_branch_id: string | null
  is_active: number
}

const MAX_CODE = 20
const MAX_NAME = 120

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function mapBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    code: row.code,
    name: row.name,
    parentBranchId: row.parent_branch_id ?? null,
    isActive: Boolean(row.is_active),
    managerEmployeeId: null,
  }
}

function branchesOf(db: LocalDb, workspaceId: string): Branch[] {
  return db
    .all<BranchRow>(
      'SELECT id, workspace_id, code, name, parent_branch_id, is_active FROM branch WHERE workspace_id = ? AND deleted_at IS NULL ORDER BY code',
      [workspaceId],
    )
    .map(mapBranch)
}

function text(value: unknown, max: number, field: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed.length === 0 || trimmed.length > max) {
    throw new ValidationError(`${field}: must be 1–${max} characters`)
  }
  return trimmed
}

function refuseManager(body: Record<string, unknown>): void {
  if (body.managerEmployeeId !== undefined && body.managerEmployeeId !== null) {
    throw new ValidationError(
      'BRANCH_MANAGER_OFFLINE: a branch manager is an employee, and this device holds no employee directory. Set it when you are online.',
    )
  }
}

export function registerBranchRoutes(router: Router): void {
  router.get('/branches', (c: RouteHandlerContext) => ({
    branches: branchesOf(c.db, c.ctx.workspaceId),
    // The device user is the owner: no branch restriction applies.
    scope: { kind: 'all' as const },
  }))

  router.get('/branches/tree', (c: RouteHandlerContext) => {
    const { db, ctx } = c
    const nodes: BranchTreeNode[] = branchesOf(db, ctx.workspaceId).map((branch) => ({
      ...branch,
      managerName: null,
      headCount: 0,
      employees: [],
      children: [],
    }))
    return { tree: nestBranches(nodes) }
  })

  router.post('/branches', (c: RouteHandlerContext) => {
    const { db, ctx, body } = c
    const raw = (body ?? {}) as Record<string, unknown>
    const code = text(raw.code, MAX_CODE, 'code')
    const name = text(raw.name, MAX_NAME, 'name')
    const parentBranchId =
      typeof raw.parentBranchId === 'string' && raw.parentBranchId ? raw.parentBranchId : null
    refuseManager(raw)

    const problems = validateBranchPlacement(
      { id: '', code, parentBranchId },
      branchesOf(db, ctx.workspaceId),
    )
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const id = (typeof raw.id === 'string' && raw.id) || generateUuid()
    const now = new Date().toISOString()
    db.run(
      `INSERT INTO branch (id, workspace_id, code, name, parent_branch_id, is_active, created_at, updated_at, origin, sync_state)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'local', 'local_only')`,
      [id, ctx.workspaceId, code, name, parentBranchId, now, now],
    )
    const created = db.get<BranchRow>(
      'SELECT id, workspace_id, code, name, parent_branch_id, is_active FROM branch WHERE id = ?',
      [id],
    )
    return created ? mapBranch(created) : { id }
  })

  router.patch('/branches/:id', (c: RouteHandlerContext) => {
    const { db, ctx, params, body } = c
    const raw = (body ?? {}) as Record<string, unknown>
    const existing = branchesOf(db, ctx.workspaceId)
    const current = existing.find((branch) => branch.id === params.id)
    if (!current) throw new NotFoundError('Branch', params.id ?? '')
    refuseManager(raw)

    const code = raw.code === undefined ? current.code : text(raw.code, MAX_CODE, 'code')
    const name = raw.name === undefined ? current.name : text(raw.name, MAX_NAME, 'name')
    const parentBranchId =
      raw.parentBranchId === undefined
        ? current.parentBranchId
        : typeof raw.parentBranchId === 'string' && raw.parentBranchId
          ? raw.parentBranchId
          : null
    const isActive = raw.isActive === undefined ? current.isActive : raw.isActive === true

    const problems = validateBranchPlacement({ id: current.id, code, parentBranchId }, existing)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    db.run(
      'UPDATE branch SET code = ?, name = ?, parent_branch_id = ?, is_active = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
      [
        code,
        name,
        parentBranchId,
        isActive ? 1 : 0,
        new Date().toISOString(),
        current.id,
        ctx.workspaceId,
      ],
    )
    return { ...current, code, name, parentBranchId, isActive }
  })
}
