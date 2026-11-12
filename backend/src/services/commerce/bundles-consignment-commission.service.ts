import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'
import { computeSellerCommission, type SellerCommissionDoc } from '@hisabche/validation'

export class BundlesConsignmentCommissionService {
  async getBundleItems(tenancy: TenancyContext, bundleProductId: string) {
    const { data, error } = await supabase
      .from('bundle_items')
      .select('*')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('bundle_product_id', bundleProductId)
    if (error) throw new DatabaseError('Failed to load bundle items', error)
    return data ?? []
  }

  async setBundleItems(
    tenancy: TenancyContext,
    bundleProductId: string,
    items: Array<{ component_product_id: string; quantity: number }>,
  ) {
    await supabase
      .from('products')
      .update({ kind: 'bundle', updated_at: new Date().toISOString() })
      .eq('id', bundleProductId)
      .eq('workspace_id', tenancy.workspaceId)

    await supabase
      .from('bundle_items')
      .delete()
      .eq('workspace_id', tenancy.workspaceId)
      .eq('bundle_product_id', bundleProductId)

    const { data, error } = await supabase
      .from('bundle_items')
      .insert(
        items.map((i) => ({
          workspace_id: tenancy.workspaceId,
          bundle_product_id: bundleProductId,
          component_product_id: i.component_product_id,
          quantity: i.quantity,
        })),
      )
      .select('*')
    if (error) throw new DatabaseError('Failed to save bundle items', error)
    return data ?? []
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
    const { data, error } = await supabase
      .from('consignment_lots')
      .insert({
        workspace_id: tenancy.workspaceId,
        ...input,
      })
      .select('*')
      .single()
    if (error || !data) throw new DatabaseError('Failed to create consignment lot', error)
    return data
  }

  async getSellerCommissions(
    tenancy: TenancyContext,
    sellerEmployeeId: string,
    ratePercent: number,
    basis: 'revenue' | 'margin',
  ) {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, total, cost_total, status')
      .eq('workspace_id', tenancy.workspaceId)
      .eq('seller_employee_id', sellerEmployeeId)
      .neq('status', 'cancelled')
    if (error) throw new DatabaseError('Failed to query seller invoices', error)

    const docs: SellerCommissionDoc[] = (invoices ?? []).map((inv: Record<string, unknown>) => ({
      sellerEmployeeId,
      kind: 'sale',
      revenueMinor: Math.round(Number(inv.total ?? 0) * 100),
      costMinor:
        inv.cost_total === null || inv.cost_total === undefined
          ? null
          : Math.round(Number(inv.cost_total) * 100),
      ratePercent,
      basis,
    }))

    return {
      sellerEmployeeId,
      commissionMinor: computeSellerCommission(docs),
      invoiceCount: docs.length,
    }
  }
}

export const bundlesConsignmentCommissionService = new BundlesConsignmentCommissionService()
