// ============================================
// MODULE WORKSPACE — the membership row, and who may touch it.
//
// ---------------------------------------------------------------------------
// TWO DEFECTS, BOTH SILENT
//
// 1. CROSS-TENANT DELETE.
//    `removeMember` read the membership row with `.eq('id', memberId)` and no
//    workspace filter, then DELETED it the same way. `memberId` comes from the
//    caller — so the owner of workspace A, passing a membership id belonging
//    to workspace B, removed B's member. `requireRole` authorises the caller
//    in their OWN workspace and says nothing about the row they named.
//
//    `updateMemberRole` and `setMemberSuspension` both scope their statements.
//    This was the one that did not.
//
// 2. AN ADMIN WAS SILENTLY GIVEN THE LOWEST PRIVILEGE.
//    `workspace_members.role` is written by `workspace.service.ts` in the
//    client vocabulary (owner/admin/member/viewer) and read by
//    `tenancy.service.ts` in the server vocabulary (owner/manager/seller).
//    `isWorkspaceRole('admin')` is false, so the degradation branch turned
//    every admin into a seller. The owner granted admin; the person was
//    refused the ledger, the catalogue and payment cancellation, and the
//    members screen still said «admin».
//
// Neither threw. Neither logged. Both are exactly the kind of thing that only
// surfaces as "why can't he do anything" months later.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveWorkspaceRole, isWorkspaceRole } from '../services/tenancy.service'
import { can } from '../services/authorization'

const SRC = join(__dirname, '..')

