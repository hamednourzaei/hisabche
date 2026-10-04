// ============================================
// #144 — the workflow builder's rules, applied to a template when it is made.
//
// `validateDefinition` had tests and no caller. `createWorkflow` now reads a
// template as the builder's definition and refuses a broken one BEFORE it
// writes — the template and its steps are two inserts.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ supabase: { from: () => ({}) } }))

import { templateProblems } from '../services/workflow.service'

const template = (steps: Array<{ step_order: number; approver_role?: string | null }>) => ({
  name: 'تأیید فاکتور',
  entity_type: 'invoice',
  steps,
})

describe('a template is checked with the builder’s rules', () => {
  it('a plain chain of approvals has no problem', () => {
    expect(
      templateProblems(
        template([
          { step_order: 1, approver_role: 'manager' },
          { step_order: 2, approver_role: 'owner' },
        ]),
      ),
    ).toEqual([])
  })

  it('no step at all is refused', () => {
    expect(templateProblems(template([]))).toEqual(['NO_STEPS'])
  })

  it('two steps in the same position are refused', () => {
    expect(
      templateProblems(
        template([
          { step_order: 1, approver_role: 'manager' },
          { step_order: 1, approver_role: 'owner' },
        ]),
      ),
    ).toContain('DUPLICATE_STEP_ID')
  })

  it('a step nobody is named to approve is refused — it would freeze the document', () => {
    expect(templateProblems(template([{ step_order: 1, approver_role: '' }]))).toContain(
      'APPROVAL_WITHOUT_ROLE',
    )
    expect(templateProblems(template([{ step_order: 1, approver_role: null }]))).toContain(
      'APPROVAL_WITHOUT_ROLE',
    )
  })

  it('the order the steps arrive in does not matter', () => {
    expect(
      templateProblems(
        template([
          { step_order: 2, approver_role: 'owner' },
          { step_order: 1, approver_role: 'manager' },
        ]),
      ),
    ).toEqual([])
  })
})

describe('createWorkflow refuses before it writes', () => {
  const source = readFileSync(join(__dirname, '..', 'services', 'workflow.service.ts'), 'utf8')
  const body = source.slice(source.indexOf('async createWorkflow('))

  it('the check comes before the first insert', () => {
    const check = body.indexOf('templateProblems(input)')
    const firstInsert = body.indexOf('.insert(')
    expect(check).toBeGreaterThan(-1)
    expect(firstInsert).toBeGreaterThan(-1)
    expect(check).toBeLessThan(firstInsert)
  })
})
