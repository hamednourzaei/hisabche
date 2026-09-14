// ============================================
// backend/src/services/authorization/index.ts
//
// The Authorization Core's public surface.
//
// Everything here is pure. There is no repository and no cache on purpose: an
// authorization decision that depends on a cached row is an authorization
// decision that can be stale, and a stale "yes" is the only kind that matters.
//
// The inputs are the verified TenancyContext's role and the row in hand.
// ============================================

export {
  ACCESS_LEVELS,
  CAPABILITIES,
  PERMISSION_MODULES,
  ROLE_RANK,
  capabilitiesForLevel,
  levelOfCapabilities,
  can,
  minRoleFor,
  capabilitiesOf,
  holds,
  effectiveCapabilities,
  OWNER_LOCKED_CAPABILITIES,
  type CapabilityOverride,
  deniedFields,
  maskForRead,
  maskRowsForRead,
  mayTouchRecord,
  recordScope,
  rejectedWriteFields,
  roleAtLeast,
  type AccessLevel,
  type Capability,
  type FieldMode,
  type ModuleSpec,
  type RecordScope,
  type ScopedEntity,
  type WorkspaceRole,
} from './authorization.domain'

export {
  DEFAULT_SOD_SETTINGS,
  SOD_RULES,
  activeRules,
  checkSoD,
  validateOverride,
  type PriorAction,
  type SoDMode,
  type SoDRule,
  type SoDSettings,
  type SoDVerdict,
} from './sod.domain'

export { SoDService } from './sod.service'

import { SoDService } from './sod.service'

/**
 * The one instance guarded actions check through.
 *
 * Segregation of duties is a question about a PERSON and a DOCUMENT, not about
 * a role, so it cannot live in the route middleware next to `requireCapability`
 * — the document is not known until the handler has one.
 */
export const sod = new SoDService()

export {
  authorize,
  branchFilterFor,
  mayWriteToBranch,
  type ActorScope,
  type ResourceScope,
  type ScopeDecision,
} from './scope.domain'

export { ScopeService, scopes } from './scope.service'

export {
  explain,
  wouldAHigherRoleHelp,
  type Explanation,
  type ExplainableRefusal,
} from './explain.domain'
