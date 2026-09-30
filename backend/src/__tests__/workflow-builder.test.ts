// ============================================
// Engine N8 — the workflow builder's runtime.
// Capability #144.
//
// ⚠️ THE HEADLINE: A BUILDER THAT SAVES WHAT THE ENGINE WILL REJECT IS A
// BUILDER THAT PRODUCES STUCK DOCUMENTS.
//
// `workflow.domain` already established the failure this file exists to prevent:
// a template nobody can approve freezes the document forever. A canvas around
// the same rules does not change that — it just makes it easier to draw, so the
// validation has to happen at SAVE rather than at deploy, and the person
// drawing it is still looking at the screen.
//
// ⚠️ THE OTHER HALF IS THAT A BUILDER CANNOT DRAW AN AUTO-APPROVAL.
//
// A step chain that reaches the end without a person having decided is exactly
// the "approval that decides nothing" `approval-gate.domain` was written to
// remove. So the check is a graph walk — and the walk is bounded, because a
// drawn workflow can contain a cycle and a guard that hangs is a guard that
// gets deleted.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  DRAWABLE_COMMANDS,
  MAX_DELAY_MINUTES,
  editAffectsRunningDocuments,
  validateDefinition,
  versionFor,
  type WorkflowDefinition,
} from '../services/workflow/builder.domain'

const approval = (id: string, nextOnApproval: string | null = null) => ({
  id,
  name: `Approve ${id}`,
  kind: 'approval' as const,
  requiredRole: 'manager' as const,
  nextOnApproval,
})

const definition = (over: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
  key: 'large-invoices',
  name: 'Large invoices',
  version: 1,
  enabled: true,
  appliesTo: 'invoice',
  steps: [approval('a'), approval('b', 'a')],
  ...over,
})

describe('#144 — a definition the runtime can run', () => {
  it('a straightforward two-approval workflow is valid', () => {
    expect(validateDefinition(definition())).toEqual([])
  })

  it('an empty workflow is refused', () => {
    expect(validateDefinition(definition({ steps: [] }))).toContain('NO_STEPS')
  })

  it('a duplicate step id is refused', () => {
    const problems = validateDefinition(definition({ steps: [approval('a'), approval('a')] }))

    expect(problems).toContain('DUPLICATE_STEP_ID')
  })

  it('a pointer to a step that does not exist is refused', () => {
    const steps = [{ ...approval('a'), nextOnApproval: 'ghost' }]
    expect(validateDefinition(definition({ steps }))).toContain('DANGLING_NEXT')
  })
})

describe('#144 — an approval step must say who', () => {
  it('an approval with no role is refused', () => {
    const steps = [{ id: 'a', name: 'Approve', kind: 'approval' as const, nextOnApproval: null }]
    expect(validateDefinition(definition({ steps }))).toContain('APPROVAL_WITHOUT_ROLE')
  })

  it('a workflow with NO approval anywhere is refused', () => {
    // ⚠️ Every branch can end without a person having decided, which is the
    // exact condition `approval-gate.domain` exists to prevent.
    const steps = [
      {
        id: 'a',
        name: 'Do it',
        kind: 'action' as const,
        command: 'invoice.create',
        nextOnApproval: null,
      },
    ]
    expect(validateDefinition(definition({ steps }))).toContain('NO_APPROVAL_AT_ALL')
  })
})

