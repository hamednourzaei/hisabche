import { supabase } from '../../db'
import { DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { canConvertQuotationToPo } from '@hisabche/validation'

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
    const totalMinor = input.lines.reduce(
      (s, l) => s + Math.round(l.quantity * l.unit_price_minor),
      0,
    )
    const supplierId = input.supplier_id
    const { data, error } = await supabase
      .from('supplier_quotations')
      .insert({
        workspace_id: tenancy.workspaceId,
        rfq_id: rfqId,
        supplier_id: supplierId,
        currency: input.currency,
        valid_until: input.valid_until,
        lead_time_days: input.lead_time_days,
        lines: input.lines,
        total_minor: totalMinor,
      })
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to submit quotation', error)
    return data
  }

  async chooseQuotation(tenancy: TenancyContext, quotationId: string, todayIso: string) {
    const { data: q, error } = await supabase
      .from('supplier_quotations')
      .select('*')
      .eq('id', quotationId)
      .eq('workspace_id', tenancy.workspaceId)
      .single()
    if (error) throw new DatabaseError('Failed to load quotation', error)
    if (!q) throw new NotFoundError('Quotation')

    const check = canConvertQuotationToPo(
      { validUntil: String(q.valid_until), status: String(q.status) },
      todayIso,
    )
    if (!check.ok) throw new ValidationError(check.code)

    const { data: po, error: poErr } = await supabase
      .from('purchase_orders')
      .insert({
        workspace_id: tenancy.workspaceId,
        supplier_id: q.supplier_id,
        currency: q.currency,
        status: 'draft',
        total: Number(q.total_minor) / 100,
        created_by: tenancy.userId,
      })
      .select('*')
      .single()
    if (poErr || !po) throw new DatabaseError('Failed to convert quotation to PO', poErr)

    await supabase
      .from('supplier_quotations')
      .update({ status: 'chosen', converted_po_id: po.id })
      .eq('id', q.id)
      .eq('workspace_id', tenancy.workspaceId)

    await supabase
      .from('rfqs')
      .update({ status: 'awarded' })
      .eq('id', q.rfq_id)
      .eq('workspace_id', tenancy.workspaceId)

    return po
  }

  async listPurchaseContractPrices(tenancy: TenancyContext, supplierId?: string) {
    let q = supabase
      .from('purchase_contract_prices')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
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
    const { data, error } = await supabase
      .from('purchase_contract_prices')
      .upsert(
        { workspace_id: tenancy.workspaceId, ...input },
        { onConflict: 'workspace_id,contract_id,product_id' },
      )
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to save contract price', error)
    return data
  }
}

export const rfqContractsService = new RfqContractsService()
