// These batch loaders fetch SHARED business entities by id. The workspace
// filter is what makes accepting a caller-supplied id list safe — `.in('id', …)`
// alone would happily return another business's rows.
// ============================================
// backend/src/utils/batch.ts
// Hisabche v2.0 — N+1 Query Eliminator
// ============================================

import { supabase } from '../db'

// ═══════════════════════════════════════════
// Batch Fetchers — N کوئری → ۱ کوئری
// ═══════════════════════════════════════════

export async function batchGetProducts(
  productIds: string[],
  workspaceId: string,
): Promise<Record<string, any>> {
  if (!productIds.length) return {}

  const { data, error } = await supabase
    .from('products')
    .select('id, name, sell_price, buy_price, quantity, unit, sku, barcode')
    .in('id', productIds)
    .eq('workspace_id', workspaceId)

  if (error) throw error

  const map: Record<string, any> = {}
  for (const item of data || []) {
    map[item.id] = item
  }
  return map
}

export async function batchGetCustomers(
  customerIds: string[],
  workspaceId: string,
): Promise<Record<string, any>> {
  if (!customerIds.length) return {}

  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, opening_balance, is_active, type')
    .in('id', customerIds)
    .eq('workspace_id', workspaceId)

  if (error) throw error

  const map: Record<string, any> = {}
  for (const item of data || []) {
    map[item.id] = item
  }
  return map
}

export async function batchGetInvoices(
  invoiceIds: string[],
  workspaceId: string,
): Promise<Record<string, any>> {
  if (!invoiceIds.length) return {}

  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, status, customer_id, date')
    .in('id', invoiceIds)
    .eq('workspace_id', workspaceId)

  if (error) throw error

  const map: Record<string, any> = {}
  for (const item of data || []) {
    map[item.id] = item
  }
  return map
}

// ═══════════════════════════════════════════
// Parallel Query Runner
// ═══════════════════════════════════════════

export async function parallelQueries<T extends Record<string, Promise<any>>>(
  queries: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const keys = Object.keys(queries) as (keyof T)[]
  const values = Object.values(queries)

  const results = await Promise.allSettled(values)

  const output: any = {}
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      output[keys[index]] = result.value
    } else {
      console.error(`Query "${String(keys[index])}" failed:`, result.reason)
      output[keys[index]] = null
    }
  })

  return output
}
