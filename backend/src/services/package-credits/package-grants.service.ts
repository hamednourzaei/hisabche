// ============================================
// backend/src/services/package-credits/package-grants.service.ts
//
// M5 / slice C - what a customer's package GRANTs look like TODAY (term, activation, expiry, suspension, what is left) and
// the append-only SUSPEND / RESUME events of ONE GRANT.
//
// It decides nothing itself: every state comes from the shared pure functions of packages/validation
// (`allocatableGrantsFromFacts`, `grantStateOn`, `grantEndsOn`) - the same ones the device and the SQL trigger are proven
// against. Suspension rows are written once and never edited (a RESUME is a later row), and a suspension stops ONE GRANT,
// never the customer and never another GRANT. Nothing here posts money, refunds, expires or deletes anything.
// ============================================

import { grantStatuses, type GrantState, type LedgerAllocationFact } from '@hisabche/validation'
import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { businessDayOf } from '../../utils/local-day'
import type { TenancyContext } from '../tenancy.service'

export interface PackageGrantStatus {
  id: string
  customerId: string
  packageProductId: string
  /** Day of the sale. */
  soldOn: string
  quantity: number
  /** Units still unspent on this GRANT (net of consumptions and adjustments). */
  remaining: number
  termMonths: number | null
  /** Day of the first valid consume; null = never used, so the term has not started (SOLD != ACTIVATED). */
  activatedOn: string | null
  /** Last day the GRANT can be used; null = no term, or not started. */
  endsOn: string | null
  /** Usable TODAY? not_started / active / expired / suspended. */
  state: GrantState
  /** Books-currency net amount the sale deferred for this GRANT; null = sold before deferral. */
  deferredAmount: number | null
}

const SUSPENSION_KINDS = ['SUSPEND', 'RESUME'] as const
export type SuspensionKind = (typeof SUSPENSION_KINDS)[number]

const isMissingTable = (error: { code?: string } | null) =>
  error?.code === '42P01' || error?.code === 'PGRST205'

export class PackageGrantsService {
  private readonly db = supabase

