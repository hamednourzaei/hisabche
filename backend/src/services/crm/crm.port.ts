// ============================================
// backend/src/services/crm/crm.port.ts
//
// How the rest of the system uses CRM. Callers (customer pages, the AI
// assistant, invoice/payment follow-ups) ask for a customer's relationship
// picture; they never read `interactions` / `opportunities` themselves.
// ============================================

import type { TenancyContext } from '../tenancy.service'
import type { CustomerCrmSummary, Interaction, Opportunity } from './crm.domain'

export interface OpportunityActivity {
  id: string
  title: string
  stage: string | null
  createdAt: string
  /** Latest interaction linked to the opportunity, if any. */
  lastActivityAt: string | null
}

export interface CrmPort {
  /** Open opportunities (not won / lost) and when each was last worked on. */
  listOpenOpportunityActivity(ctx: TenancyContext): Promise<OpportunityActivity[]>

  /** Every task (primary or on the snapshot) and opportunity of one customer, with totals. */
  getCustomerCrm(
    ctx: TenancyContext,
    customerId: string,
  ): Promise<{
    summary: CustomerCrmSummary
    interactions: Interaction[]
    opportunities: Opportunity[]
  }>
}
