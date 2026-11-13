import { describe, expect, it, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Owner request (12 Nov 2026): «تأیید دو نفره برای حذف‌ها». Removing a member
 * or an IP allow-list entry in the platform console PROPOSES a maker-checker
 * request; a DIFFERENT admin's approval carries it out.
 */

const calls = vi.hoisted(() => ({
  removeMember: [] as unknown[],
  removeEntry: [] as unknown[],
  events: [] as unknown[],
}))

vi.mock('../services/admin.service', () => ({
  AdminService: class {
    async removeMember(actor: unknown, id: string) {
      calls.removeMember.push({ actor, id })
    }
  },
}))
vi.mock('../services/admin/admin-ip-allowlist.service', () => ({
  adminIpAllowlistService: {
    removeEntry: async (id: string) => {
      calls.removeEntry.push(id)
    },
  },
}))
vi.mock('../services/admin/admin-security.service', () => ({
  AdminSecurityService: {
    logSecurityEvent: async (event: unknown) => {
      calls.events.push(event)
    },
  },
}))

import {
  executeApprovedDeletion,
  isDeletionAction,
  isUnknownActionType,
} from '../services/admin/admin-deletions'

const root = path.resolve(__dirname, '..', '..', '..')
const read = (...p: string[]) => fs.readFileSync(path.join(root, ...p), 'utf8')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('executeApprovedDeletion', () => {
  beforeEach(() => {
    calls.removeMember.length = 0
    calls.removeEntry.length = 0
    calls.events.length = 0
  })

  it('removes the member as the APPROVER', async () => {
    await executeApprovedDeletion(
      'MEMBER_REMOVE',
      { id: 'm1' },
      { id: 'approver-uid', email: 'b@x' },
    )
    expect(calls.removeMember).toEqual([
      { actor: { adminUserId: 'approver-uid', reason: 'two-person approval' }, id: 'm1' },
    ])
  })

  it('removes the allow-list entry and logs who approved it', async () => {
    await executeApprovedDeletion('IP_ALLOWLIST_REMOVE', { id: 'e1' }, { id: 'u', email: 'b@x' })
    expect(calls.removeEntry).toEqual(['e1'])
    expect(calls.events).toEqual([
      {
        eventType: 'ADMIN_IP_ALLOWLIST_REMOVED',
        adminEmail: 'b@x',
        details: { id: 'e1', approvedBy: 'b@x' },
      },
    ])
  })

  it('a request without an id deletes nothing', async () => {
    await expect(
      executeApprovedDeletion('MEMBER_REMOVE', {}, { id: 'u', email: 'b@x' }),
    ).rejects.toThrow()
    expect(calls.removeMember).toEqual([])
  })
})

describe('recognisers', () => {
  it('only the two deletions are deletion actions', () => {
    expect(isDeletionAction('MEMBER_REMOVE')).toBe(true)
    expect(isDeletionAction('IP_ALLOWLIST_REMOVE')).toBe(true)
    expect(isDeletionAction('GATEWAY_ENABLE')).toBe(false)
  })
  it('the CHECK refusal is recognised as «not installed», nothing else is', () => {
    expect(
      isUnknownActionType(
        new Error(
          'new row for relation "admin_action_requests" violates check constraint "admin_action_requests_action_type_check"',
        ),
      ),
    ).toBe(true)
    expect(isUnknownActionType(new Error('connection reset'))).toBe(false)
  })
})

describe('wiring — a click proposes, an approval deletes', () => {
  const members = strip(read('backend', 'src', 'routes', 'admin.routes.ts'))
  const security = strip(read('backend', 'src', 'routes', 'admin-security.routes.ts'))
  const billing = strip(read('backend', 'src', 'services', 'admin', 'admin-billing.service.ts'))

  it('the member route no longer removes; it proposes MEMBER_REMOVE', () => {
    const route = members.slice(
      members.indexOf("fastify.delete(\n    '/api/admin/memberships/:membershipId'"),
    )
    expect(route.length).toBeLessThan(members.length)
    const handler = route.slice(0, route.indexOf('fastify.', 10))
    expect(handler).not.toContain('adminService.removeMember(')
    expect(handler).toContain("actionType: 'MEMBER_REMOVE'")
    expect(handler).toContain('await adminService.assertMemberRemovable(parsed.data)')
  })

  it('the allow-list route no longer removes; it proposes IP_ALLOWLIST_REMOVE', () => {
    const route = security.slice(
      security.indexOf("fastify.delete(\n    '/api/admin/security/ip-allowlist/:id'"),
    )
    expect(route).not.toContain('adminIpAllowlistService.removeEntry(')
    expect(route).toContain("actionType: 'IP_ALLOWLIST_REMOVE'")
  })

  it('no fallback: an unknown type is 503 «not installed», never a direct delete', () => {
    for (const source of [members, security]) {
      expect(source).toContain(
        'if (isUnknownActionType(err)) throw new AdminActionTypeNotInstalledError()',
      )
    }
  })

  it('the approval runs the deletion after the proposer check and before APPROVED is written', () => {
    const proposerCheck = billing.indexOf('existing.proposed_by === params.approverEmail')
    const execute = billing.indexOf('await executeApprovedDeletion(')
    const approvedWrite = billing.indexOf(
      "const nextStatus = params.approved ? 'APPROVED' : 'REJECTED'",
    )
    expect(proposerCheck).toBeGreaterThan(0)
    expect(execute).toBeGreaterThan(proposerCheck)
    expect(approvedWrite).toBeGreaterThan(execute)
  })

  it('the migration names both types and keeps every older one', () => {
    const sql = read('docs', 'admin-action-types-03-migration.sql')
    for (const type of [
      'MEMBER_REMOVE',
      'IP_ALLOWLIST_REMOVE',
      'GATEWAY_ENABLE',
      'SECRET_ROTATE',
      'REFUND',
    ]) {
      expect(sql).toContain(`'${type}'`)
    }
  })
})