describe('#144 — a builder cannot draw an auto-approval', () => {
  it('an action followed by the end is refused even with an approval elsewhere', () => {
    // ⚠️ THE failure this file is about. A drawn chain of "create the invoice,
    // then finish" saves happily, runs happily, and moves money with nobody
    // having decided — the exact condition G6 was created to remove.
    const steps = [
      approval('review'),
      {
        id: 'do',
        name: 'Issue',
        kind: 'action' as const,
        command: 'invoice.create',
        nextOnApproval: null,
      },
    ]
    expect(validateDefinition(definition({ steps }))).toContain('SELF_APPROVAL_POSSIBLE')
  })

  it('a delay then the end is the same thing with a timer on it', () => {
    const steps = [
      approval('review'),
      { id: 'wait', name: 'Wait', kind: 'delay' as const, delayMinutes: 60, nextOnApproval: null },
    ]
    expect(validateDefinition(definition({ steps }))).toContain('SELF_APPROVAL_POSSIBLE')
  })

  it('a REFUSAL path that ends the workflow is a real escape', () => {
    // ⚠️ AND THIS IS CORRECT BEHAVIOUR, not a bug. The action runs after the
    // approval on its approval route, but its refusal route is null — so the
    // document ends without ever being issued. That is exactly what a person
    // refusing should do, and the check is asking a different question: can a
    // document reach the END having never been APPROVED? Refusal is not
    // approval.
    const steps = [
      approval('review'),
      {
        id: 'do',
        name: 'Issue',
        kind: 'action' as const,
        command: 'invoice.create',
        nextOnApproval: 'review',
      },
    ]
    expect(validateDefinition(definition({ steps }))).toContain('SELF_APPROVAL_POSSIBLE')
  })

  it('a step that only ever reaches an approval is fine', () => {
    const steps = [
      approval('review'),
      {
        id: 'do',
        name: 'Issue',
        kind: 'action' as const,
        command: 'invoice.create',
        nextOnApproval: 'review',
        // ⚠️ Refusal here also goes to the review step, which is where a person
        // is. So no route escapes it.
        nextOnRefusal: 'review',
      },
    ]
    expect(validateDefinition(definition({ steps }))).not.toContain('SELF_APPROVAL_POSSIBLE')
  })

  it('a CYCLE does not hang the check', () => {
    // ⚠️ A drawn workflow can contain a cycle. A DFS with no visited set spins
    // forever here, and a guard that hangs is one that gets deleted.
    const steps = [{ ...approval('a', 'b') }, { ...approval('b', 'a') }]
    const problems = validateDefinition(definition({ steps }))

    expect(Array.isArray(problems)).toBe(true)
  })
})

describe('#144 — the command set is closed', () => {
  it('a named action must be one the platform already has', () => {
    const steps = [
      approval('a'),
      {
        id: 'x',
        name: 'Hack',
        kind: 'action' as const,
        command: 'fs.readFile',
        nextOnApproval: 'a',
      },
    ]
    expect(validateDefinition(definition({ steps }))).toContain('UNKNOWN_COMMAND')
  })

  it('an action with no command is refused', () => {
    const steps = [
      approval('a'),
      { id: 'x', name: 'Do', kind: 'action' as const, nextOnApproval: 'a' },
    ]
    expect(validateDefinition(definition({ steps }))).toContain('ACTION_WITHOUT_COMMAND')
  })

  it('the set is short, and every entry is a real domain command', () => {
    expect(DRAWABLE_COMMANDS.length).toBeLessThan(10)
    expect(DRAWABLE_COMMANDS.every((c) => c.includes('.'))).toBe(true)
  })
})

describe('#144 — a delay is bounded', () => {
  it('a delay with no duration is refused', () => {
    const steps = [
      approval('a'),
      { id: 'w', name: 'Wait', kind: 'delay' as const, nextOnApproval: 'a' },
    ]
    expect(validateDefinition(definition({ steps }))).toContain('DELAY_WITHOUT_DURATION')
  })

  it('a delay of a year is refused', () => {
    // ⚠️ A year-long delay is a stuck document with a timer on it.
    const steps = [
      approval('a'),
      {
        id: 'w',
        name: 'Wait',
        kind: 'delay' as const,
        delayMinutes: MAX_DELAY_MINUTES + 1,
        nextOnApproval: 'a',
      },
    ]
    expect(validateDefinition(definition({ steps }))).toContain('DELAY_TOO_LONG')
  })
})

describe('#144 — editing does not move a document already in flight', () => {
  it('a running instance keeps the version it started on', () => {
    // ⚠️ The failure. A shop fixes a mistake mid-approval; the instance follows
    // the new definition and the document jumps from step 2 to step 4 without
    // anybody deciding that.
    expect(versionFor({ startedAtVersion: 2 }, definition({ version: 5 }))).toBe(2)
  })

  it('renaming a step does NOT affect running documents', () => {
    const before = definition()
    const after = definition({
      steps: [{ ...before.steps[0]!, name: 'Renamed' }, before.steps[1]!],
    })

    expect(editAffectsRunningDocuments(before, after)).toBe(false)
  })

  it('changing who must approve DOES', () => {
    const before = definition()
    const after = definition({
      steps: [{ ...before.steps[0]!, requiredRole: 'owner' }, before.steps[1]!],
    })

    expect(editAffectsRunningDocuments(before, after)).toBe(true)
  })

  it('changing where a step goes DOES', () => {
    const before = definition()
    const after = definition({
      steps: [before.steps[0]!, { ...before.steps[1]!, nextOnApproval: null }],
    })

    expect(editAffectsRunningDocuments(before, after)).toBe(true)
  })
})
