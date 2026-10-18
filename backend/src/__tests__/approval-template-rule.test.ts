// Owner, 18 Oct 2026: «فاکتور بالای 5000» and «60000» were approval
// TEMPLATES with no rule — the amount was only in the name, nothing wrote a
// rule (the rules route had no client), so every invoice posted at once.
//
// The approval screen now writes, per invoice template, the rule below
// (packages/ui/src/lib/workflow/approval-rule.ts). This test runs THAT shape
// through the real engine the invoice service calls (decideApprovalRoute →
// rules.evaluate → evaluateRules/summarise).
import { describe, expect, it, vi } from 'vitest'

import {
  evaluateRules,
  summarise,
  validateRule,
  type BusinessRule,
} from '../services/rules/rules.domain'

const WF = '11111111-1111-4111-8111-111111111111'

const rule = (value: number, operator: 'gt' | 'gte' = 'gt'): BusinessRule => ({
  id: 'r1',
  workspaceId: 'ws',
  name: 'فاکتور بالای 5000',
  entity: 'invoice',
  conditions: { match: 'all', conditions: [{ field: 'invoice.total', operator, value }] },
  actions: [{ kind: 'require_approval', workflowId: WF }],
  priority: 100,
  active: true,
})

// The facts exactly as InvoiceService#decideApprovalRoute builds them.
const facts = (total: number) => ({
  invoice: { total, type: 'sale', currency: 'AFN' },
  customer: { id: null },
})

describe('the rule the approval screen writes', () => {
  it('is a valid rule', () => {
    expect(validateRule(rule(5000))).toEqual([])
    expect(validateRule(rule(0, 'gte'))).toEqual([])
  })

  it('«بیشتر از ۵۰۰۰»: 6,000 waits on the template, 4,000 and 5,000 post at once', () => {
    const at = (total: number) => summarise(evaluateRules([rule(5000)], 'invoice', facts(total)))
    expect(at(6000)).toMatchObject({ requiresApproval: true, workflowIds: [WF] })
    expect(at(4000).requiresApproval).toBe(false)
    expect(at(5000).requiresApproval).toBe(false)
  })

  it('«همه‌ی فاکتورها» (total ≥ 0) holds every invoice', () => {
    expect(summarise(evaluateRules([rule(0, 'gte')], 'invoice', facts(1))).requiresApproval).toBe(
      true,
    )
  })

  it('before: a template with no rule holds nothing — the owner’s report', () => {
    expect(summarise(evaluateRules([], 'invoice', facts(1_000_000))).requiresApproval).toBe(false)
  })
})

describe('a task for the owner (CRM, 18 Oct 2026)', () => {
  vi.mock('../db', () => ({ supabase: {} }))

  it('only the owner may make a task with no employee', async () => {
    const { CrmService } = await import('../services/crm/crm.service')
    const service = new CrmService()
    for (const role of ['admin', 'manager', 'seller'] as const) {
      await expect(
        service.createInteraction(
          { workspaceId: 'ws', userId: 'u', role } as never,
          {
            customerId: '22222222-2222-4222-8222-222222222222',
            type: 'call',
            subject: 'x',
          } as never,
        ),
      ).rejects.toThrow('CRM_OWNER_TASK_OWNER_ONLY')
    }
  })
})
