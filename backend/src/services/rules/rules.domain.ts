// ============================================
// backend/src/services/rules/rules.domain.ts
//
// Business rules a workspace can change without a deploy.
//
// ---------------------------------------------------------------------------
// WHAT A RULE MAY AND MAY NOT DO
//
// A rule produces a DECISION. It never performs one. "Discount over 15% needs
// the sales manager" is a rule; applying the discount, starting the approval,
// and refusing the save are all the domain's job.
//
// That separation is the whole design, and it is what keeps three of the
// golden rules true at once:
//
//   * authoritative financial logic stays in the domain — a rule can propose
//     a 3% loyalty discount, it cannot compute an invoice total
//   * a rule can never grant authorization — `require_approval` and `block`
//     narrow what happens; there is deliberately no `allow` action
//   * every decision is explainable — each one names the rule that produced it
//
// ---------------------------------------------------------------------------
// NO EVAL, EVER
//
// Conditions are a closed set of operators over named fields. A rule engine
// that evaluates strings is a remote code execution feature that the customer
// configures themselves. Nothing here parses an expression.
// ============================================

export type RuleEntity =
  'invoice' | 'payment' | 'purchase_order' | 'journal_entry' | 'customer' | 'product'

/** The closed set. Adding one is a code change, on purpose. */
export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'between'
  | 'is_empty'
  | 'is_not_empty'

export interface Condition {
  /** A dotted path into the facts, e.g. `customer.segment`, `invoice.total`. */
  field: string
  operator: ConditionOperator
  value?: unknown | undefined
}

export interface ConditionGroup {
  /** `all` is AND, `any` is OR. Nesting is one level, deliberately. */
  match: 'all' | 'any'
  conditions: Condition[]
}

export type RuleActionKind =
  'require_approval' | 'block' | 'warn' | 'suggest_discount' | 'notify' | 'tag'

export interface RuleAction {
  kind: RuleActionKind
  /** Which approval chain, for `require_approval`. */
  workflowId?: string | undefined
  /** Percent, for `suggest_discount`. Never applied here. */
  percent?: number | undefined
  /** A message KEY, never a sentence — the client translates it. */
  messageKey?: string | undefined
  value?: string | undefined
}

export interface BusinessRule {
  id: string
  workspaceId: string
  name: string
  entity: RuleEntity
  conditions: ConditionGroup
  actions: RuleAction[]
  /** Lower runs first. Ties break on id so the order never varies by run. */
  priority: number
  active: boolean
  /** Stop evaluating further rules once this one matches. */
  stopOnMatch?: boolean | undefined
}

/** The values a rule is evaluated against. Assembled by the caller. */
export type RuleFacts = Record<string, unknown>

// ─── Evaluation ──────────────────────────────────────────────────────────────

/** Read `a.b.c` out of the facts. Missing anywhere yields undefined. */
export function readField(facts: RuleFacts, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, facts)
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * One condition against the facts.
 *
 * A comparison whose operands are not comparable is FALSE, never true. A rule
 * that fires because a field was missing is worse than one that never fires:
 * the first blocks work nobody can explain, the second is visibly not working.
 */
export function evaluateCondition(condition: Condition, facts: RuleFacts): boolean {
  const actual = readField(facts, condition.field)

  switch (condition.operator) {
    case 'is_empty':
      return actual === undefined || actual === null || actual === ''
    case 'is_not_empty':
      return !(actual === undefined || actual === null || actual === '')

    case 'eq':
      return sameValue(actual, condition.value)
    case 'neq':
      return !sameValue(actual, condition.value)

    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const left = asNumber(actual)
      const right = asNumber(condition.value)
      if (left === null || right === null) return false

      if (condition.operator === 'gt') return left > right
      if (condition.operator === 'gte') return left >= right
      if (condition.operator === 'lt') return left < right
      return left <= right
    }

    case 'in':
      return Array.isArray(condition.value) && condition.value.some((v) => sameValue(actual, v))
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.some((v) => sameValue(actual, v))

    case 'contains':
      if (Array.isArray(actual)) return actual.some((v) => sameValue(v, condition.value))
      if (typeof actual === 'string' && typeof condition.value === 'string') {
        return actual.toLowerCase().includes(condition.value.toLowerCase())
      }
      return false

    case 'between': {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) return false
      const left = asNumber(actual)
      const low = asNumber(condition.value[0])
      const high = asNumber(condition.value[1])
      if (left === null || low === null || high === null) return false
      return left >= low && left <= high
    }

    default:
      // An operator we do not know is not a licence to fire.
      return false
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  const a = asNumber(left)
  const b = asNumber(right)
  // Money is a string from Postgres and a number from a client.
  if (a !== null && b !== null) return Math.round(a * 100) === Math.round(b * 100)
  return String(left ?? '') === String(right ?? '')
}

