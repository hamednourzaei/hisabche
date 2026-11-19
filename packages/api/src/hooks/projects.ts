// ============================================
// packages/api/src/hooks/projects.ts
// FIXED: اضافه شدن Realtime روی جداول projects و project_tasks.
//
// نکته: چون projects و project_tasks دو جدول کاملاً جدا در
// دیتابیس هستند (نه یک entity با namespace فرعی مثل ledger)، دو
// subscription realtime مستقل لازم است — یکی در useProjects (برای
// جدول projects) و یکی در useProjectTasks (برای جدول project_tasks).
// این با الگوی invoices/products/customers فرق دارد چون آن‌ها
// فقط یک جدول داشتند.
// ============================================
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applyOptimisticPatch, rollbackOptimisticPatch } from '../lib/optimistic'
import { apiClient, localRequest } from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'

export const projectKeys = {
  all: ['projects'] as const,
  list: (params?: { status?: string }) => [...projectKeys.all, 'list', params] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

export function useProjects(params?: { status?: string } | undefined) {
  const authReady = useAuthReady()

  // ✅ FIX: subscription realtime برای جدول projects — با
  // projectKeys.all، هم لیست‌ها (با هر params) و هم جزئیات یک
  // پروژه‌ی خاص پوشش داده می‌شوند.
  useRealtime({ table: 'projects', queryKey: projectKeys.all as unknown as string[] })

  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/projects', { params: params ?? undefined })
      return data
    },
    enabled: authReady,
    staleTime: 30_000,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data } = await apiClient.post('/projects', values)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/projects/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

// ─── Tasks ──────────────────────────────────────────────────
export const projectTaskKeys = {
  all: ['project-tasks'] as const,
  list: (projectId: string) => [...projectTaskKeys.all, projectId] as const,
}

export function useProjectTasks(projectId: string) {
  const authReady = useAuthReady()

  // ✅ FIX: subscription realtime مستقل برای جدول project_tasks —
  // جدا از projects چون entity/جدول کاملاً متفاوتی است. توجه: اسم
  // جدول در Supabase با underscore است (project_tasks)، در حالی که
  // projectTaskKeys از خط‌تیره در query key استفاده می‌کند
  // ("project-tasks") — این دو با هم بی‌ربط‌اند: اولی اسم جدول
  // دیتابیس برای subscribeToChannel است، دومی صرفاً یک شناسه‌ی
  // داخلی TanStack Query.
  useRealtime({ table: 'project_tasks', queryKey: projectTaskKeys.all as unknown as string[] })

  return useQuery({
    queryKey: projectTaskKeys.list(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/tasks`)
      return data
    },
    enabled: authReady && !!projectId,
  })
}

export function useCreateProjectTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const projectId = values.projectId
      const { data } = await apiClient.post(`/projects/${projectId}/tasks`, values)
      return data
    },
    // ✅ FIX: علاوه بر لیست وظایف، کش پروژه (که فیلد progress در آن است)
    // نیز invalidate می‌شود تا درصد پیشرفت پس از افزودن/تغییر/حذف وظیفه
    // بدون رفرش دستی صفحه به‌روز بماند.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectTaskKeys.all })
      qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUpdateProjectTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.patch(`/tasks/${id}`, values)
      return data
    },
    // Optimistic: a task's title, status or assignee is not money.
    onMutate: ({ id, ...values }) => applyOptimisticPatch(qc, projectTaskKeys.all, id, values),
    onError: (_error, _vars, snapshot) => rollbackOptimisticPatch(qc, snapshot),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: projectTaskKeys.all })
      qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useDeleteProjectTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectTaskKeys.all })
      qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

// ─── Single Project ─────────────────────────────────────────
// ⚠️ توجه: این هوک عمداً subscription realtime جدای خودش را ندارد.
// به‌روزرسانی realtime آن از طریق subscription موجود در
// useProjects (که باید در همان صفحه mount باشد) تأمین می‌شود.
export function useProject(id: string) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${id}`)
      return data
    },
    enabled: authReady && !!id,
  })
}

export function useUpdateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.patch(`/projects/${id}`, values)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

// ─── Project Members & Time Entries & Milestone Billing ─────
export const projectMembersKeys = {
  all: ['project-members'] as const,
  list: (projectId: string) => [...projectMembersKeys.all, projectId] as const,
}

export const projectTimeEntriesKeys = {
  all: ['project-time-entries'] as const,
  list: (projectId: string) => [...projectTimeEntriesKeys.all, projectId] as const,
}

