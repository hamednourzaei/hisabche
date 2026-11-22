// ============================================
// packages/api/src/hooks/workspace-profile.ts
//
// The Business Profile of the WORKSPACE (owner decision D4 = B), as the server holds it.
//
// `GET /workspace/profile` says whether the business declared a profile, which capabilities are on and
// which are only partial. A workspace that has NOT declared one (every workspace today) answers
// `declared: false`, and the screens then keep reading the signed-in user's own trades exactly as before —
// nothing changes for them.
//
// Saving is `PUT /workspace/profile`; the server requires the workspace-management permission, so a person
// without it simply gets a 403 here (the settings section already locks the control for roles that cannot
// write). A database that has not run docs/business-profile-01-migration.sql answers 409
// `WORKSPACE_PROFILE_NOT_CONFIGURED`; `saveWorkspaceProfile` reports that as `null`, never as success.
// ============================================

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  onboardingProgressSchema,
  operationalDnaSchema,
  type CompositionPlan,
  type OnboardingProgress,
  type OperationalDna,
} from '@hisabche/validation'

import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useActiveWorkspaceId } from './useRealtime'

export interface WorkspaceProfileView {
  declared: boolean
  configurable: boolean
  businessTypes: string[]
  capabilities: string[]
  partialCapabilities: string[]
  /** Stored values the registry does not recognise — reported, never hidden (F-018). */
  unknownTypes: string[]
  legacyTypes: string[]
}

export const workspaceProfileKeys = {
  all: ['workspace-profile'] as const,
}

/** Narrow an unknown reply to the view; anything else is «no profile known». */
function parseView(value: unknown): WorkspaceProfileView | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const strings = (input: unknown): string[] =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : []
  if (typeof record.declared !== 'boolean') return null
  return {
    declared: record.declared,
    configurable: record.configurable === true,
    businessTypes: strings(record.businessTypes),
    capabilities: strings(record.capabilities),
    partialCapabilities: strings(record.partialCapabilities),
    unknownTypes: strings(record.unknownTypes),
    legacyTypes: strings(record.legacyTypes),
  }
}

export function useWorkspaceProfile() {
  const ready = useAuthReady()
  // ⚠️ WORKSPACE-SCOPED KEY (forensic audit F-102). The profile belongs to one
  // workspace; a workspace-agnostic key lets a cached answer leak across a
  // switch. Same pattern as the dashboard/base-currency hooks.
  const workspaceId = useActiveWorkspaceId()
  return useQuery({
    queryKey: [...workspaceProfileKeys.all, workspaceId],
    enabled: ready && !!workspaceId,
    queryFn: async (): Promise<WorkspaceProfileView | null> => {
      const { data } = await apiClient.get('/workspace/profile')
      return parseView(data)
    },
    // The profile changes when an administrator edits it, not minute to minute.
    staleTime: 5 * 60_000,
  })
}

// ⚠️ These three return a STABLE function (useCallback). A plain `return async (…) =>` is a new
// function on every render; the onboarding screen lists the progress saver in an effect's
// dependencies, so it sent PUT /workspace/onboarding-progress on EVERY render — a storm that
// hit the 100-a-minute limit and left «ورود به حسابچه» refused with 429: the new owner could
// not leave onboarding (found by the browser journeys, 14 Nov 2026). Guard: stable-hook-functions.test.ts

/**
 * Declare or change the workspace profile.
 *
 * Returns the stored view, or `null` when the database cannot hold it yet (migration not applied) — the
 * caller then keeps the per-user profile and must not claim the workspace was updated.
 */
export function useSaveWorkspaceProfile() {
  const queryClient = useQueryClient()
  return useCallback(
    async (businessTypes: readonly string[]): Promise<WorkspaceProfileView | null> => {
      try {
        const { data } = await apiClient.put('/workspace/profile', { businessTypes })
        await queryClient.invalidateQueries({ queryKey: workspaceProfileKeys.all })
        return parseView(data)
      } catch (cause) {
        const code = (cause as { response?: { data?: { code?: string; error?: string } } }).response
          ?.data
        if (code?.code === 'WORKSPACE_PROFILE_NOT_CONFIGURED') return null
        if (JSON.stringify(code ?? '').includes('WORKSPACE_PROFILE_NOT_CONFIGURED')) return null
        throw cause
      }
    },
    [queryClient],
  )
}

