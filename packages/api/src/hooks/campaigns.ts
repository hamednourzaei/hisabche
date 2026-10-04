// ============================================
// Customer campaigns and NPS (#106, #112).
//
//   GET  /campaigns
//   POST /campaigns
//   GET  /campaigns/:id
//   GET  /campaigns/:id/preview
//   POST /campaigns/:id/launch
//   POST /campaigns/:id/cancel
//
// …and the recipient's own page, with no session (the token is the credential):
//
//   GET  /public/feedback/:token
//   POST /public/feedback/:token/answer
//   POST /public/feedback/:token/unsubscribe
//
// Delivery is read from the server's email outbox: `sent` is what the mail
// provider accepted, never an assumption. `score: null` = nobody answered.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import apiClient from '../lib/client'
import { asList } from '../lib/as-list'
import { useAuthReady } from './useAuthReady'

export type CampaignKind = 'message' | 'nps'
export type CampaignSegment = 'all' | 'overdue' | 'recent_buyers' | 'inactive'
export type CampaignLanguage = 'fa' | 'af' | 'en'

export interface CampaignInput {
  name: string
  kind: CampaignKind
  subject: string
  body: string
  language: CampaignLanguage
  segment: CampaignSegment
  segmentDays: number | null
}

export interface Campaign extends CampaignInput {
  id: string
  status: 'draft' | 'sent' | 'cancelled'
  createdAt: string
  sentAt: string | null
}

export interface CampaignChannel {
  email: { configured: boolean }
}

export interface CampaignPreview {
  total: number
  sendable: number
  noEmail: number
  invalidEmail: number
  optedOut: number
  limit: number
  tooLarge: boolean
  channel: CampaignChannel
}

export interface CampaignDetail {
  campaign: Campaign
  delivery: {
    queued: number
    sent: number
    pending: number
    failed: number
    unknown: number
    skipped: { noEmail: number; invalidEmail: number; optedOut: number }
  }
  nps: null | {
    score: number | null
    counts: { promoters: number; passives: number; detractors: number; respondents: number }
    population: number
    reason: null | 'NO_RESPONSES'
    comments: Array<{ score: number; comment: string; answeredAt: string }>
  }
}

export interface FeedbackView {
  businessName: string
  asksForScore: boolean
  answered: boolean
  canAnswer: boolean
  unsubscribed: boolean
}

export const campaignKeys = {
  all: ['campaigns'] as const,
  list: () => [...campaignKeys.all, 'list'] as const,
  detail: (id: string) => [...campaignKeys.all, 'detail', id] as const,
  preview: (id: string) => [...campaignKeys.all, 'preview', id] as const,
  feedback: (token: string) => ['public-feedback', token] as const,
}

export function useCampaigns() {
  const ready = useAuthReady()
  return useQuery({
    queryKey: campaignKeys.list(),
    queryFn: async (): Promise<{ campaigns: Campaign[]; channel: CampaignChannel }> => {
      const { data } = await apiClient.get<{ campaigns: Campaign[]; channel: CampaignChannel }>(
        '/campaigns',
      )
      return { campaigns: asList<Campaign>(data?.campaigns), channel: data.channel }
    },
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useCampaignDetail(id: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: campaignKeys.detail(id ?? ''),
    queryFn: async (): Promise<CampaignDetail> => {
      const { data } = await apiClient.get<CampaignDetail>(`/campaigns/${id}`)
      return data.nps
        ? { ...data, nps: { ...data.nps, comments: asList(data.nps.comments) } }
        : data
    },
    enabled: ready && !!id,
    // Delivery moves while the outbox drains: never shown from long ago.
    staleTime: 10_000,
  })
}

export function useCampaignPreview(id: string | null) {
  const ready = useAuthReady()
  return useQuery({
    queryKey: campaignKeys.preview(id ?? ''),
    queryFn: async () => (await apiClient.get<CampaignPreview>(`/campaigns/${id}/preview`)).data,
    enabled: ready && !!id,
    staleTime: 0,
  })
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CampaignInput) =>
      (await apiClient.post<Campaign>('/campaigns', input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  })
}

export function useLaunchCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<{ queued: number; skipped: number }>(`/campaigns/${id}/launch`, {}))
        .data,
    // Settled: a refused launch («already sent») also means the list is stale.
    onSettled: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  })
}

export function useCancelCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<Campaign>(`/campaigns/${id}/cancel`, {})).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: campaignKeys.all }),
  })
}

// ─── The recipient's page: public, no session ───────────────────────────────

export function useFeedbackView(token: string) {
  return useQuery({
    queryKey: campaignKeys.feedback(token),
    queryFn: async () => (await apiClient.get<FeedbackView>(`/public/feedback/${token}`)).data,
    enabled: !!token,
    retry: false,
    staleTime: 0,
  })
}

export function useAnswerFeedback(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { score: number; comment: string | null }) =>
      (await apiClient.post<{ recorded: boolean }>(`/public/feedback/${token}/answer`, input)).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: campaignKeys.feedback(token) }),
  })
}

export function useUnsubscribeFeedback(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ unsubscribed: true }>(`/public/feedback/${token}/unsubscribe`, {}))
        .data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: campaignKeys.feedback(token) }),
  })
}
