// ============================================
// backend/src/services/quality/quality.service.ts
//
// V60 Slice 11 — Immutable Quality Events & Warranty Claims Chain (P9).
//
// - `recordQualityEvent`: writes append-only `quality_events` row and, on failed
//   receipt inspection with a quarantine warehouse, transfers failed stock out of
//   sellable inventory via `WarehouseService.transferStock` (never mutates balances directly).
// - `submitWarrantyClaim`: checks `isWarrantyActive()` from `@hisabche/validation`;
//   expired warranties are refused with `WARRANTY_EXPIRED` instead of silently accepted.
// ============================================

import {
  isWarrantyActive,
  qualityEventCreateSchema,
  WARRANTY_EXPIRED_CODE,
  warrantyClaimCreateSchema,
  type QualityEventCreateInput,
  type WarrantyClaimCreateInput,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { logBusinessEvent } from '../event-log.service'
import type { TenancyContext } from '../tenancy.service'
import { WarehouseService } from '../warehouse.service'

const warehouseService = new WarehouseService()

export class QualityService {
  async listQualityEvents(
    ctx: TenancyContext,
    filters?: { sourceType?: string | undefined; sourceId?: string | undefined },
  ) {
    let query = supabase
      .from('quality_events')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('occurred_at', { ascending: false })

    if (filters?.sourceType) query = query.eq('source_type', filters.sourceType)
    if (filters?.sourceId) query = query.eq('source_id', filters.sourceId)

    const { data, error } = await query
    if (error) throw new DatabaseError('Failed to list quality events', error)
    return data ?? []
  }

  async recordQualityEvent(
    ctx: TenancyContext,
    raw: QualityEventCreateInput,
    options: { idempotencyKey?: string | null | undefined } = {},
  ) {
    const input = qualityEventCreateSchema.parse(raw)

    const { data: inserted, error } = await supabase
      .from('quality_events')
      .insert({
        workspace_id: ctx.workspaceId,
        source_type: input.sourceType,
        source_id: input.sourceId,
        event_kind: input.eventKind,
        product_id: input.productId ?? null,
        serial_number: input.serialNumber ?? null,
        quantity: input.quantity,
        quarantine_warehouse_id: input.quarantineWarehouseId ?? null,
        notes: input.notes ?? null,
        actor_id: ctx.userId,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
      })
      .select('*')
      .single()

    if (error) throw new DatabaseError('Failed to record quality event', error)

    let quarantineTransfer: unknown = null
    const isFailure = input.eventKind === 'fail' || input.eventKind === 'defect'
    if (isFailure && input.productId && input.fromWarehouseId && input.quarantineWarehouseId) {
      quarantineTransfer = await warehouseService.transferStock(
        ctx,
        {
          productId: input.productId,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.quarantineWarehouseId,
          quantity: input.quantity,
          notes:
            input.notes ??
            `QC ${input.eventKind} quarantine (${input.sourceType}:${input.sourceId})`,
        },
        options,
      )
    }

    logBusinessEvent({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      entityType: input.sourceType,
      entityId: input.sourceId,
      action: `quality.${input.eventKind}`,
      title: `Quality ${input.eventKind} recorded`,
      notifyType: isFailure ? 'warning' : 'info',
    }).catch((err) => console.error('[QualityService] logBusinessEvent failed:', err))

    return { event: inserted, quarantineTransfer }
  }

  async listWarrantyClaims(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('warranty_claims')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('claim_date', { ascending: false })

    if (error) throw new DatabaseError('Failed to list warranty claims', error)
    return data ?? []
  }

  async submitWarrantyClaim(ctx: TenancyContext, raw: WarrantyClaimCreateInput) {
    const input = warrantyClaimCreateSchema.parse(raw)

    const { data: warranty, error: wErr } = await supabase
      .from('warranties')
      .select(
        'id, invoice_id, product_id, serial_number, start_date, end_date, warranty_months, customer_id',
      )
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.warrantyId)
      .maybeSingle()

    if (wErr) throw new DatabaseError('Failed to fetch warranty', wErr)
    if (!warranty) throw new NotFoundError('Warranty')

    const wRow = warranty as {
      id: string
      invoice_id: string
      product_id: string
      serial_number: string | null
      start_date: string
      end_date: string
      warranty_months: number
      customer_id: string | null
    }

    const active = isWarrantyActive(
      {
        id: wRow.id,
        invoiceId: wRow.invoice_id,
        productId: wRow.product_id,
        serialNumber: wRow.serial_number,
        startDate: String(wRow.start_date).slice(0, 10),
        endDate: String(wRow.end_date).slice(0, 10),
        warrantyMonths: Number(wRow.warranty_months),
        customerId: wRow.customer_id,
      },
      input.claimDate,
    )

    if (!active) {
      throw new ValidationError(WARRANTY_EXPIRED_CODE)
    }

    const { data: claim, error: cErr } = await supabase
      .from('warranty_claims')
      .insert({
        workspace_id: ctx.workspaceId,
        warranty_id: input.warrantyId,
        claim_date: input.claimDate,
        issue_description: input.issueDescription,
        status: 'pending',
        disposition: input.disposition,
        repair_ticket_id: input.repairTicketId ?? null,
        resolution_notes: input.resolutionNotes ?? null,
        actor_id: ctx.userId,
      })
      .select('*')
      .single()

    if (cErr) throw new DatabaseError('Failed to submit warranty claim', cErr)

    logBusinessEvent({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      entityType: 'warranty_claim',
      entityId: (claim as { id: string }).id,
      action: 'created',
      title: `Warranty claim submitted (${input.disposition})`,
      notifyType: 'info',
    }).catch((err) => console.error('[QualityService] logBusinessEvent failed:', err))

    return claim
  }
}

export const qualityService = new QualityService()
export default QualityService
