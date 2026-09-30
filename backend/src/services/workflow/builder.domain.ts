// ============================================
// Capability #144 — the visual workflow builder's runtime.
// Engine N8.
//
// ⚠️ THIS IS NOT A SECOND WORKFLOW ENGINE. IT IS THE SHAPE OF THE ONE THAT
// EXISTS.
//
// `workflow.service.ts` runs instances, `approval.domain.ts` decides who acts and
// when, and `approval-gate.domain.ts` decides whether the money may move. Those
// are the authority and they are untouched here.
//
// What a BUILDER needs and the engine lacks is a serialisable DEFINITION: the
// steps, the branch conditions and the delays a person drew on a canvas, in a
// form that can be stored, versioned and re-validated. So this module is that
// form — and its most important job is refusing definitions the runtime cannot
// honour, at SAVE time, because a builder that saves a workflow the engine will
// reject is a builder that produces a document nobody can move.
//
// ⚠️ WHY VALIDATION AT SAVE IS THE WHOLE POINT.
//
// `workflow.domain`'s own rule: a template nobody can approve freezes the
// document forever. A drawn workflow that validates on deploy instead of on save
// is the same failure with a canvas around it — and the person drawing it has
// already moved on.
//
// ⚠️ AND EVERY DELAY IS UNBOUNDED FROM ABOVE BY THE SAME RULE THAT GOVERNS
// PERIOD LOCK: a step may never approve itself. A builder that lets someone
// draw "wait 0 hours then auto-approve" produces a document that moved money on a
// timer, which is exactly the approval-that-decides-nothing this product
// removed once already.
export type StepKind =
  /** Ask a role to act. */
  | 'approval'
  /** Run a domain command. Named, never arbitrary. */
  | 'action'
  /** Wait. Bounded, and never leading to an auto-approval. */
  | 'delay'
  /** A question with typed answers. Does not approve anything. */
  | 'form'

export interface WorkflowStepDefinition {
  id: string
  name: string
  kind: StepKind
  /** For `approval`: who must act. One role, never a list. */
  requiredRole?: 'owner' | 'manager' | 'seller'
  /** For `approval`: how long before the step escalates. Zero disables it. */
  escalateAfterHours?: number
  /** For `action`: the command NAME. Resolved by the caller, never invoked here. */
  command?: string
  /** For `delay`: ISO duration, minutes. */
  delayMinutes?: number
  /** For `form`: the fields, as keys only — the schema lives with the entity. */
  fields?: string[]
  /**
   * ⚠️ THE STEP THIS ONE GOES TO ON APPROVAL. Null means the workflow ends,
   * which is only valid when the workflow is not the last gate on a document —
   * and the caller checks that, because this module cannot see the document.
   */
  nextOnApproval?: string | null
  /** Where it goes on refusal. Null ends the workflow. */
  nextOnRefusal?: string | null
}

export interface WorkflowDefinition {
  key: string
  name: string
  /** Bumped on every save. A running instance keeps the version it started on. */
  version: number
  enabled: boolean
  steps: WorkflowStepDefinition[]
  /**
   * ⚠️ WHICH ENTITY THIS GOVERNS, from the closed list the capabilities already
   * define. `approval-gate.domain` knows about `invoice | purchase_order |
   * expense` and nothing else, and a builder that invented a fourth would produce
   * a workflow for a document no gate checks.
   */
  appliesTo: 'invoice' | 'purchase_order' | 'expense'
}

export type DefinitionProblem =
  | 'NO_STEPS'
  | 'DUPLICATE_STEP_ID'
  | 'DANGLING_NEXT'
  | 'APPROVAL_WITHOUT_ROLE'
  | 'ACTION_WITHOUT_COMMAND'
  | 'DELAY_WITHOUT_DURATION'
  | 'DELAY_TOO_LONG'
  | 'STEP_AFTER_END'
  | 'SELF_APPROVAL_POSSIBLE'
  | 'NO_APPROVAL_AT_ALL'
  | 'UNKNOWN_COMMAND'

/** ⚠️ ABOVE THIS A WORKFLOW IS NOT A WORKFLOW. A year-long delay is a stuck document. */
export const MAX_DELAY_MINUTES = 60 * 24 * 30

/**
 * Commands a drawn step may name.
 *
 * ⚠️ THE SET IS CLOSED AND SMALL, and it is the same one the platform's event
 * catalogue already uses. A builder with a free-text command box is a builder
 * that can name any method on any service — and the framework would resolve it.
 */
export const DRAWABLE_COMMANDS: readonly string[] = [
  'invoice.create',
  'invoice.cancel',
  'payment.record',
  'notification.create',
  'inventory.adjust',
  'budget.commit',
]

/**
 * Is this definition one the runtime can actually run?
 *
 * ⚠️ EVERY PROBLEM IS NAMED, because a builder showing «invalid workflow» is a
 * builder a person stops using.
 */
