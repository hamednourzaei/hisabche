// ============================================
// backend/src/services/personalization/index.ts
//
// The Personalization core's public surface.
//
// Everything it exports narrows what the authorization core already allowed.
// Nothing here can widen access, and no caller should ever consult a profile
// BEFORE the authorization check — the order is authorization, then visibility.
// ============================================

export { VisibilityService } from './visibility.service'

export {
  applyPatch,
  emptyProfile,
  hiddenKeys,
  isVisible,
  resolveVisibility,
  suggestFrom,
  validatePatch,
  type Suggestion,
  type SuggestionKind,
  type UiVisibilityProfile,
  type UsageSignal,
  type VisibilityLevel,
} from './visibility.domain'

import { VisibilityService } from './visibility.service'

export const visibility = new VisibilityService()
