// Two owner requests, 18 Oct 2026:
//   · «شرط گذاشتم، تأیید نخواست» — an approval template now carries the rule
//     that makes an invoice wait for it (the rules engine had no client);
//   · «اگه کارمندی نبود… اکانت مالک» — the owner can give a task to
//     themself; nobody else sees that choice, and the server refuses it from
//     anyone else (backend: approval-template-rule.test.ts).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import type { BusinessRule } from '@hisabche/api'
import { approvalConditionOf, invoiceApprovalRule } from '../lib/workflow/approval-rule'

const ui = (...p: string[]) => readFileSync(join(__dirname, '..', 'components', 'ui', ...p), 'utf8')
const flat = (s: string) => s.split(/\s+/).join(' ')

describe('an approval template’s condition', () => {
  it('«بیشتر از ۵۰۰۰» becomes invoice.total > 5000 → require_approval(template)', () => {
    const rule = invoiceApprovalRule('فاکتور بالای 5000', 'wf1', 5000)
    expect(rule.entity).toBe('invoice')
    expect(rule.conditions.conditions).toEqual([
      { field: 'invoice.total', operator: 'gt', value: 5000 },
    ])
    expect(rule.actions).toEqual([{ kind: 'require_approval', workflowId: 'wf1' }])
  })

  it('empty = every invoice (the engine wants one condition: total ≥ 0)', () => {
    expect(invoiceApprovalRule('x', 'wf1', null).conditions.conditions).toEqual([
      { field: 'invoice.total', operator: 'gte', value: 0 },
    ])
  })

  it('reads back: above / always / none — the owner’s two templates had none', () => {
    const saved = (min: number | null, workflowId = 'wf1'): BusinessRule => ({
      id: 'r',
      priority: 100,
      active: true,
      ...invoiceApprovalRule('x', workflowId, min),
    })
    expect(approvalConditionOf([saved(5000)], 'wf1')).toEqual({ kind: 'above', amount: 5000 })
    expect(approvalConditionOf([saved(null)], 'wf1')).toEqual({ kind: 'always' })
    expect(approvalConditionOf([saved(5000, 'other')], 'wf1')).toEqual({ kind: 'none' })
    expect(approvalConditionOf([], 'wf1')).toEqual({ kind: 'none' })
    expect(approvalConditionOf([{ ...saved(5000), active: false }], 'wf1')).toEqual({
      kind: 'none',
    })
  })

  it('the screen writes the rule on creation, and offers «شرط بگذار» to a template without one', () => {
    const container = flat(ui('workflow', 'containers', 'workflow-templates-container.tsx'))
    expect(container).toContain(
      'await createRule(invoiceApprovalRule(template.name, created.id, minTotal))',
    )
    expect(container).toContain(
      'await createRule(invoiceApprovalRule(workflow.name, workflow.id, minTotal))',
    )
    const view = ui('workflow', 'workflow-templates-view.tsx')
    expect(view).toContain('data-condition="none"')
    expect(view).toContain('<ConditionSetter')
  })

  it('no longer claims an active template is enough', () => {
    const fa = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', 'i18n', 'messages', 'fa', 'common.json'),
        'utf8',
      ),
    )
    expect(fa.workflow.templates.description).not.toContain('بدون حداقل یک الگوی فعال')
    expect(fa.workflow.templates.description).toContain('بی‌شرط')
  })
})

describe('a task for the owner', () => {
  it('the option is offered only when the server says the role is owner', () => {
    const container = flat(ui('crm', 'containers', 'crm-container.tsx'))
    expect(container).toContain("const isOwner = useMyCapabilities().data?.role === 'owner'")
    expect(container).toContain('ownerOption={isOwner ? { name: ownerName } : undefined}')
    const view = flat(ui('crm', 'crm-view.tsx'))
    expect(view).toContain('{ownerOption ? ( <SelectItem value={OWNER_ASSIGNEE}')
  })

  it('the owner’s task is sent with no employee id, never as an empty string', () => {
    const container = flat(ui('crm', 'containers', 'crm-container.tsx'))
    expect(container).toContain('await createInteraction(employeeId ? input : rest)')
  })
})