export function useProjectMembers(projectId: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: projectMembersKeys.list(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/members`)
      return data as Array<Record<string, unknown>>
    },
    enabled: authReady && Boolean(projectId),
  })
}

export function useAddProjectMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      ...values
    }: { projectId: string } & Record<string, unknown>) => {
      const { data } = await apiClient.post(`/projects/${projectId}/members`, values)
      return data
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: projectMembersKeys.list(vars.projectId) }),
  })
}

export function useRemoveProjectMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ projectId, memberId }: { projectId: string; memberId: string }) => {
      await apiClient.delete(`/projects/${projectId}/members/${memberId}`)
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: projectMembersKeys.list(vars.projectId) }),
  })
}

export function useProjectTimeEntries(projectId: string) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: projectTimeEntriesKeys.list(projectId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/projects/${projectId}/time-entries`)
      return data as Array<Record<string, unknown>>
    },
    enabled: authReady && Boolean(projectId),
  })
}

export function useCreateProjectTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      ...values
    }: { projectId: string } & Record<string, unknown>) => {
      const { data } = await apiClient.post(`/projects/${projectId}/time-entries`, values)
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: projectTimeEntriesKeys.list(vars.projectId) })
      qc.invalidateQueries({ queryKey: ['timesheets'] })
    },
  })
}

export function useUpdateProjectTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.patch(`/time-entries/${id}`, values)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectTimeEntriesKeys.all })
      qc.invalidateQueries({ queryKey: ['timesheets'] })
    },
  })
}

export function useDeleteProjectTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/time-entries/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectTimeEntriesKeys.all })
      qc.invalidateQueries({ queryKey: ['timesheets'] })
    },
  })
}

export function useBillProjectMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      ...input
    }: {
      projectId: string
      customerId?: string | undefined
      milestoneTitle?: string | undefined
      milestoneAmount?: number | undefined
      paymentMethod?: 'cash' | 'bank' | 'credit' | undefined
      date?: string | undefined
    }) => {
      const { data } = await apiClient.post(`/projects/${projectId}/bill`, input)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheets'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

// ─── WP-15: offline project time & milestones ───────────────────────
// These go through localRequest (the device transport door), not apiClient:
// a project manager records time without signal; the server issues the invoice.
export interface LocalProjectRow {
  id: string
  name: string
  customer_id: string | null
  currency: string
  budget_minor: number
  status: string
}
export interface LocalTimeEntry {
  id: string
  project_id: string
  hours: number
  rate_minor: number
  billable: number
  approved: number
  work_date: string
}

export function useLocalProjects() {
  return useQuery({
    queryKey: [...projectKeys.all, 'local'],
    queryFn: async () =>
      (await localRequest<{ data?: LocalProjectRow[] }>('GET', '/local-projects'))?.data ?? [],
  })
}

export function useLocalProjectTime(projectId: string | null) {
  return useQuery({
    queryKey: [...projectKeys.all, 'time', projectId ?? ''],
    queryFn: async () =>
      (
        await localRequest<{ data?: LocalTimeEntry[] }>(
          'GET',
          `/local-projects/${projectId}/time-entries`,
        )
      )?.data ?? [],
    enabled: Boolean(projectId),
  })
}

export function useLocalProjectCost(projectId: string | null) {
  return useQuery({
    queryKey: [...projectKeys.all, 'cost', projectId ?? ''],
    queryFn: async () =>
      (await localRequest<{ cost: unknown; variance: unknown }>(
        'GET',
        `/local-projects/${projectId}/cost`,
      ))!,
    enabled: Boolean(projectId),
  })
}

export function useLocalProjectBilling(projectId: string | null) {
  return useQuery({
    queryKey: [...projectKeys.all, 'billing', projectId ?? ''],
    queryFn: async () =>
      (await localRequest<{ time: unknown; milestones: unknown[] }>(
        'GET',
        `/local-projects/${projectId}/billing`,
      ))!,
    enabled: Boolean(projectId),
  })
}

export function useRecordProjectTime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      projectId: string
      hours: number
      rateMinor: number
      workDate?: string
    }) =>
      (await localRequest<LocalTimeEntry>(
        'POST',
        `/local-projects/${input.projectId}/time-entries`,
        input,
      ))!,
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

export function useApproveProjectTime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entryId: string) =>
      (await localRequest<LocalTimeEntry>(
        'POST',
        `/local-projects/time-entries/${entryId}/approve`,
        {},
      ))!,
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}
