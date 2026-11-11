// ============================================
// packages/local-engine/src/routes/workspace-profile.ts
//
// V59 W2/W6 — Offline Business Profile, Versioned Operational DNA & Onboarding Progress.
//
// Uses the SAME pure resolvers (`canonicalIndustryTypes`, `resolveBusinessProfile`,
// `operationalDnaSchema`, `onboardingProgressSchema`) as `backend/src/services/workspace-profile.ts`,
// preserving optimistic concurrency (`expectedVersion` -> 409 OPERATIONAL_PROFILE_CHANGED)
// and exact workspace isolation (`workspace_id`).
// ============================================

import {
  canonicalIndustryTypes,
  onboardingProgressSchema,
  operationalDnaSchema,
  resolveBusinessProfile,
} from '@hisabche/validation'
import { requireCapability } from '../auth'
import { ConflictError, NotFoundError, ValidationError } from '../errors'
import type { Router } from '../router'
import type { RouteHandlerContext } from '../types'
import { splitBusinessTypes } from './workspace'

interface LocalProfileRow {
  id: string
  business_types: string | null
  operational_dna: string | null
  operational_dna_version: number | null
  onboarding_progress: string | null
}

function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function registerWorkspaceProfileRoutes(router: Router): void {
  router.get('/workspace/profile', (c: RouteHandlerContext) => {
    const row = c.db.get<Pick<LocalProfileRow, 'id' | 'business_types'>>(
      'SELECT id, business_types FROM local_workspace WHERE id = ? LIMIT 1',
      [c.ctx.workspaceId],
    )
    if (!row) {
      const profile = resolveBusinessProfile([])
      return {
        declared: false,
        configurable: true,
        businessTypes: [],
        capabilities: profile.capabilities,
        partialCapabilities: profile.partialCapabilities,
        unsupported: profile.unsupported,
        diagnostics: profile.diagnostics,
      }
    }
    const { known } = canonicalIndustryTypes(splitBusinessTypes(row.business_types))
    const profile = resolveBusinessProfile(known)
    return {
      declared: known.length > 0,
      configurable: true,
      businessTypes: known,
      capabilities: profile.capabilities,
      partialCapabilities: profile.partialCapabilities,
      unsupported: profile.unsupported,
      diagnostics: profile.diagnostics,
    }
  })

  router.put('/workspace/profile', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'workspace.manage')
    const raw = (c.body || {}) as Record<string, unknown>
    const input = Array.isArray(raw.businessTypes)
      ? raw.businessTypes.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : null
    if (!input || input.length === 0) {
      throw new ValidationError('BUSINESS_TYPE_REQUIRED')
    }
    const canonical = canonicalIndustryTypes(input)
    if (canonical.unknown.length > 0 || canonical.legacy.length > 0) {
      throw new ValidationError(
        `BUSINESS_TYPE_UNKNOWN: ${[...canonical.unknown, ...canonical.legacy].join(', ')}`,
      )
    }
    if (canonical.known.length === 0) {
      throw new ValidationError('BUSINESS_TYPE_REQUIRED')
    }

    const ws = c.db.get<{ id: string }>('SELECT id FROM local_workspace WHERE id = ? LIMIT 1', [
      c.ctx.workspaceId,
    ])
    if (!ws) throw new NotFoundError('Workspace', c.ctx.workspaceId)

    const now = new Date().toISOString()
    c.db.run(
      'UPDATE local_workspace SET business_types = ?, business_types_updated_at = ?, updated_at = ? WHERE id = ?',
      [canonical.known.join(','), now, now, c.ctx.workspaceId],
    )

    const profile = resolveBusinessProfile(canonical.known)
    return {
      declared: true,
      configurable: true,
      businessTypes: canonical.known,
      capabilities: profile.capabilities,
      partialCapabilities: profile.partialCapabilities,
      unsupported: profile.unsupported,
      diagnostics: profile.diagnostics,
    }
  })

  router.get('/workspace/operational-profile', (c: RouteHandlerContext) => {
    const row = c.db.get<
      Pick<LocalProfileRow, 'operational_dna' | 'operational_dna_version' | 'onboarding_progress'>
    >(
      'SELECT operational_dna, operational_dna_version, onboarding_progress FROM local_workspace WHERE id = ? LIMIT 1',
      [c.ctx.workspaceId],
    )
    if (!row) {
      return { configurable: true, dna: null, version: 0, onboarding: null }
    }
    const rawDna = safeJsonParse(row.operational_dna)
    const rawOnboarding = safeJsonParse(row.onboarding_progress)
    const dna = rawDna != null ? operationalDnaSchema.safeParse(rawDna) : null
    const onboarding =
      rawOnboarding != null ? onboardingProgressSchema.safeParse(rawOnboarding) : null

    return {
      configurable: true,
      dna: dna && dna.success ? dna.data : null,
      version: Number(row.operational_dna_version ?? 0),
      onboarding: onboarding && onboarding.success ? onboarding.data : null,
    }
  })

  router.put('/workspace/operational-profile', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'workspace.manage')
    const raw = (c.body || {}) as Record<string, unknown>
    const expectedVersion =
      typeof raw.expectedVersion === 'number' && Number.isInteger(raw.expectedVersion)
        ? raw.expectedVersion
        : -1
    if (expectedVersion < 0) {
      throw new ValidationError('OPERATIONAL_DNA_INVALID')
    }
    const parsedDna = operationalDnaSchema.safeParse(raw.dna)
    if (!parsedDna.success) {
      throw new ValidationError('OPERATIONAL_DNA_INVALID')
    }

    return c.db.transaction(() => {
      const ws = c.db.get<
        Pick<LocalProfileRow, 'id' | 'operational_dna' | 'operational_dna_version'>
      >(
        'SELECT id, operational_dna, operational_dna_version FROM local_workspace WHERE id = ? LIMIT 1',
        [c.ctx.workspaceId],
      )
      if (!ws) throw new NotFoundError('Workspace', c.ctx.workspaceId)

      const currentVersion = Number(ws.operational_dna_version ?? 0)
      const nextJson = JSON.stringify(parsedDna.data)
      if (ws.operational_dna === nextJson) {
        return { version: currentVersion, replayed: true }
      }
      if (expectedVersion !== currentVersion) {
        throw new ConflictError('OPERATIONAL_PROFILE_CHANGED')
      }

      const nextVersion = currentVersion + 1
      const now = new Date().toISOString()
      const updated = c.db.run(
        'UPDATE local_workspace SET operational_dna = ?, operational_dna_version = ?, updated_at = ? WHERE id = ? AND operational_dna_version = ?',
        [nextJson, nextVersion, now, c.ctx.workspaceId, currentVersion],
      )
      if (updated.changes === 0) {
        throw new ConflictError('OPERATIONAL_PROFILE_CHANGED')
      }
      return { version: nextVersion, replayed: false }
    })
  })

  router.put('/workspace/onboarding-progress', (c: RouteHandlerContext) => {
    requireCapability(c.ctx, 'workspace.manage')
    const parsed = onboardingProgressSchema.safeParse(c.body)
    if (!parsed.success) {
      throw new ValidationError('ONBOARDING_PROGRESS_INVALID')
    }

    const ws = c.db.get<{ id: string }>('SELECT id FROM local_workspace WHERE id = ? LIMIT 1', [
      c.ctx.workspaceId,
    ])
    if (!ws) throw new NotFoundError('Workspace', c.ctx.workspaceId)

    const now = new Date().toISOString()
    c.db.run('UPDATE local_workspace SET onboarding_progress = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(parsed.data),
      now,
      c.ctx.workspaceId,
    ])
    return parsed.data
  })
}
