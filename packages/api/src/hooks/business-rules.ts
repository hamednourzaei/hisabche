// ============================================
// packages/api/src/hooks/business-rules.ts
//
// The rules engine (`/api/rules`) had a route and NO caller in any client
// (owner, 18 Oct 2026: «شرط گذاشتم، چند فاکتور زدم، تأیید نخواست»). An
// invoice waits for approval only when a rule says so and names the template
// — and nothing could write that rule. The approval-template screen now does,
// through these two hooks; it is the only place in the app that writes rules.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type RuleEntity =
  'invoice' | 'payment' | 'purchase_order' | 'journal_entry' | 'customer' | 'product'

export interface RuleCondition {
  field: string
  operator:
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
  value?: unknown
}

export interface BusinessRule {
  id: string
  name: string
  entity: RuleEntity
  conditions: { match: 'all' | 'any'; conditions: RuleCondition[] }
  actions: Array<{ kind: string; workflowId?: string | undefined }>
  priority: number
  active: boolean
}

export const ruleKeys = {
  all: ['business-rules'] as const,
  list: (entity: RuleEntity) => [...ruleKeys.all, entity] as const,
}

/** The rules of one kind of document. A failed read is an error, never «none». */
export function useBusinessRules(entity: RuleEntity) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: ruleKeys.list(entity),
    queryFn: async () => {
      const { data } = await apiClient.get('/rules', { params: { entity } })
      return asList<BusinessRule>(data)
    },
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useCreateBusinessRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      entity: RuleEntity
      conditions: BusinessRule['conditions']
      actions: BusinessRule['actions']
    }) => {
      const { data } = await apiClient.post('/rules', input)
      return data as BusinessRule
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ruleKeys.all }),
  })
}
