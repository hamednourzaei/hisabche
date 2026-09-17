// ============================================
// backend/src/services/crm/index.ts — the CRM Core's only public surface.
// Nothing outside this folder imports crm.repository / crm.service directly.
// ============================================

import { CrmService } from './crm.service'
import type { CrmPort } from './crm.port'

export { CrmService, CRM_CACHE_PREFIXES } from './crm.service'
export type { CrmPort, OpportunityActivity } from './crm.port'
export {
  INTERACTION_STATUSES,
  OPPORTUNITY_STAGES,
  isOpenStage,
  summarizeCustomerCrm,
  type CustomerCrmSummary,
  type Interaction,
  type InteractionStatus,
  type Opportunity,
  type OpportunityStage,
} from './crm.domain'

/** The shared instance other Cores and routes use. */
export const crm: CrmService & CrmPort = new CrmService()
