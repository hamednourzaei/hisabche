'use client'

// ============================================
// apps/admin/hooks/use-admin-gateways.ts
//
// V63 · P-1/P-3 — the platform payment gateways.
//
// A secret is never in any shape this file can type: the API returns `last4`
// and a state word. The mutation bodies carry a step-up timestamp only.
// ============================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'

export type GatewayState = 'READY' | 'NOT_CONFIGURED' | 'DISABLED'

export interface PlatformGatewayItem {
  id: string
  provider: 'STRIPE' | 'PAYPAL' | 'LOCAL'
  environment: 'TEST' | 'LIVE'
  isEnabled: boolean
  displayName: string
  publicConfig: Record<string, unknown>
  secretNames: string[]
  missingSecrets: number
  state: GatewayState
  note: string
  updatedBy: string | null
  updatedAt: string
}

export interface GatewayTestResultItem {
  gatewayId: string
  provider: string
  environment: string
  kind: string
  webhookPath: string | null
  result: { state: 'OK' | 'NOT_CONFIGURED' | 'FAILED'; detail: string }
}

export function useAdminGateways() {
  return useQuery<{ gateways: PlatformGatewayItem[] }>({
    queryKey: ['admin', 'gateways'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/gateways')
      return res.data
    },
    staleTime: 30 * 1000,
  })
}

export function useEnableGateway() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; stepUpTimestamp: string }) => {
      const res = await apiClient.post(
        `/admin/gateways/${input.id}/enable`,
        {},
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data as
        | { state: 'ENABLED'; gateway: PlatformGatewayItem }
        | { state: 'PENDING_APPROVAL'; requestId: string; gateway: PlatformGatewayItem }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'gateways'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'action-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'action-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posture'] })
    },
  })
}

export function useDisableGateway() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; stepUpTimestamp: string }) => {
      const res = await apiClient.post(
        `/admin/gateways/${input.id}/disable`,
        {},
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data as { gateway: PlatformGatewayItem }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'gateways'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posture'] })
    },
  })
}

export function useTestGateway() {
  return useMutation({
    mutationFn: async (input: { id: string; stepUpTimestamp: string }) => {
      const res = await apiClient.post(
        `/admin/gateways/${input.id}/test`,
        {},
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data as GatewayTestResultItem
    },
  })
}

// ─── V63 audit (12 Nov 2026): the gateway form ────────────────────────────
//
// The panel told the admin to «stage keys in Security → Secrets», but there
// was no such tab and no caller of `/admin/secrets` or of the gateway
// metadata route: no key and no PayPal address could ever be entered, so no
// gateway could be enabled. These three hooks are the form's whole contract.

/** What the console may know about a secret: never the value. */
export interface PlatformSecretMetadata {
  name: string
  purpose: string
  last4: string | null
  rotatedAt: string | null
  rotatedBy: string | null
  pendingLast4: string | null
  pendingAt: string | null
  pendingBy: string | null
}

export function useAdminSecrets() {
  return useQuery<{ secrets: PlatformSecretMetadata[] }>({
    queryKey: ['admin', 'secrets'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/secrets')
      return res.data
    },
    staleTime: 30 * 1000,
  })
}

/** Stage a value. It is applied only when a DIFFERENT admin approves the request. */
export function useStageSecret() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      value: string
      purpose: string
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.post(
        `/admin/secrets/${encodeURIComponent(input.name)}`,
        { value: input.value, purpose: input.purpose },
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data as { ok: true; name: string; last4: string; requestId: string }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'secrets'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'action-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'billing', 'action-requests'] })
    },
  })
}

/** Public settings only (the PayPal address, a publishable key). The server refuses secret-looking keys. */
export function useUpdateGatewayMetadata() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      displayName: string
      publicConfig: Record<string, string>
      stepUpTimestamp: string
    }) => {
      const res = await apiClient.put(
        `/admin/gateways/${input.id}/metadata`,
        { displayName: input.displayName, publicConfig: input.publicConfig },
        { headers: { 'X-Admin-Step-Up-Timestamp': input.stepUpTimestamp } },
      )
      return res.data as { gateway: PlatformGatewayItem }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'gateways'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'posture'] })
    },
  })
}
