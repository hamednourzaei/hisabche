// ============================================
// backend/src/services/purchasing/rfq-contracts.service.ts
//
// V61 B.2.13 / B.2.14 — requests for quotation, supplier quotations, and the
// agreed prices of a long-term purchase contract.
//
// ⚠️ V61 audit (12 Nov 2026). The first version:
//   · added a quotation to ANY rfq id (another business's included) for ANY
//     supplier and product id, unchecked;
//   · chose a quotation with three separate writes (purchase order, quotation,
//     RFQ), ignored two of the errors, booked `total_minor / 100` (wrong for
//     AFN, which has no minor unit), used the UTC date, and a double click made
//     two purchase orders — into `purchase_orders`, which no screen reads.
// Now every id is proven to be this workspace's, and «choose» is ONE Postgres
// function (`rfq_choose_quotation`, rfq-purchase-contracts-02) that creates no
// purchase document: the purchase invoice is recorded from the invoice
// builder, the one place purchases live.
// ============================================

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { BaseError } from '../../errors/base.error'
import type { TenancyContext } from '../tenancy.service'

/** The database function is not installed yet — never fall back to the old three writes. */
export class RfqChooseNotInstalledError extends BaseError {
  constructor() {
    super('RFQ_CHOOSE_NOT_INSTALLED', 503)
    this.name = 'RfqChooseNotInstalledError'
  }
}

/** Codes `rfq_choose_quotation` raises, and what each means to the caller. */
const CHOOSE_CONFLICTS = ['RFQ_NOT_OPEN', 'QUOTATION_NOT_OPEN', 'QUOTATION_EXPIRED'] as const
const CHOOSE_NOT_FOUND = ['RFQ_QUOTATION_NOT_FOUND', 'RFQ_NOT_FOUND'] as const

function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883'
}

export class RfqContractsService {
  async listRfqs(tenancy: TenancyContext) {
    const { data, error } = await supabase
      .from('rfqs')
      .select('*, supplier_quotations(*)')
      .eq('workspace_id', tenancy.workspaceId)
      .order('created_at', { ascending: false })
    if (error) throw new DatabaseError('Failed to list RFQs', error)
    return data ?? []
  }

  async createRfq(tenancy: TenancyContext, title: string) {
    const { data, error } = await supabase
      .from('rfqs')
      .insert({ workspace_id: tenancy.workspaceId, title, created_by: tenancy.userId })
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to create RFQ', error)
    return data
  }

