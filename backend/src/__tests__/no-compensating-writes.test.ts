// Audit F-06 / F-08 (8 Nov 2026): two multi-table writes that were sequences of
// unchecked calls — opening a stock count (header, lines, compensating DELETE)
// and rewriting a role's permissions (update, DELETE all, INSERT) — are each one
// Postgres function now. The old sequence survives only as a logged fallback
// until the migration runs, and it never deletes to «undo».
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*\r?\n/gm, '')
const src = (rel: string) => strip(readFileSync(join(__dirname, '..', rel), 'utf8'))

describe('stock count opening', () => {
  const service = src('services/inventory/cycle-count.service.ts')

  it('calls the one-transaction function first', () => {
    expect(service).toContain("supabase.rpc('cycle_count_open'")
  })

  it('never deletes a count header to undo a failed line insert', () => {
    expect(service).not.toMatch(/from\('cycle_counts'\)\s*\.delete\(\)/)
  })

  it('the fallback says so in the log', () => {
    expect(service).toContain('CYCLE_COUNT_ATOMIC_RPC_MISSING')
  })
})

describe('role permission rewrite', () => {
  const service = src('services/permission.service.ts')
  const updateRole = service.slice(
    service.indexOf('async updateRole('),
    service.indexOf('private async updateRoleInSteps('),
  )

  it('is one function call, and its error is checked', () => {
    expect(updateRole).toContain("supabase.rpc('role_update_with_permissions'")
    expect(updateRole).toContain('throw new DatabaseError')
    expect(updateRole).not.toContain(".from('role_permissions').delete()")
  })
})

// Behaviour of the fallback: the new set is written before old rows go.
const ops: string[] = []
vi.mock('../db', () => {
  const builder = (table: string) => {
    let op = 'select'
    const q: Record<string, unknown> = {}
    const self = () => q
    q.select = self
    q.eq = self
    q.in = self
    q.update = () => ((op = 'update'), ops.push(`${table}:update`), q)
    q.delete = () => ((op = 'delete'), ops.push(`${table}:delete`), q)
    q.insert = () => ((op = 'insert'), ops.push(`${table}:insert`), q)
    q.single = async () => ({ data: { id: 'r', name: 'n' }, error: null })
    q.then = (resolve: (v: unknown) => void) =>
      resolve(
        table === 'role_permissions' && op === 'select'
          ? { data: [{ permission_id: 'old' }], error: null }
          : { data: null, error: null },
      )
    return q
  }
  return {
    supabase: {
      from: builder,
      rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'missing' } }),
    },
  }
})

describe('updateRole fallback before the migration', () => {
  it('adds the new permission before removing the old one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const mod = await import('../services/permission.service')
    const Service = (
      mod as unknown as {
        PermissionService: new () => { updateRole: (id: string, d: object) => Promise<unknown> }
      }
    ).PermissionService
    await new Service().updateRole('r', { permissionIds: ['new'] }).catch(() => undefined)
    const insertAt = ops.indexOf('role_permissions:insert')
    const deleteAt = ops.indexOf('role_permissions:delete')
    expect(insertAt).toBeGreaterThanOrEqual(0)
    expect(deleteAt).toBeGreaterThan(insertAt)
  })
})
