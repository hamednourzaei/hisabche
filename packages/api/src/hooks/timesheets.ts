// ============================================
// Timesheet and project billing hooks — TanStack Query
//
// ---------------------------------------------------------------------------
// MINUTES, NOT HOURS
//
// Every duration crossing this boundary is an integer count of minutes. 1.5
// hours is 90; 1.5 as a float is not exactly representable, and a month of
// them drifts a bill. Formatting to "1h 30m" belongs in the view.
//
// `invoiceId` on an entry IS the lock, not a flag — once set, those hours are
// spoken for. The billing preview shows what WOULD be billed and takes
// nothing; only invoicing does.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

// ═══ Types ═══

export type BillingMethod = 'hourly' | 'fixed' | 'non_billable'

export interface ProjectBillingConfig {
  projectId: string
  method: BillingMethod
  /** Minor units per hour, used when an entry carries no rate of its own. */
  defaultRateMinor: number
  /** Minor units. A cap on what may be billed in total. */
  budgetCapMinor?: number | null
}

export interface TimeTotals {
  recordedMinutes: number
  billableMinutes: number
  /** Already on an invoice. */
  billedMinutes: number
  /** Billable and not yet invoiced — what can be billed right now. */
  unbilledMinutes: number
  unbilledAmountMinor: number
}

export interface BillableLine {
  projectId: string
  employeeId: string
  entryIds: string[]
  minutes: number
  rateMinor: number
  /** Minor units. minutes ÷ 60 × rate, rounded ONCE at the end. */
  amountMinor: number
  description: string
}

export interface ProjectProfitability {
  projectId: string
  revenueMinor: number
  /** Employee time at COST, not at the billing rate. */
  labourCostMinor: number
  expenseMinor: number
  marginMinor: number
  marginPercent: number | null
  /** Hours worked that will never be billed. The real leak on fixed price. */
  unbillableMinutes: number
}

export interface LogTimeInput {
  projectId: string
  taskId?: string | null
  employeeId: string
  onDate: string
  /** Minutes. Integer. */
  minutes: number
  billable?: boolean
  rateMinor?: number | null
  description?: string
}

export const timesheetKeys = {
  all: ['timesheets'] as const,
  summary: (projectId: string) => [...timesheetKeys.all, 'summary', projectId] as const,
  preview: (projectId: string) => [...timesheetKeys.all, 'preview', projectId] as const,
  profitability: (projectId: string) => [...timesheetKeys.all, 'profitability', projectId] as const,
}

// ═══ Queries ═══

export function useTimesheetSummary(projectId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: timesheetKeys.summary(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/operations/timesheets/${projectId}`)
      return data as { projectId: string; config: ProjectBillingConfig; totals: TimeTotals }
    },
    enabled: ready && Boolean(projectId),
    staleTime: 30_000,
  })
}

/**
 * The invoice lines this project's unbilled time WOULD produce.
 *
 * `problems` is not a validation error list to hide — it names the reasons
 * hours cannot be billed (no rate, a non-billable project, a budget cap
 * already reached), which is exactly what the person about to invoice needs.
 */
export function useBillingPreview(projectId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: timesheetKeys.preview(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/operations/timesheets/${projectId}/billing-preview`)
      return data as { projectId: string; problems: string[]; lines: BillableLine[] }
    },
    enabled: ready && Boolean(projectId),
    staleTime: 0,
  })
}

export function useProjectProfitability(projectId: string) {
  const ready = useAuthReady()

  return useQuery({
    queryKey: timesheetKeys.profitability(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/operations/timesheets/${projectId}/profitability`)
      return data as ProjectProfitability
    },
    enabled: ready && Boolean(projectId),
    staleTime: 60_000,
  })
}

// ═══ Mutations ═══

export function useLogTime() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: LogTimeInput) => {
      const { data } = await apiClient.post('/operations/timesheets', input)
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: timesheetKeys.summary(variables.projectId) })
      queryClient.invalidateQueries({ queryKey: timesheetKeys.preview(variables.projectId) })
    },
  })
}

export function useSaveBillingConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ProjectBillingConfig) => {
      const { data } = await apiClient.put('/operations/timesheets/config', input)
      return data as ProjectBillingConfig
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: timesheetKeys.all })
      queryClient.invalidateQueries({ queryKey: timesheetKeys.summary(variables.projectId) })
    },
  })
}
