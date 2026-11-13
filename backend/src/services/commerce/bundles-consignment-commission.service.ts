// ============================================
// backend/src/services/commerce/bundles-consignment-commission.service.ts
//
// V61 B.2.8 bundles · B.2.10 consignment lots · B.2.9 seller commission.
//
// ⚠️ V61 audit (12 Nov 2026). The first version:
//   · saved a bundle with three separate writes (mark, DELETE all, INSERT),
//     ignoring two errors — a failed insert left a bundle with no components —
//     and never checked a component belonged to this business;
//   · recorded a consignment lot for any party, warehouse and product id;
//   · computed commission from `invoices.cost_total` (no such column — every
//     call was a 500), summed totals of EVERY currency into one number, scaled
//     by ×100 (wrong for AFN), and filtered on `invoices.seller_employee_id`,
//     which nothing in the product writes.
// Bundles now save through `product_bundle_set_items` (one transaction,
// bundles-consignment-commission-02). Every id is proven to be this
// workspace's. Commission refuses honestly until invoices record a seller.
// ============================================

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'

/** The bundle function is not installed yet — never fall back to delete-then-insert. */
export class BundleSaveNotInstalledError extends BaseError {
  constructor() {
    super('BUNDLE_SAVE_NOT_INSTALLED', 503)
    this.name = 'BundleSaveNotInstalledError'
  }
}

/** Codes `product_bundle_set_items` raises that the person can act on. */
const BUNDLE_REFUSALS = [
  'BUNDLE_COMPONENT_IS_SELF',
  'BUNDLE_COMPONENT_DUPLICATE',
  'BUNDLE_COMPONENT_NOT_FOUND',
  'BUNDLE_COMPONENT_IS_BUNDLE',
  'BUNDLE_PRODUCT_IS_COMPONENT',
  'BUNDLE_ITEM_INVALID',
] as const

function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883'
}

export class BundlesConsignmentCommissionService {
  private async assertProduct(tenancy: TenancyContext, productId: string): Promise<void> {
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('workspace_id', tenancy.workspaceId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to load product', error)
    if (!data) throw new NotFoundError('Product')
  }

  async getBundleItems(tenancy: TenancyContext, bundleProductId: string) {
    await this.assertProduct(tenancy, bundleProductId)
    const { data, error } = await supabase
      .from('bundle_items')
      .select('id, component_product_id, quantity')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('bundle_product_id', bundleProductId)
      .order('created_at', { ascending: true })
    if (error) throw new DatabaseError('Failed to load bundle items', error)
    return data ?? []
  }

  /** Replace the whole list in one transaction; an empty list makes it a standard product again. */
  async setBundleItems(
    tenancy: TenancyContext,
    bundleProductId: string,
    items: Array<{ component_product_id: string; quantity: number }>,
  ) {
    const { data, error } = await supabase.rpc('product_bundle_set_items', {
      p_workspace_id: tenancy.workspaceId,
      p_bundle_product_id: bundleProductId,
      p_items: items,
    })
    if (error) {
      if (isMissingFunction(error)) throw new BundleSaveNotInstalledError()
      const message = String(error.message ?? '')
      if (message.includes('BUNDLE_PRODUCT_NOT_FOUND')) throw new NotFoundError('Product')
      const refusal = BUNDLE_REFUSALS.find((code) => message.includes(code))
      if (refusal) throw new ValidationError(refusal)
      throw new DatabaseError('Failed to save bundle items', error)
    }
    return Array.isArray(data) ? data : []
  }

  async listConsignmentLots(tenancy: TenancyContext) {
    const { data, error } = await supabase
      .from('consignment_lots')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .order('created_at', { ascending: false })
    if (error) throw new DatabaseError('Failed to list consignment lots', error)
    return data ?? []
  }

  async createConsignmentLot(
    tenancy: TenancyContext,
    input: {
      direction: 'in' | 'out'
      party_id: string
      warehouse_id: string
      product_id: string
      quantity: number
      unit_agreed_price_minor: number
      currency: string
    },
  ) {
    const ws = tenancy.workspaceId
    const [party, warehouse, product] = await Promise.all([
      supabase
        .from('customers')
        .select('id')
        .eq('id', input.party_id)
        .eq('workspace_id', ws)
        .maybeSingle(),
      supabase
        .from('warehouses')
        .select('id')
        .eq('id', input.warehouse_id)
        .eq('workspace_id', ws)
        .maybeSingle(),
      supabase
        .from('products')
        .select('id')
        .eq('id', input.product_id)
        .eq('workspace_id', ws)
        .maybeSingle(),
    ])
    for (const read of [party, warehouse, product]) {
      if (read.error) throw new DatabaseError('Failed to check consignment references', read.error)
    }
    if (!party.data) throw new ValidationError('CONSIGNMENT_PARTY_NOT_FOUND')
    if (!warehouse.data) throw new ValidationError('CONSIGNMENT_WAREHOUSE_NOT_FOUND')
    if (!product.data) throw new ValidationError('CONSIGNMENT_PRODUCT_NOT_FOUND')

    const { data, error } = await supabase
      .from('consignment_lots')
      .insert({ workspace_id: ws, ...input })
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to create consignment lot', error)
    return data
  }

  /**
   * ⚠️ Not computable yet, and said so. Commission needs to know who SOLD each
   * invoice; `invoices.seller_employee_id` exists (migration 01) but no form,
   * import or engine writes it. Returning 0 would read as «this seller earned
   * nothing» — a false statement about a real person (§12). The owner decides
   * who «the seller» is (the person who recorded the sale, or a chosen
   * employee); until the invoice records it, this refuses with a clear code.
   */
  async getSellerCommissions(tenancy: TenancyContext): Promise<never> {
    const { count, error } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', tenancy.workspaceId)
      .not('seller_employee_id', 'is', null)
    if (error) throw new DatabaseError('Failed to check seller attribution', error)
    throw new ConflictError('SELLER_NOT_RECORDED_ON_INVOICES', { attributedInvoices: count ?? 0 })
  }
}

export const bundlesConsignmentCommissionService = new BundlesConsignmentCommissionService()