// ─── V54 5.2 / 5.3 — Operational DNA and onboarding progress ──────────────
//
// The workspace's own copy (docs/operational-profile-01-migration.sql), so a
// second device or a cleared browser sees the same business and resumes the
// same wizard. Before the migration runs the server answers
// `configurable: false` and the device keeps its local copy, exactly as before.
// ⚠️ Online only: the device engine has no copy of these routes; offline the
// local wizard state is what exists, and it is not claimed as saved.

export interface OperationalProfileView {
  configurable: boolean
  dna: OperationalDna | null
  composition: CompositionPlan | null
  version: number
  onboarding: OnboardingProgress | null
  /** A stored value exists but no longer parses — surfaced, never silent (F-099). */
  dnaInvalid: boolean
  onboardingInvalid: boolean
}

export const operationalProfileKeys = {
  all: ['workspace-operational-profile'] as const,
}

/**
 * Structural boundary check for the composition (F-104). The server computes
 * it from a validated DNA; a reply whose shape does not hold is refused to
 * null instead of being cast into a typed object consumers would trust.
 */
function parseComposition(value: unknown): CompositionPlan | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (!operationalDnaSchema.safeParse(record.dna).success) return null
  if (!Array.isArray(record.problems)) return null
  if (!Array.isArray(record.requirements)) return null
  if (!Array.isArray(record.gaps)) return null
  if (!Array.isArray(record.nextQuestions)) return null
  if (typeof record.plan !== 'object' || record.plan === null) return null
  if (typeof record.presentation !== 'object' || record.presentation === null) return null
  return value as CompositionPlan
}

function parseOperationalView(value: unknown): OperationalProfileView | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (typeof record.configurable !== 'boolean') return null
  const dna = operationalDnaSchema.safeParse(record.dna)
  const onboarding = onboardingProgressSchema.safeParse(record.onboarding)
  return {
    configurable: record.configurable,
    dna: record.dna != null && dna.success ? dna.data : null,
    composition: parseComposition(record.composition),
    version: typeof record.version === 'number' ? record.version : 0,
    onboarding: record.onboarding != null && onboarding.success ? onboarding.data : null,
    dnaInvalid: record.dna != null && !dna.success,
    onboardingInvalid: record.onboarding != null && !onboarding.success,
  }
}

export function useOperationalProfile() {
  const ready = useAuthReady()
  // Workspace-scoped key — same rule as the business profile above (F-102).
  const workspaceId = useActiveWorkspaceId()
  return useQuery({
    queryKey: [...operationalProfileKeys.all, workspaceId],
    enabled: ready && !!workspaceId,
    queryFn: async (): Promise<OperationalProfileView | null> => {
      const { data } = await apiClient.get('/workspace/operational-profile')
      return parseOperationalView(data)
    },
    staleTime: 5 * 60_000,
  })
}

function refusedAsNotConfigured(cause: unknown): boolean {
  const data = (cause as { response?: { data?: unknown } }).response?.data
  return JSON.stringify(data ?? '').includes('OPERATIONAL_PROFILE_NOT_CONFIGURED')
}

/**
 * Save the DNA. `null` = the database cannot hold it yet (the caller keeps the
 * device copy and must not claim the workspace was updated). A save on a stale
 * version is thrown as the server said it (`OPERATIONAL_PROFILE_CHANGED`).
 */
export function useSaveOperationalDna() {
  const queryClient = useQueryClient()
  return useCallback(
    async (
      dna: OperationalDna,
      expectedVersion: number,
    ): Promise<{ version: number; replayed: boolean } | null> => {
      try {
        const { data } = await apiClient.put<{ version: number; replayed: boolean }>(
          '/workspace/operational-profile',
          { dna, expectedVersion },
        )
        await queryClient.invalidateQueries({ queryKey: operationalProfileKeys.all })
        return data
      } catch (cause) {
        if (refusedAsNotConfigured(cause)) return null
        throw cause
      }
    },
    [queryClient],
  )
}

/** Save where the wizard stands. `null` = not configured on this database yet. */
export function useSaveOnboardingProgress() {
  return useCallback(async (progress: OnboardingProgress): Promise<OnboardingProgress | null> => {
    try {
      const { data } = await apiClient.put<OnboardingProgress>(
        '/workspace/onboarding-progress',
        progress,
      )
      return data
    } catch (cause) {
      if (refusedAsNotConfigured(cause)) return null
      throw cause
    }
  }, [])
}
