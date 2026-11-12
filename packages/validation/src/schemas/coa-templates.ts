import type { AccountRole } from './accounting.schema'
import { STANDARD_ACCOUNT_FOR_ROLE } from './standard-accounts'

export type ChartTradeKey =
  'general' | 'retail' | 'services' | 'manufacturing' | 'exchange' | 'gold' | 'pharmacy'

export interface ChartTemplateEntry {
  role: AccountRole
  code: string
  nameKey: string
}

const ALL_ROLES = Object.keys(STANDARD_ACCOUNT_FOR_ROLE) as AccountRole[]

function buildTemplateForTrade(_trade: ChartTradeKey): ChartTemplateEntry[] {
  return ALL_ROLES.map((role) => ({
    role,
    code: STANDARD_ACCOUNT_FOR_ROLE[role]?.code ?? '1000',
    nameKey: `accounting.coa.roles.${role}`,
  }))
}

export const CHART_TEMPLATES_BY_TRADE: Record<ChartTradeKey, readonly ChartTemplateEntry[]> = {
  general: buildTemplateForTrade('general'),
  retail: buildTemplateForTrade('retail'),
  services: buildTemplateForTrade('services'),
  manufacturing: buildTemplateForTrade('manufacturing'),
  exchange: buildTemplateForTrade('exchange'),
  gold: buildTemplateForTrade('gold'),
  pharmacy: buildTemplateForTrade('pharmacy'),
}
