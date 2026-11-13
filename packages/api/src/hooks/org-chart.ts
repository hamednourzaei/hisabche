// ============================================
// packages/api/src/hooks/org-chart.ts
//
// V61 B.2.17 — who reports to whom, and each employee's file: documents and
// appraisals. Rows are the database's, snake_case (`first_name`, not `name`):
// typing them camelCase blanked every name once before (CLAUDE.md §8).
//
// ⚠️ The org chart is SCOPED by the server: owner, admin and manager see
// everyone; anyone else sees themself and the people under them.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '../lib/client'
import { asList } from '../lib/as-list'
import { responseBody } from '../lib/response-body'
import { useAuthReady } from './useAuthReady'

export interface OrgChartEntry {
  id: string
  first_name: string
  last_name: string
  position: string | null
  department_id: string | null
  reports_to: string | null
}

export interface EmployeeDocument {
  id: string
  employee_id: string
  title: string
  kind: string
  file_url: string
  created_at: string
}

export interface AppraisalCriterion {
  label: string
  observation: string
}

/** Append-only: an appraisal is never edited (database trigger). */
export interface EmployeeAppraisal {
  id: string
  employee_id: string
  reviewer_id: string
  period: string
  criteria: AppraisalCriterion[]
  notes: string | null
  created_at: string
}

export const orgChartKeys = {
  all: ['org-chart'] as const,
  chart: () => [...orgChartKeys.all, 'chart'] as const,
  documents: (employeeId: string) => [...orgChartKeys.all, 'documents', employeeId] as const,
  appraisals: (employeeId: string) => [...orgChartKeys.all, 'appraisals', employeeId] as const,
}

export function useOrgChart() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: orgChartKeys.chart(),
    queryFn: async () =>
      asList<OrgChartEntry>(
        responseBody<unknown>(await apiClient.get('/employees/org-chart')),
        'org-chart',
      ),
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useSetReportsTo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { employeeId: string; reportsTo: string | null }) =>
      responseBody<{ id: string; reports_to: string | null }>(
        await apiClient.patch(`/employees/${input.employeeId}/reports-to`, {
          reports_to: input.reportsTo,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgChartKeys.chart() })
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useEmployeeDocuments(employeeId: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: orgChartKeys.documents(employeeId ?? ''),
    queryFn: async () =>
      asList<EmployeeDocument>(
        responseBody<unknown>(await apiClient.get(`/employees/${employeeId}/documents`)),
        'employee-documents',
      ),
    enabled: authReady && Boolean(employeeId),
    staleTime: 30_000,
  })
}

export function useAddEmployeeDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      employeeId: string
      title: string
      kind: string
      file_url: string
    }) => {
      const { employeeId, ...body } = input
      return responseBody<EmployeeDocument>(
        await apiClient.post(`/employees/${employeeId}/documents`, body),
      )
    },
    onSuccess: (_row, input) =>
      void queryClient.invalidateQueries({ queryKey: orgChartKeys.documents(input.employeeId) }),
  })
}

export function useEmployeeAppraisals(employeeId: string | null) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: orgChartKeys.appraisals(employeeId ?? ''),
    queryFn: async () =>
      asList<EmployeeAppraisal>(
        responseBody<unknown>(await apiClient.get(`/employees/${employeeId}/appraisals`)),
        'employee-appraisals',
      ),
    enabled: authReady && Boolean(employeeId),
    staleTime: 30_000,
  })
}

export function useCreateAppraisal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      employeeId: string
      period: string
      criteria: AppraisalCriterion[]
      notes?: string | undefined
    }) => {
      const { employeeId, ...body } = input
      return responseBody<EmployeeAppraisal>(
        await apiClient.post(`/employees/${employeeId}/appraisals`, body),
      )
    },
    onSuccess: (_row, input) =>
      void queryClient.invalidateQueries({ queryKey: orgChartKeys.appraisals(input.employeeId) }),
  })
}
