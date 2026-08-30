// ============================================
// backend/src/services/personalization/visibility.service.ts
//
// Storing and serving one user's UI visibility profile.
//
// A profile belongs to a USER inside a WORKSPACE: the same person can run
// their own shop one way and help in somebody else's another. Both ids are in
// the key, and the workspace half comes from the verified TenancyContext.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { memoryCache } from '../../utils/pagination'
import type { TenancyContext } from '../tenancy.service'

import {
  applyPatch,
  emptyProfile,
  hiddenKeys,
  resolveVisibility,
  suggestFrom,
  validatePatch,
  type UiVisibilityProfile,
  type UsageSignal,
  type VisibilityLevel,
} from './visibility.domain'

export class VisibilityService {
  private key(ctx: TenancyContext) {
    return `visibility:${ctx.workspaceId}:${ctx.userId}`
  }

  async get(ctx: TenancyContext): Promise<UiVisibilityProfile> {
    const cacheKey = this.key(ctx)

    const cached = await memoryCache.get<UiVisibilityProfile>(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('ui_visibility_profiles')
      .select('modules, pages, widgets, advanced_fields, updated_at')
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', ctx.userId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read the visibility profile', error)

    const profile: UiVisibilityProfile = data
      ? {
          workspaceId: ctx.workspaceId,
          userId: ctx.userId,
          modules: data.modules ?? {},
          pages: data.pages ?? {},
          widgets: data.widgets ?? {},
          advancedFields: data.advanced_fields ?? {},
          updatedAt: data.updated_at ?? undefined,
        }
      : emptyProfile(ctx.workspaceId, ctx.userId)

    await memoryCache.set(cacheKey, profile, 300)
    return profile
  }

  /**
   * Hide or show keys at one level.
   *
   * Deliberately a PATCH: a full replace would let a client that knows about
   * four modules wipe the preferences for a fifth it has not been updated to
   * know about yet.
   */
  async patch(
    ctx: TenancyContext,
    level: VisibilityLevel,
    entries: Record<string, boolean>,
  ): Promise<UiVisibilityProfile> {
    const problems = validatePatch(level, entries)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const next = applyPatch(await this.get(ctx), level, entries)

    const { error } = await supabase.from('ui_visibility_profiles').upsert(
      {
        workspace_id: ctx.workspaceId,
        user_id: ctx.userId,
        modules: next.modules,
        pages: next.pages,
        widgets: next.widgets,
        advanced_fields: next.advancedFields,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,user_id' },
    )

    if (error) throw new DatabaseError('Failed to save the visibility profile', error)

    await memoryCache.invalidate(this.key(ctx))
    return next
  }

  /** Put everything back. There is always a way out of a hidden state. */
  async reset(ctx: TenancyContext): Promise<UiVisibilityProfile> {
    const { error } = await supabase
      .from('ui_visibility_profiles')
      .delete()
      .eq('workspace_id', ctx.workspaceId)
      .eq('user_id', ctx.userId)

    if (error) throw new DatabaseError('Failed to reset the visibility profile', error)

    await memoryCache.invalidate(this.key(ctx))
    return emptyProfile(ctx.workspaceId, ctx.userId)
  }

  /**
   * What to render, out of what the user is ALLOWED to render.
   *
   * `authorized` comes from the authorization core and is the gate. This can
   * only narrow it — the ordering that makes "visibility is not authorization"
   * a fact about the code and not a promise in a comment.
   */
  async visibleOf(
    ctx: TenancyContext,
    level: VisibilityLevel,
    authorized: string[],
  ): Promise<string[]> {
    return resolveVisibility(await this.get(ctx), level, authorized)
  }

  async hidden(ctx: TenancyContext) {
    return hiddenKeys(await this.get(ctx))
  }

  /**
   * Proposals, never changes.
   *
   * The caller shows them with [add] [hide] [not now] [stop suggesting]. Until
   * the user answers, the interface stays exactly as it was.
   */
  async suggestions(ctx: TenancyContext, signals: UsageSignal[], daysObserved: number) {
    return suggestFrom(await this.get(ctx), signals, { minDaysObserved: daysObserved })
  }
}