  /** The party is this workspace's own (suppliers are parties, like customers). */
  private async assertParty(tenancy: TenancyContext, partyId: string, code: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('id', partyId)
      .eq('workspace_id', tenancy.workspaceId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to load supplier', error)
    if (!data) throw new ValidationError(code)
  }

  /** Every product is this workspace's own. */
  private async assertProducts(tenancy: TenancyContext, productIds: string[]) {
    const unique = [...new Set(productIds)]
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('workspace_id', tenancy.workspaceId)
      .in('id', unique)
    if (error) throw new DatabaseError('Failed to load products', error)
    if ((data ?? []).length !== unique.length) throw new ValidationError('RFQ_PRODUCT_NOT_FOUND')
  }

  async addQuotation(
    tenancy: TenancyContext,
    rfqId: string,
    input: {
      supplier_id: string
      currency: string
      valid_until: string
      lead_time_days: number
      lines: Array<{ product_id: string; quantity: number; unit_price_minor: number }>
    },
  ) {
    const { data: rfq, error: rfqErr } = await supabase
      .from('rfqs')
      .select('id, status')
      .eq('id', rfqId)
      .eq('workspace_id', tenancy.workspaceId)
      .maybeSingle()
    if (rfqErr) throw new DatabaseError('Failed to load RFQ', rfqErr)
    if (!rfq) throw new NotFoundError('RFQ')
    if (rfq.status !== 'open') throw new ConflictError('RFQ_NOT_OPEN')

    await this.assertParty(tenancy, input.supplier_id, 'RFQ_SUPPLIER_NOT_FOUND')
    await this.assertProducts(
      tenancy,
      input.lines.map((l) => l.product_id),
    )

    const supplierId = input.supplier_id
    const totalMinor = input.lines.reduce(
      (s, l) => s + Math.round(l.quantity * l.unit_price_minor),
      0,
    )
    const { data, error } = await supabase
      .from('supplier_quotations')
      .insert({
        workspace_id: tenancy.workspaceId,
        rfq_id: rfqId,
        supplier_id: supplierId,
        currency: input.currency,
        valid_until: input.valid_until.slice(0, 10),
        lead_time_days: input.lead_time_days,
        lines: input.lines,
        total_minor: totalMinor,
      })
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to submit quotation', error)
    return data
  }

  /**
   * Choose one quotation: it becomes «chosen», the RFQ's other open
   * quotations «rejected», the RFQ «awarded» — one transaction, or nothing.
   * `businessDay` is the business's own date (never the UTC one).
   */
  async chooseQuotation(tenancy: TenancyContext, quotationId: string, businessDay: string) {
    const { data, error } = await supabase.rpc('rfq_choose_quotation', {
      p_workspace_id: tenancy.workspaceId,
      p_quotation_id: quotationId,
      p_today: businessDay,
    })
    if (error) {
      if (isMissingFunction(error)) throw new RfqChooseNotInstalledError()
      const message = String(error.message ?? '')
      const conflict = CHOOSE_CONFLICTS.find((code) => message.includes(code))
      if (conflict) throw new ConflictError(conflict)
      if (CHOOSE_NOT_FOUND.some((code) => message.includes(code))) {
        throw new NotFoundError('Quotation')
      }
      throw new DatabaseError('Failed to choose quotation', error)
    }
    return data
  }

  async listPurchaseContractPrices(tenancy: TenancyContext, supplierId?: string) {
    let q = supabase
      .from('purchase_contract_prices')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .order('valid_from', { ascending: false })
    if (supplierId) q = q.eq('supplier_id', supplierId)
    const { data, error } = await q
    if (error) throw new DatabaseError('Failed to list purchase contract prices', error)
    return data ?? []
  }

  async upsertPurchaseContractPrice(
    tenancy: TenancyContext,
    input: {
      contract_id: string
      supplier_id: string
      product_id: string
      agreed_unit_price_minor: number
      currency: string
      valid_from: string
      valid_to: string
    },
  ) {
    const validFrom = input.valid_from.slice(0, 10)
    const validTo = input.valid_to.slice(0, 10)
    if (validTo < validFrom) throw new ValidationError('CONTRACT_PRICE_DATES_REVERSED')

    // The contract is this workspace's, and it is WITH this supplier.
    const { data: contract, error: contractErr } = await supabase
      .from('contracts')
      .select('id, customer_id, currency')
      .eq('id', input.contract_id)
      .eq('workspace_id', tenancy.workspaceId)
      .maybeSingle()
    if (contractErr) throw new DatabaseError('Failed to load contract', contractErr)
    if (!contract) throw new ValidationError('CONTRACT_NOT_FOUND')
    if (contract.customer_id !== input.supplier_id) {
      throw new ValidationError('CONTRACT_SUPPLIER_MISMATCH')
    }
    if (contract.currency && contract.currency !== input.currency) {
      throw new ValidationError('CONTRACT_PRICE_CURRENCY_MISMATCH')
    }
    await this.assertProducts(tenancy, [input.product_id])

    const { data, error } = await supabase
      .from('purchase_contract_prices')
      .upsert(
        {
          workspace_id: tenancy.workspaceId,
          ...input,
          valid_from: validFrom,
          valid_to: validTo,
        },
        { onConflict: 'workspace_id,contract_id,product_id' },
      )
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to save contract price', error)
    return data
  }
}

export const rfqContractsService = new RfqContractsService()
