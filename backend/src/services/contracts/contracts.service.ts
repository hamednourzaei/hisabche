// ============================================
// backend/src/services/contracts/contracts.service.ts
//
// V60 Slice 9 — Contracts, recurring obligations, lease return & SLAs.
// Delegates billing to InvoiceService.create (idempotent per contract + periodKey),
// records the deposit ON THE CONTRACT (no revenue), frees lease bookings
// through SalonService + routeReturnConditionDisposition.
//
// 12 Nov 2026 audit: the deposit was described as «held as liability» but nothing is posted
// to the ledger — the contract only records the amount agreed. Receiving the money is a
// payment; the log now says exactly that. Lease return wrote serial statuses the database
// refuses (`quarantined` / `available`, CHECK allows in_stock · reserved · sold · returned ·
// scrapped) and ignored the error, so it «succeeded» without changing anything. Three other
// writes/reads here also dropped their error.
// ============================================

import { FRACTION_DIGITS } from '@hisabche/formatting'
import {
  canBillContractPeriod,
  contractBillIdempotencyKey,
  evaluateSlaBreach,
  routeReturnConditionDisposition,
  type ContractCreateInput,
  type ContractStatus,
  type ReturnCondition,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { invalidateMoneyCaches } from '../../utils/money-cache'
import { baseCurrencyOf } from '../base-currency'
import { logBusinessEvent } from '../event-log.service'
import { InvoiceService } from '../invoice.service'
import { SalonService } from '../salon/salon.service'
import type { TenancyContext } from '../tenancy.service'

const digitsOf = (currency: string): number =>
  (FRACTION_DIGITS as Record<string, number>)[currency] ?? 2

export interface ContractRow {
  id: string
  workspace_id: string
  customer_id: string
  contract_type: string
  status: ContractStatus
  title: string
  currency: string
  amount_minor: number
  deposit_minor: number
  billing_cadence: string
  start_date: string
  end_date: string | null
  terminated_at: string | null
  sla_response_hours: number | null
  sla_breached_at: string | null
  sla_breach_reason: string | null
  resource_booking_id: string | null
  serial_id: string | null
}

/**
 * The serial's status after a lease return, in the values `stock_serials_status_check` allows:
 * sellable → `in_stock` (rentable again); quarantine → `returned` (back, held, not rentable);
 * scrap → `scrapped`.
 */
export function leaseReturnSerialStatus(
  bucket: 'sellable_stock' | 'quarantine' | 'scrap',
): 'in_stock' | 'returned' | 'scrapped' {
  if (bucket === 'sellable_stock') return 'in_stock'
  if (bucket === 'quarantine') return 'returned'
  return 'scrapped'
}

export class ContractsService {
  async listContracts(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })

    if (error) throw new DatabaseError('Failed to list contracts', error)
    return data ?? []
  }

  async createContract(ctx: TenancyContext, input: ContractCreateInput) {
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.customerId)
      .maybeSingle()

    if (custErr) throw new DatabaseError('Failed to verify customer', custErr)
    if (!customer) throw new ValidationError('CONTRACT_CUSTOMER_NOT_FOUND')

    const currency = input.currency ?? (await baseCurrencyOf(ctx.workspaceId))

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        workspace_id: ctx.workspaceId,
        customer_id: input.customerId,
        contract_type: input.contractType,
        status: 'active',
        title: input.title,
        currency,
        amount_minor: input.amountMinor,
        deposit_minor: input.depositMinor,
        billing_cadence: input.billingCadence,
        start_date: input.startDate,
        end_date: input.endDate ?? null,
        sla_response_hours: input.slaResponseHours ?? null,
        resource_booking_id: input.resourceBookingId ?? null,
        serial_id: input.serialId ?? null,
        created_by: ctx.userId,
      })
      .select('*')
      .single()

    if (error) throw new DatabaseError('Failed to create contract', error)

    if (input.depositMinor > 0) {
      await logBusinessEvent({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        entityType: 'contract',
        entityId: String((data as { id: string }).id),
        action: 'contract_deposit_recorded',
        title: `Security deposit agreed on contract ${input.title} (recorded on the contract, not posted to the books)`,
        metadata: { depositMinor: input.depositMinor, currency },
        notify: false,
      })
    }

    return data as ContractRow
  }

  async billPeriod(
    ctx: TenancyContext,
    contractId: string,
    input: { periodKey: string; dueDate: string },
  ) {
    const { data: raw, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', contractId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to read contract', error)
    if (!raw) throw new NotFoundError('Contract')

    const contract = raw as ContractRow
    if (!canBillContractPeriod(contract.status)) {
      throw new ConflictError('CONTRACT_NOT_ACTIVE')
    }

    const { data: existingOb, error: existingErr } = await supabase
      .from('contract_obligations')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('contract_id', contractId)
      .eq('kind', 'bill')
      .eq('period_key', input.periodKey)
      .maybeSingle()
    if (existingErr) throw new DatabaseError('Failed to read the billing period', existingErr)

    if (existingOb && existingOb.status === 'completed' && existingOb.invoice_id) {
      return {
        replayed: true,
        invoiceId: String(existingOb.invoice_id),
        periodKey: input.periodKey,
      }
    }

    const idempotencyKey = contractBillIdempotencyKey(contractId, input.periodKey)
    if (!existingOb) {
      const { error: obErr } = await supabase.from('contract_obligations').insert({
        workspace_id: ctx.workspaceId,
        contract_id: contractId,
        kind: 'bill',
        period_key: input.periodKey,
        due_date: input.dueDate,
        status: 'pending',
        idempotency_key: idempotencyKey,
      })
      if (obErr) {
        if (obErr.code === '23505') {
          const { data: raced, error: racedErr } = await supabase
            .from('contract_obligations')
            .select('invoice_id, status')
            .eq('workspace_id', ctx.workspaceId)
            .eq('contract_id', contractId)
            .eq('kind', 'bill')
            .eq('period_key', input.periodKey)
            .maybeSingle()
          if (racedErr) throw new DatabaseError('Failed to read the billing period', racedErr)
          if (raced?.invoice_id) {
            return {
              replayed: true,
              invoiceId: String(raced.invoice_id),
              periodKey: input.periodKey,
            }
          }
          throw new ConflictError('CONTRACT_PERIOD_ALREADY_CLAIMED')
        }
        throw new DatabaseError('Failed to reserve billing period', obErr)
      }
    }

    const amountMajor = contract.amount_minor / 10 ** digitsOf(contract.currency)
    const invoiceService = new InvoiceService()
    const created = await invoiceService.create(ctx, {
      type: 'sale',
      date: input.dueDate,
      customerId: contract.customer_id,
      currency: contract.currency,
      paymentMethod: 'credit',
      paidAmount: 0,
      idempotencyKey,
      items: [
        {
          productName: `${contract.title} (${input.periodKey})`,
          quantity: 1,
          unitPrice: amountMajor,
        },
      ],
    } as Parameters<InvoiceService['create']>[1])

    const invoiceId = String((created as { id: string }).id)
    const { error: closeErr } = await supabase
      .from('contract_obligations')
      .update({
        status: 'completed',
        invoice_id: invoiceId,
        completed_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('contract_id', contractId)
      .eq('kind', 'bill')
      .eq('period_key', input.periodKey)
    // The invoice exists; a retry replays it through the same idempotency key and closes the
    // period then. Saying «done» while the period still reads «pending» would be the lie.
    if (closeErr) throw new DatabaseError('Failed to close the billing period', closeErr)

    await invalidateMoneyCaches(ctx.workspaceId)
    return { replayed: false, invoiceId, periodKey: input.periodKey }
  }

  async terminateContract(ctx: TenancyContext, contractId: string) {
    const { data, error } = await supabase
      .from('contracts')
      .update({
        status: 'terminated',
        terminated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', contractId)
      .select('*')
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to terminate contract', error)
    if (!data) throw new NotFoundError('Contract')

    // Stops ONLY pending future obligations; completed history remains untouched.
    const { error: cancelErr } = await supabase
      .from('contract_obligations')
      .update({ status: 'cancelled' })
      .eq('workspace_id', ctx.workspaceId)
      .eq('contract_id', contractId)
      .eq('status', 'pending')
    if (cancelErr) throw new DatabaseError('Failed to cancel pending obligations', cancelErr)

    return data as ContractRow
  }

  async flagSlaBreach(
    ctx: TenancyContext,
    contractId: string,
    input: { reason: string; elapsedHours: number },
  ) {
    const { data: raw, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', contractId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to load contract', error)
    if (!raw) throw new NotFoundError('Contract')

    const contract = raw as ContractRow
    const evaluation = evaluateSlaBreach(contract.sla_response_hours, input.elapsedHours)
    if (!evaluation.breached) {
      return { evaluation, contract }
    }

    const { data: updated, error: updErr } = await supabase
      .from('contracts')
      .update({
        sla_breached_at: new Date().toISOString(),
        sla_breach_reason: input.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', contractId)
      .select('*')
      .single()

    if (updErr) throw new DatabaseError('Failed to flag SLA breach', updErr)

    await logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'contract',
      entityId: contractId,
      action: 'contract_sla_breached',
      title: `SLA breach flagged: ${input.reason}`,
      metadata: {
        elapsedHours: input.elapsedHours,
        slaResponseHours: contract.sla_response_hours,
        penaltyMinor: evaluation.penaltyMinor,
      },
      notify: true,
    })

    return { evaluation, contract: updated as ContractRow }
  }

  async returnLeaseAsset(
    ctx: TenancyContext,
    contractId: string,
    input: { conditionCode: ReturnCondition; notes?: string | undefined },
  ) {
    const { data: raw, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', contractId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to load contract', error)
    if (!raw) throw new NotFoundError('Contract')
    const contract = raw as ContractRow

    // A damaged rental comes back to quarantine, not to the scrap heap: writing an asset off is
    // a person's decision, never a side effect of a return.
    const disposition = routeReturnConditionDisposition({
      conditionCode: input.conditionCode,
      restockChoice: 'restock',
    })

    if (contract.serial_id) {
      const { error: serialErr } = await supabase
        .from('stock_serials')
        .update({ status: leaseReturnSerialStatus(disposition.bucket) })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', contract.serial_id)
      if (serialErr) throw new DatabaseError('Failed to update the returned serial', serialErr)
    }

    if (contract.resource_booking_id) {
      await new SalonService().releaseResourceBooking(ctx, contract.resource_booking_id)
    }

    await logBusinessEvent({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      entityType: 'contract',
      entityId: contractId,
      action: 'lease_asset_returned',
      title: `Leased asset returned (${input.conditionCode})`,
      metadata: {
        conditionCode: input.conditionCode,
        dispositionBucket: disposition.bucket,
        notes: input.notes ?? null,
      },
      notify: false,
    })

    return { contractId, disposition }
  }
}
