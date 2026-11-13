import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { refusesSelfApproval } from '../services/workflow/approval-gate.domain'

/**
 * Owner decision (12 Nov 2026, V61 open decision 2): ONE approval engine —
 * rules + workflow templates + /approvals. The V61 policy engine beside it is
 * retired; its self-approval rule lives in the workflow engine now, and a
 * threshold is compared in the books' currency.
 */

const root = path.resolve(__dirname, '..', '..', '..')
const read = (...p: string[]) => fs.readFileSync(path.join(root, ...p), 'utf8')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('refusesSelfApproval', () => {
  const base = { action: 'approved', actorId: 'u1', actorRole: 'manager', issuerId: 'u1' }

  it('refuses the issuer approving their own document', () => {
    expect(refusesSelfApproval(base)).toBe(true)
  })
  it('lets another member approve', () => {
    expect(refusesSelfApproval({ ...base, actorId: 'u2' })).toBe(false)
  })
  it('lets the owner approve — a one-person business must not be stuck for ever', () => {
    expect(refusesSelfApproval({ ...base, actorRole: 'owner' })).toBe(false)
  })
  it('always lets the issuer reject or withdraw', () => {
    expect(refusesSelfApproval({ ...base, action: 'rejected' })).toBe(false)
    expect(refusesSelfApproval({ ...base, action: 'cancelled' })).toBe(false)
  })
  it('no known issuer is not a match', () => {
    expect(refusesSelfApproval({ ...base, issuerId: null })).toBe(false)
  })
})

describe('the workflow engine enforces it, from the document', () => {
  const service = strip(read('backend', 'src', 'services', 'workflow.service.ts'))

  it('reads the issuer from the invoice, scoped to the workspace, and refuses with a code', () => {
    expect(service).toContain("if (input.action === 'approved' && userRole !== 'owner')")
    expect(service).toContain(
      "'SELF_APPROVAL_REFUSED: the person who issued this document cannot approve it'",
    )
    expect(service).toMatch(
      /from\('invoices'\)\s*\.select\('user_id'\)\s*\.eq\('workspace_id', ctx\.workspaceId\)/,
    )
    // A failed read is an error, never «unknown issuer → allowed».
    expect(service).toContain(
      "throw new DatabaseError('Failed to read the document issuer', error)",
    )
  })

  it('checks before the action is recorded', () => {
    const check = service.indexOf('refusesSelfApproval({')
    const insert = service.indexOf(".from('workflow_actions')\n      .insert(")
    expect(check).toBeGreaterThan(0)
    expect(insert).toBeGreaterThan(check)
  })
})

describe('the threshold is in the books’ currency', () => {
  const invoice = strip(read('backend', 'src', 'services', 'invoice.service.ts'))
  it('the rules see invoice.total_book = total × the invoice’s rate', () => {
    expect(invoice).toContain('total_book: data?.totalInBook,')
    expect(invoice).toContain(
      '? money.total * Number((data as { exchangeRate?: number }).exchangeRate)',
    )
  })
})

describe('the parallel V61 engine is gone', () => {
  it('no route, service, hook or schema remains', () => {
    expect(
      fs.existsSync(path.join(root, 'backend/src/services/workflow/approval-policy.service.ts')),
    ).toBe(false)
    expect(
      fs.existsSync(path.join(root, 'packages/validation/src/schemas/approval-policy.ts')),
    ).toBe(false)
    expect(strip(read('backend', 'src', 'routes', 'workflow.routes.ts'))).not.toContain(
      '/api/v1/approval-',
    )
    expect(read('packages', 'api', 'src', 'hooks', 'use-workflow.ts')).not.toContain(
      '/v1/approval-',
    )
    expect(
      read('packages', 'validation', 'src', 'schemas', 'offline-endpoint-matrix.ts'),
    ).not.toContain('/v1/approval-')
  })
})
