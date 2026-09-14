// ============================================
// backend/src/services/authorization/sod.service.ts
//
// Enforcing segregation of duties against what actually happened.
//
// The rules are pure (sod.domain.ts). This is the part that has to know who
// did what to a document, which means reading the audit trail — SoD is only as
// good as the record of prior actions behind it.
// ============================================

import { supabase } from '../../db'
import { AuditService } from '../audit.service'
import { ConflictError, DatabaseError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'

import type { Capability } from './authorization.domain'
import {
  DEFAULT_SOD_SETTINGS,
  activeRules,
  checkSoD,
  validateOverride,
  type PriorAction,
  type SoDMode,
  type SoDSettings,
  type SoDVerdict,
} from './sod.domain'

/**
 * What an overridden action IS, in the audit trail's own vocabulary.
 *
 * `audit_logs.action` is a closed enum and none of its values is «override» —
 * so the row records the action that was permitted, and `newData.sodOverride`
 * says it was permitted by an override. Mapped explicitly rather than guessed
 * from the capability's suffix: `payment.cancel` is a deletion in this
 * vocabulary and `ledger.reverse` is not, and a suffix rule gets one of them
 * wrong.
 */
const OVERRIDE_AUDIT_ACTION: Partial<Record<Capability, 'update' | 'delete'>> = {
  'payment.cancel': 'delete',
  'invoice.delete': 'delete',
  'ledger.reverse': 'update',
  'budget.approve': 'update',
}

const audit = new AuditService()

export class SoDService {
  async getSettings(workspaceId: string): Promise<SoDSettings> {
    const { data, error } = await supabase
      .from('sod_settings')
      .select('mode, disabled_rules')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read the SoD settings', error)
    if (!data) return DEFAULT_SOD_SETTINGS

    return {
      mode: (data.mode as SoDMode) ?? 'off',
      disabledRules: (data.disabled_rules as string[]) ?? [],
    }
  }

  /**
   * Turning SoD on, or switching a rule off, is an owner's decision — it
   * changes what the other members of the workspace are allowed to do.
   */
  async setSettings(
    ctx: TenancyContext,
    settings: { mode?: SoDMode | undefined; disabledRules?: string[] | undefined },
  ): Promise<SoDSettings> {
    if (ctx.role !== 'owner') throw new ConflictError('SOD_SETTINGS_FORBIDDEN')

    const current = await this.getSettings(ctx.workspaceId)
    const next: SoDSettings = {
      mode: settings.mode ?? current.mode,
      disabledRules: settings.disabledRules ?? current.disabledRules,
    }

    const { error } = await supabase.from('sod_settings').upsert(
      {
        workspace_id: ctx.workspaceId,
        mode: next.mode,
        disabled_rules: next.disabledRules,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    )

    if (error) throw new DatabaseError('Failed to save the SoD settings', error)
    return next
  }

  /**
   * What has already been done to this document, and by whom.
   *
   * Read from `sod_actions`, which this service writes on every guarded
   * action. It is deliberately its OWN table rather than a query over
   * `audit_logs`: the audit trail is a narrative for humans and its shape
   * changes, while this is a machine-read index that a control depends on.
   */
  private async priorActions(
    workspaceId: string,
    entityType: string,
    entityId: string,
  ): Promise<PriorAction[]> {
    const { data, error } = await supabase
      .from('sod_actions')
      .select('capability, actor_id')
      .eq('workspace_id', workspaceId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .limit(200)

    if (error) throw new DatabaseError('Failed to read prior actions', error)

    return (data ?? []).map((row) => ({
      capability: row.capability as Capability,
      actorId: row.actor_id,
    }))
  }

  /** Record that this actor did this to this document. */
  async recordAction(
    ctx: TenancyContext,
    capability: Capability,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    const { error } = await supabase.from('sod_actions').insert({
      workspace_id: ctx.workspaceId,
      entity_type: entityType,
      entity_id: entityId,
      capability,
      actor_id: ctx.userId,
      actor_role: ctx.role,
    })

    // A failure to index an action must not fail the action itself; it makes
    // a FUTURE check weaker, and that is worth a loud log, not a 500 on work
    // the user already completed.
    if (error) console.error('[SoD] failed to record an action:', error)
  }

  /**
   * The check itself. Throws unless the actor may proceed.
   *
   * `override` is only honoured when the verdict actually offers one, and only
   * with a reason, which is then recorded next to the action.
   */
  async assertAllowed(
    ctx: TenancyContext,
    capability: Capability,
    entityType: string,
    entityId: string,
    override?: { reason: string } | undefined,
  ): Promise<SoDVerdict> {
    const settings = await this.getSettings(ctx.workspaceId)
    if (settings.mode === 'off') return { kind: 'allowed' }

    const verdict = checkSoD(
      {
        capability,
        actorId: ctx.userId,
        role: ctx.role,
        priorActions: await this.priorActions(ctx.workspaceId, entityType, entityId),
      },
      settings,
    )

    if (verdict.kind === 'allowed') return verdict

    if (verdict.kind === 'blocked') {
      throw new ConflictError(`SOD_BLOCKED:${verdict.ruleId}`)
    }

    // requires_override
    if (!override) throw new ConflictError(`SOD_OVERRIDE_REQUIRED:${verdict.ruleId}`)

    const problems = validateOverride(verdict, override.reason)
    if (problems.length > 0) throw new ValidationError(problems.join(', '))

    const { error } = await supabase.from('sod_overrides').insert({
      workspace_id: ctx.workspaceId,
      rule_id: verdict.ruleId,
      entity_type: entityType,
      entity_id: entityId,
      capability,
      actor_id: ctx.userId,
      reason: override.reason,
    })

    // Here the opposite of recordAction: if the OVERRIDE cannot be written
    // down, the override does not happen. An unrecorded bypass of a control is
    // indistinguishable from no control.
    if (error) throw new DatabaseError('Failed to record the SoD override', error)

    // ─── J5 — and where somebody will actually see it ───────────────────────
    //
    // `sod_overrides` had exactly one reader: `GET /api/governance/sod/
    // overrides`, behind a hook no screen calls. So the record of a person
    // bypassing a separation of duties existed and was, in practice, unread.
    //
    // The audit centre (G4) is where a workspace owner already goes to ask who
    // did what, so the override is written there too — on the ENTITY it was
    // taken against, so it appears in that record's own history next to the
    // action it permitted, rather than in a governance page of its own.
    //
    // Deliberately after the insert above and deliberately not fatal: the
    // authoritative record is `sod_overrides`, and this is the copy that makes
    // it visible. Losing the visible copy must not undo a completed override.
    try {
      await audit.log({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        action: OVERRIDE_AUDIT_ACTION[capability] ?? 'update',
        entityType,
        entityId,
        newData: {
          sodOverride: true,
          ruleId: verdict.ruleId,
          capability,
          reason: override.reason,
          actorRole: ctx.role,
        },
      })
    } catch (auditError) {
      console.error('[SoD] override recorded but not audited:', auditError)
    }

    return verdict
  }

  /** What is actually enforced in this workspace right now. */
  async describe(ctx: TenancyContext) {
    const settings = await this.getSettings(ctx.workspaceId)
    return { settings, rules: activeRules(settings) }
  }

  async listOverrides(ctx: TenancyContext, limit = 100) {
    const { data, error } = await supabase
      .from('sod_overrides')
      .select('id, rule_id, entity_type, entity_id, capability, actor_id, reason, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500))

    if (error) throw new DatabaseError('Failed to fetch SoD overrides', error)
    return data ?? []
  }
}
