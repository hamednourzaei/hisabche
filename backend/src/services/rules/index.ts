// ============================================
// backend/src/services/rules/index.ts
//
// The Rules Engine core's public surface.
//
// Callers ask what the rules SAY and then act. Nothing here performs a domain
// act, and there is deliberately no action that grants permission: a rule can
// require an approval or block a document, never widen what somebody may do.
// ============================================

export { RulesService } from './rules.service'

export {
  evaluateCondition,
  evaluateGroup,
  evaluateRules,
  orderRules,
  readField,
  summarise,
  validateRule,
  type BusinessRule,
  type Condition,
  type ConditionGroup,
  type ConditionOperator,
  type RuleAction,
  type RuleActionKind,
  type RuleDecision,
  type RuleEntity,
  type RuleFacts,
} from './rules.domain'

import { RulesService } from './rules.service'

/** The one instance the domain asks before it commits a document. */
export const rules = new RulesService()