  async list(
    ctx: TenancyContext,
    customerId: string,
    packageProductId?: string,
    today = businessDayOf(new Date(), ctx.timeZone),
  ): Promise<PackageGrantStatus[]> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!customerId) throw new ValidationError('CUSTOMER_ID_REQUIRED')

    let query = this.db
      .from('package_credit_ledger')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
    if (packageProductId) query = query.eq('package_product_id', packageProductId)
    const { data, error } = await query
    if (error) {
      if (isMissingTable(error)) return []
      throw new DatabaseError('Failed to read the package ledger', error)
    }
    const rows = (data ?? []) as Array<{
      id: string
      package_product_id: string
      entry_type: string
      quantity: number | string
      reference_entry_id: string | null
      effective_date: string
      deferred_amount?: number | string | null
      term_months?: number | null
    }>
    const grants = rows.filter((r) => r.entry_type === 'GRANT')
    if (grants.length === 0) return []

    const ids = rows.map((r) => r.id)
    const allocationRes = await this.db
      .from('package_credit_allocations')
      .select('entry_id, grant_entry_id, kind, quantity, released_amount, effective_date')
      .eq('workspace_id', ctx.workspaceId)
      .in('entry_id', ids)
    if (allocationRes.error && !isMissingTable(allocationRes.error)) {
      throw new DatabaseError('Failed to read the package allocations', allocationRes.error)
    }
    const suspensionRes = await this.db
      .from('package_credit_suspensions')
      .select('grant_entry_id, kind, effective_on, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .in(
        'grant_entry_id',
        grants.map((g) => g.id),
      )
      .order('created_at', { ascending: true })
    if (suspensionRes.error && !isMissingTable(suspensionRes.error)) {
      throw new DatabaseError('Failed to read the package suspensions', suspensionRes.error)
    }

    const allocations: LedgerAllocationFact[] = (
      (allocationRes.data ?? []) as Array<{
        entry_id: string
        grant_entry_id: string | null
        kind: 'CONSUME' | 'REVERSAL'
        quantity: number | string
        released_amount: number | string
        effective_date: string
      }>
    ).map((a) => ({
      entryId: a.entry_id,
      grantId: a.grant_entry_id,
      kind: a.kind,
      quantity: Number(a.quantity),
      releasedAmount: Number(a.released_amount),
      effectiveDate: a.effective_date,
    }))

    const allocated = new Set(allocations.map((a) => a.entryId))
    const consumeIds = new Set(rows.filter((r) => r.entry_type === 'CONSUME').map((r) => r.id))
    const reversed = new Set(
      rows
        .filter((r) => r.entry_type === 'REVERSAL' && r.reference_entry_id)
        .map((r) => r.reference_entry_id as string),
    )
    // consumptions that predate the allocation rows: charged to the oldest GRANTs with no deferred amount
    const legacyConsumed = rows.reduce((sum, r) => {
      if (r.entry_type === 'CONSUME' && !allocated.has(r.id)) return sum + Number(r.quantity)
      if (
        r.entry_type === 'REVERSAL' &&
        r.reference_entry_id &&
        consumeIds.has(r.reference_entry_id) &&
        !allocated.has(r.reference_entry_id)
      ) {
        return sum - Number(r.quantity)
      }
      return sum
    }, 0)

    const statuses = grantStatuses(
      {
        grants: grants.map((g) => ({
          id: g.id,
          startsOn: g.effective_date,
          quantity: Number(g.quantity),
          deferredAmount: g.deferred_amount == null ? null : Number(g.deferred_amount),
          termMonths: g.term_months ?? null,
        })),
        adjustments: rows
          .filter((r) => r.entry_type === 'ADJUSTMENT' && r.reference_entry_id)
          .map((r) => ({ grantId: r.reference_entry_id as string, quantity: Number(r.quantity) })),
        allocations,
        reversedConsumeIds: reversed,
        suspensionEvents: (
          (suspensionRes.data ?? []) as Array<{
            grant_entry_id: string
            kind: 'SUSPEND' | 'RESUME'
            effective_on: string
          }>
        ).map((s, order) => ({
          grantId: s.grant_entry_id,
          kind: s.kind,
          effectiveOn: s.effective_on,
          order,
        })),
        legacyConsumed,
      },
      today,
    )

    return statuses.map((status) => ({
      ...status,
      customerId,
      packageProductId: grants.find((g) => g.id === status.id)!.package_product_id,
    }))
  }

  /** SUSPEND or RESUME one GRANT from a day. Append-only: the earlier rows are never touched. */
  async recordSuspension(
    ctx: TenancyContext,
    grantId: string,
    input: { kind: SuspensionKind; effectiveOn?: string | undefined; reason: string },
  ): Promise<{ id: string; grantId: string; kind: SuspensionKind; effectiveOn: string }> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!SUSPENSION_KINDS.includes(input.kind)) throw new ValidationError('SUSPENSION_KIND_INVALID')
    const reason = (input.reason ?? '').trim()
    if (!reason) throw new ValidationError('SUSPENSION_REASON_REQUIRED')
    const effectiveOn = (input.effectiveOn ?? businessDayOf(new Date(), ctx.timeZone)).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn))
      throw new ValidationError('SUSPENSION_DATE_INVALID')

    // The GRANT must be THIS workspace's (never trust an id from the URL).
    const found = await this.db
      .from('package_credit_ledger')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', grantId)
      .eq('entry_type', 'GRANT')
      .is('deleted_at', null)
      .maybeSingle()
    if (found.error) throw new DatabaseError('Failed to read the package grant', found.error)
    if (!found.data) throw new NotFoundError('Package grant')

    const { data, error } = await this.db
      .from('package_credit_suspensions')
      .insert({
        workspace_id: ctx.workspaceId,
        grant_entry_id: grantId,
        kind: input.kind,
        effective_on: effectiveOn,
        reason,
        created_by: ctx.userId,
      })
      .select('id')
      .single()
    if (error) {
      if (isMissingTable(error)) {
        throw new DatabaseError(
          'PACKAGE_SUSPENSION_MIGRATION_REQUIRED: docs/package-deferred-revenue-01-migration.sql',
          error,
        )
      }
      throw new DatabaseError('Failed to record the suspension', error)
    }
    return { id: (data as { id: string }).id, grantId, kind: input.kind, effectiveOn }
  }
}