/** Comments stripped — both defects are discussed at length in comments. */
function code(relative: string): string {
  return readFileSync(join(SRC, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
describe('the role vocabularies are bridged', () => {
  it('⚠️ an admin becomes a MANAGER, not a seller', () => {
    // The defect. `admin` is second only to owner in the vocabulary that
    // writes the column, and `manager` is second only to owner in the one that
    // reads it.
    expect(resolveWorkspaceRole('admin')).toBe('manager')
  })

  it('an admin can now do the things an admin is granted for', () => {
    // Asserted through the capability layer rather than the string, because
    // the string is not what the product refuses on.
    const role = resolveWorkspaceRole('admin')
    expect(can(role, 'ledger.read')).toBe(true)
    expect(can(role, 'ledger.post')).toBe(true)
    expect(can(role, 'payment.cancel')).toBe(true)
    expect(can(role, 'product.write')).toBe(true)
  })

  it('an admin still cannot do the owner-only things', () => {
    // Bridging must not over-grant. Closing a period, reversing a posted
    // entry, deleting an invoice and changing costing all rewrite what has
    // already been reported.
    const role = resolveWorkspaceRole('admin')
    expect(can(role, 'ledger.lock_period')).toBe(false)
    expect(can(role, 'ledger.reverse')).toBe(false)
    expect(can(role, 'invoice.delete')).toBe(false)
    expect(can(role, 'inventory.configure')).toBe(false)
    expect(can(role, 'member.manage')).toBe(false)
  })

  it('the server vocabulary passes through untouched', () => {
    expect(resolveWorkspaceRole('owner')).toBe('owner')
    expect(resolveWorkspaceRole('manager')).toBe('manager')
    expect(resolveWorkspaceRole('seller')).toBe('seller')
  })

  it('member maps to seller', () => {
    expect(resolveWorkspaceRole('member')).toBe('seller')
  })

  it('⚠️ an unrecognised value STILL degrades to least privilege', () => {
    // The bridge must not become a reason to trust arbitrary strings. The old
    // code defaulted a missing membership to 'admin', which the workflow
    // service accepted as an approver override.
    expect(resolveWorkspaceRole('superuser')).toBe('seller')
    expect(resolveWorkspaceRole(null)).toBe('seller')
    expect(resolveWorkspaceRole(undefined)).toBe('seller')
    expect(resolveWorkspaceRole(42)).toBe('seller')
    expect(resolveWorkspaceRole('')).toBe('seller')
  })

  it('degrading never reaches owner or manager', () => {
    for (const value of ['administrator', 'root', 'Admin', 'OWNER', {}, []]) {
      expect(resolveWorkspaceRole(value)).toBe('seller')
    }
  })

  it('the two vocabularies really are different — this is not a no-op', () => {
    // If `admin` ever became a server role, the bridge would be dead code and
    // this file would be testing nothing.
    expect(isWorkspaceRole('admin')).toBe(false)
    expect(isWorkspaceRole('member')).toBe(false)
    expect(isWorkspaceRole('viewer')).toBe(false)
  })
})

describe('⚠️ the viewer over-grant, recorded so it cannot be forgotten', () => {
  it('a viewer currently gets seller privileges, and can therefore sell', () => {
    // NOT an endorsement. There is no read-only rung in the server vocabulary,
    // so this is what the degradation branch already did before the bridge
    // existed — mapping it explicitly makes it visible rather than accidental.
    //
    // Fixing it means a role below `seller` plus a decision about what a
    // read-only member may see, which is a product policy and not a
    // translation. This test fails the day such a role is added, which is the
    // moment to revisit the mapping.
    const role = resolveWorkspaceRole('viewer')
    expect(role).toBe('seller')
    expect(can(role, 'invoice.create')).toBe(true)
    expect(can(role, 'payment.record')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('membership rows are addressed within a workspace', () => {
  const service = code('services/workspace.service.ts')

  /** The body of one method, up to the next `async ` at method indentation. */
  function methodBody(name: string): string {
    const start = service.indexOf(`async ${name}(`)
    expect(start, `${name} not found`).toBeGreaterThan(-1)
    const rest = service.slice(start + 1)
    // `{2}` rather than two literal spaces — a method at class indentation.
    const next = rest.search(/\n {2}(?:private )?async \w+\(/)
    return next === -1 ? rest : rest.slice(0, next)
  }

  it('⚠️ removeMember scopes BOTH the read and the delete', () => {
    const body = methodBody('removeMember')
    // Two statements, two filters. One without the other still leaves a
    // cross-tenant write.
    const scoped = body.match(/\.eq\('workspace_id', workspaceId\)/g) ?? []
    expect(
      scoped.length,
      'removeMember must filter by workspace_id on the SELECT and on the DELETE',
    ).toBeGreaterThanOrEqual(2)
  })

  it('removeMember does not address a row by id alone', () => {
    const body = methodBody('removeMember')

    // The original shape: `.eq('id', memberId)` running straight into the
    // terminal call with no workspace filter between them.
    expect(body).not.toMatch(/\.eq\('id', memberId\)\s*\.(single|maybeSingle)\(\)/)

    // And the delete. Sliced from `.delete()` to the end of its statement so
    // this asserts about that chain rather than about the method as a whole —
    // a filter on the SELECT must not be able to satisfy a test about the
    // DELETE.
    const deleteStart = body.indexOf('.delete()')
    expect(deleteStart, 'removeMember must still delete something').toBeGreaterThan(-1)
    const deleteChain = body.slice(deleteStart, deleteStart + 200)
    expect(deleteChain).toMatch(/\.eq\('workspace_id', workspaceId\)/)
  })

  it('the methods that were already correct still are', () => {
    // A regression here would be as serious as the original bug, and these two
    // are the reference the fix was measured against.
    expect(methodBody('updateMemberRole')).toMatch(/\.eq\('workspace_id', workspaceId\)/)
    expect(methodBody('setMemberSuspension')).toMatch(/\.eq\('workspace_id', workspaceId\)/)
  })

  it('an owner still cannot be removed, nor the caller themselves', () => {
    const body = methodBody('removeMember')
    expect(body).toMatch(/role === 'owner'/)
    expect(body).toMatch(/user_id === userId/)
  })
})
