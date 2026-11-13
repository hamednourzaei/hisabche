// ============================================
// Two-step verification for workspace members (V61 B.2.25).
//
// The authenticator factor lives in Supabase Auth; the backend acts with the
// person's own session (backend/src/services/authorization/workspace-2fa.service.ts).
// A correct code returns a NEW session at AAL2 — the caller hands it to the
// auth store (`adoptVerifiedSession`), because this package never imports it.
//
// ⚠️ Never cached on the device: the status says whether sensitive actions
// are protected, and a stale "enrolled" would hide a removed factor.
// ============================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'

export interface TwoFactorPolicy {
  capabilities: string[]
  requireOwner: boolean
  maxFailedAttempts: number
  lockoutMinutes: number
}

export interface TwoFactorStatus {
  enrolled: boolean
  factorId: string | null
  recoveryCodesLeft: number
  policy: TwoFactorPolicy | null
  configured: boolean
}

export interface TwoFactorEnrollment {
  factorId: string
  /** An SVG data URL Supabase returns for the authenticator app. */
  qrCode: string
  uri: string
  /** For typing into the app by hand when the camera cannot read the code. */
  secret: string
}

export interface VerifiedTwoFactorSession {
  token: string
  refreshToken?: string | undefined
  expiresAt: number | null
  /** Only on the first verification of a factor — show once, never again. */
  recoveryCodes: string[] | null
}

/** The capabilities a workspace may put behind a fresh code (server list). */
export const STEP_UP_CAPABILITY_OPTIONS = [
  'ledger.lock_period',
  'ledger.reverse',
  'payroll.post',
  'member.manage',
  'workspace.manage',
  'account.manage',
  'payment.cancel',
  'license.manage',
  'data.import',
] as const

export const twoFactorKeys = {
  status: ['two-factor', 'status'] as const,
}

export function useTwoFactorStatus() {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: twoFactorKeys.status,
    queryFn: async (): Promise<TwoFactorStatus> => {
      const { data } = await apiClient.get<{ data: TwoFactorStatus }>('/auth/mfa/status')
      return data.data
    },
    enabled: authReady,
    staleTime: 0,
    gcTime: 0,
    meta: { persist: false },
  })
}

export function useStartTwoFactor() {
  return useMutation({
    mutationFn: async (): Promise<TwoFactorEnrollment> => {
      const { data } = await apiClient.post<{ data: TwoFactorEnrollment }>('/auth/mfa/enroll', {})
      return data.data
    },
  })
}

/** Only the request. The caller adopts the returned session. */
export async function verifyTwoFactorCode(input: {
  factorId: string
  code: string
}): Promise<VerifiedTwoFactorSession> {
  const { data } = await apiClient.post<VerifiedTwoFactorSession>('/auth/mfa/verify', input)
  return data
}

export function useVerifyTwoFactor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: verifyTwoFactorCode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: twoFactorKeys.status }),
  })
}

export function useRecoverTwoFactor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await apiClient.post<{ data: { recovered: true } }>('/auth/mfa/recover', {
        code,
      })
      return data.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: twoFactorKeys.status }),
  })
}

export function useSaveTwoFactorPolicy() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { capabilities: string[]; requireOwner: boolean }) => {
      const { data } = await apiClient.put<{ data: TwoFactorPolicy }>('/auth/mfa/policy', input)
      return data.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: twoFactorKeys.status }),
  })
}

/** One read, outside React Query — for the step-up dialog, which runs between requests. */
export async function fetchTwoFactorStatus(): Promise<TwoFactorStatus> {
  const { data } = await apiClient.get<{ data: TwoFactorStatus }>('/auth/mfa/status')
  return data.data
}