export function validateDefinition(definition: WorkflowDefinition): DefinitionProblem[] {
  const problems: DefinitionProblem[] = []
  const { steps } = definition

  if (steps.length === 0) {
    problems.push('NO_STEPS')
    return problems
  }

  const ids = new Set<string>()
  for (const step of steps) {
    if (ids.has(step.id)) problems.push('DUPLICATE_STEP_ID')
    ids.add(step.id)
  }

  for (const step of steps) {
    if (step.nextOnApproval && step.nextOnApproval !== null && !ids.has(step.nextOnApproval)) {
      problems.push('DANGLING_NEXT')
    }
    if (step.nextOnRefusal && step.nextOnRefusal !== null && !ids.has(step.nextOnRefusal)) {
      problems.push('DANGLING_NEXT')
    }

    switch (step.kind) {
      case 'approval':
        // ⚠️ ONE ROLE, NEVER A LIST. `approval.domain`'s `tierFor` picks the
        // HIGHEST matching threshold; two roles on one step would be resolved by
        // an order nobody drew.
        if (!step.requiredRole) problems.push('APPROVAL_WITHOUT_ROLE')
        break

      case 'action':
        // ⚠️ The command must be one of the closed set, not merely present.
        if (!step.command) problems.push('ACTION_WITHOUT_COMMAND')
        else if (!(DRAWABLE_COMMANDS as readonly string[]).includes(step.command)) {
          problems.push('UNKNOWN_COMMAND')
        }
        break

      case 'delay':
        if (step.delayMinutes === undefined || step.delayMinutes <= 0) {
          problems.push('DELAY_WITHOUT_DURATION')
        } else if (step.delayMinutes > MAX_DELAY_MINUTES) {
          problems.push('DELAY_TOO_LONG')
        }
        break

      case 'form':
        // Nothing to validate: a form cannot approve anything.
        break
    }
  }

  // ⚠️ A WORKFLOW WITH NO APPROVAL IS NOT A WORKFLOW. Every branch here can end
  // without a person having decided, which is the exact condition
  // `approval-gate.domain` exists to prevent.
  if (!steps.some((s) => s.kind === 'approval')) {
    problems.push('NO_APPROVAL_AT_ALL')
  }

  // ⚠️ AND A PATH THAT APPROVES WITHOUT A PERSON — reached by following
  // `nextOnApproval` from an action straight to the end — is refused. A delay
  // followed by the end is the same thing with a timer on it.
  if (canFinishWithoutApproval(steps)) {
    problems.push('SELF_APPROVAL_POSSIBLE')
  }

  return problems
}

/**
 * Can a path reach the end without passing an approval step?
 *
 * ⚠️ A DEPTH-FIRST WALK WITH A VISITED SET, because a workflow is a graph and a
 * drawn one can contain a cycle. A cycle that never reaches an end would hang
 * this check forever, and a guard that hangs is a guard that gets deleted.
 *
 * ⚠️ AND ONLY THE ROUTES THAT EXIST ARE WALKED.
 *
 * The first version used `step.nextOnApproval ?? step.nextOnRefusal`, which is
 * wrong in the most ordinary workflow there is: `nextOnApproval: null` on an
 * approval step means «this is the last step», so `??` fell through to
 * `nextOnRefusal` — which is also null on most steps — and concluded that every
 * approval step ends the workflow without approving anything. A perfectly valid
 * two-approval flow was reported as `SELF_APPROVAL_POSSIBLE`, and a builder
 * showing that on every save is a builder nobody uses.
 *
 * So each pointer is walked on its own, and a null pointer on an APPROVAL step
 * is not an escape: the person acting on that step IS the approval.
 */
function canFinishWithoutApproval(steps: readonly WorkflowStepDefinition[]): boolean {
  const byId = new Map(steps.map((s) => [s.id, s]))

  const walk = (id: string | null | undefined, seen: Set<string>): boolean => {
    if (id === null || id === undefined) return true // the workflow ends here
    if (seen.has(id)) return false // a cycle is not an ending
    seen.add(id)

    const step = byId.get(id)
    // A dangling pointer is a separate problem, validated as DANGLING_NEXT.
    if (!step) return false

    // ⚠️ An approval step IS the approval, whatever it points at.
    if (step.kind === 'approval') return false

    // Both routes, each on its own set — sharing a set between them would let a
    // step visited on the approval route suppress a real escape on the refusal
    // route.
    return walk(step.nextOnApproval, new Set(seen)) || walk(step.nextOnRefusal, new Set(seen))
  }

  return steps.some((step) => {
    if (step.kind === 'approval') return false
    return walk(step.nextOnApproval, new Set()) || walk(step.nextOnRefusal, new Set())
  })
}

/**
 * Which version does a running instance follow?
 *
 * ⚠️ THE VERSION IT STARTED ON. Editing a workflow with a document in flight is
 * normal — a shop fixes a mistake — and switching the running instance to the
 * new definition moves a document from step 2 to step 4 without anybody
 * deciding that. The instance keeps its own copy; the new version applies to
 * documents started afterwards.
 */
export function versionFor(
  instance: { startedAtVersion: number },
  definition: WorkflowDefinition,
): number {
  return Math.min(instance.startedAtVersion, definition.version)
}

/** Whether editing this definition may affect documents already running. */
export function editAffectsRunningDocuments(
  before: WorkflowDefinition,
  after: WorkflowDefinition,
): boolean {
  // ⚠️ ONLY THE SHAPE, and only where it changes a DECISION. Renaming a step
  // does not move a document; changing who must approve it does.
  const shape = (d: WorkflowDefinition) =>
    d.steps.map((s) => `${s.kind}:${s.requiredRole ?? '-'}:${s.nextOnApproval ?? '-'}`).join('|')

  return shape(before) !== shape(after)
}