export function evaluateGroup(group: ConditionGroup, facts: RuleFacts): boolean {
  // An empty condition list matches NOTHING. A rule with no conditions that
  // fired on everything would be the most destructive possible default.
  if (group.conditions.length === 0) return false

  return group.match === 'all'
    ? group.conditions.every((condition) => evaluateCondition(condition, facts))
    : group.conditions.some((condition) => evaluateCondition(condition, facts))
}

export interface RuleDecision {
  ruleId: string
  ruleName: string
  action: RuleAction
}

/** Deterministic order: priority, then id. Never insertion or fetch order. */
export function orderRules(rules: BusinessRule[]): BusinessRule[] {
  return [...rules].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * Every decision this set of rules produces for these facts.
 *
 * Decisions, in order. The caller applies them — and because each one names
 * its rule, "why did this invoice need approval" has an answer.
 */
export function evaluateRules(
  rules: BusinessRule[],
  entity: RuleEntity,
  facts: RuleFacts,
): RuleDecision[] {
  const decisions: RuleDecision[] = []

  for (const rule of orderRules(rules)) {
    if (!rule.active || rule.entity !== entity) continue
    if (!evaluateGroup(rule.conditions, facts)) continue

    for (const action of rule.actions) {
      decisions.push({ ruleId: rule.id, ruleName: rule.name, action })
    }

    if (rule.stopOnMatch) break
  }

  return decisions
}

/** The most restrictive outcome the decisions imply. */
export function summarise(decisions: RuleDecision[]): {
  blocked: boolean
  requiresApproval: boolean
  workflowIds: string[]
  warnings: RuleDecision[]
} {
  return {
    blocked: decisions.some((d) => d.action.kind === 'block'),
    requiresApproval: decisions.some((d) => d.action.kind === 'require_approval'),
    workflowIds: [
      ...new Set(
        decisions
          .filter((d) => d.action.kind === 'require_approval' && d.action.workflowId)
          .map((d) => d.action.workflowId as string),
      ),
    ],
    warnings: decisions.filter((d) => d.action.kind === 'warn'),
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type RuleRuleCode =
  | 'RULE_NAME_REQUIRED'
  | 'RULE_NO_CONDITIONS'
  | 'RULE_NO_ACTIONS'
  | 'RULE_FIELD_INVALID'
  | 'RULE_OPERATOR_INVALID'
  | 'RULE_VALUE_REQUIRED'
  | 'RULE_APPROVAL_NEEDS_WORKFLOW'
  | 'RULE_DISCOUNT_OUT_OF_RANGE'
  | 'RULE_TOO_MANY_CONDITIONS'

const FIELD_PATTERN = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*){0,3}$/i
const MAX_CONDITIONS = 20

const VALUELESS: ConditionOperator[] = ['is_empty', 'is_not_empty']

export function validateRule(rule: {
  name?: string
  conditions?: ConditionGroup
  actions?: RuleAction[]
}): RuleRuleCode[] {
  const problems: RuleRuleCode[] = []

  if (!rule.name || rule.name.trim().length === 0) problems.push('RULE_NAME_REQUIRED')

  const conditions = rule.conditions?.conditions ?? []
  if (conditions.length === 0) problems.push('RULE_NO_CONDITIONS')
  if (conditions.length > MAX_CONDITIONS) problems.push('RULE_TOO_MANY_CONDITIONS')

  for (const condition of conditions) {
    if (!FIELD_PATTERN.test(condition.field ?? '')) problems.push('RULE_FIELD_INVALID')

    const known: ConditionOperator[] = [
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'not_in',
      'contains',
      'between',
      'is_empty',
      'is_not_empty',
    ]
    if (!known.includes(condition.operator)) problems.push('RULE_OPERATOR_INVALID')

    if (!VALUELESS.includes(condition.operator) && condition.value === undefined) {
      problems.push('RULE_VALUE_REQUIRED')
    }
  }

  const actions = rule.actions ?? []
  if (actions.length === 0) problems.push('RULE_NO_ACTIONS')

  for (const action of actions) {
    // An approval requirement with no chain behind it blocks the document and
    // gives nobody the ability to unblock it.
    if (action.kind === 'require_approval' && !action.workflowId) {
      problems.push('RULE_APPROVAL_NEEDS_WORKFLOW')
    }

    if (action.kind === 'suggest_discount') {
      const percent = action.percent
      if (percent === undefined || percent <= 0 || percent > 100) {
        problems.push('RULE_DISCOUNT_OUT_OF_RANGE')
      }
    }
  }

  return [...new Set(problems)]
}
