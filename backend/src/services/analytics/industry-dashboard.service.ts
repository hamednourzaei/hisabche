// ============================================
// backend/src/services/analytics/industry-dashboard.service.ts
//
// V69.5 — the four representative industry dashboard parts. Read-only summaries
// composed from engines that already exist (`service-delivery`, `package-credits`,
// `repair`, variants/stock). No new domain capability is introduced here.
//
// Rules this file obeys:
//   - `workspace_id` is in every query, and only from the TenancyContext.
//   - A failed read throws; it never renders as «you have no data».
//   - Unknown is not zero: a count we could not read raises, and a variant whose
//     reorder level was never configured is not reported as «low».
//   - Money is grouped by currency, never summed across currencies.
// ============================================

import {
  grantStatusesFromRows,
  type LedgerAllocationFact,
  type PackageLedgerRowFact,
} from '@hisabche/validation'

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { businessDayOf } from '../../utils/local-day'
import { baseCurrencyOf } from '../base-currency'
import type { TenancyContext } from '../tenancy.service'

/** A package with this many sessions left (or fewer) is worth showing. */
const LOW_PACKAGE_CREDIT_THRESHOLD = 2
/** Postgres / PostgREST: the column or table is not deployed yet. */
const NOT_DEPLOYED = new Set(['42703', 'PGRST204', '42P01', 'PGRST205'])

type DbError = { message: string; code?: string }

function isNotDeployed(error: DbError | null): boolean {
  return Boolean(error && error.code && NOT_DEPLOYED.has(error.code))
}

function asNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function parseAttributes(raw: unknown): Array<{ name: string; value: string }> {
  let list: unknown = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  return list
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null,
    )
    .map((entry) => ({ name: String(entry.name ?? ''), value: String(entry.value ?? '') }))
}

/** Names for a set of ids, read in chunks so a big day is still one honest read. */
async function namesById(
  table: 'customers' | 'employees' | 'products',
  workspaceId: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const names = new Map<string, string>()
  const column = table === 'products' ? 'name' : 'full_name'
  for (let index = 0; index < unique.length; index += 200) {
    const chunk = unique.slice(index, index + 200)
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .eq('workspace_id', workspaceId)
      .in('id', chunk)
      .returns<Array<Record<string, unknown>>>()
    if (error) throw new DatabaseError(`Failed to read ${table} names`, error)
    for (const row of data ?? []) {
      names.set(String(row.id), String(row[column] ?? ''))
    }
  }
  return names
}

export interface LowStockVariantItem {
  variantId: string
  templateProductId: string
  productName: string
  sku: string
  attributes: Array<{ name: string; value: string }>
  currentStock: number
  minStock: number
}

export interface TodaySessionItem {
  id: string
  customerId: string
  customerName: string
  serviceId: string
  serviceName: string
  practitionerId: string | null
  practitionerName: string | null
  status: string
  time: string
  endTime: string
  settlementMethod: string
}

export interface PackageCreditLowItem {
  customerId: string
  customerName: string
  packageProductId: string
  packageName: string
  totalCredits: number
  remainingCredits: number
}

export interface OpenRepairTicketItem {
  id: string
  number: string
  customerId: string
  customerName: string
  deviceLabel: string
  problem: string
  status: string
  technicianId: string | null
  technicianName: string | null
  createdAt: string
}

interface LedgerRow {
  id: string
  customer_id: string
  package_product_id: string
  entry_type: string
  quantity: number | string
  reference_entry_id: string | null
  effective_date: string
  deferred_amount: number | string | null
  term_months: number | null
}

export class IndustryDashboardService {
  /** Size/colour stock below the product's reorder level. */
  async lowStockVariants(ctx: TenancyContext) {
    const workspaceId = ctx.workspaceId

    const movements = await selectAllPages<
      { variant_id: string | null; quantity: number | string },
      DbError
    >((from, to) =>
      supabase
        .from('stock_movements')
        .select('variant_id, quantity')
        .eq('workspace_id', workspaceId)
        .not('variant_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (isNotDeployed(movements.error)) {
      // variant-stock-01 is not applied: the number cannot be read, it is not zero.
      return {
        items: [] as LowStockVariantItem[],
        totalLowStock: 0,
        variantsCount: null,
        hidden: false,
        unavailable: true,
      }
    }
    if (movements.error) throw new DatabaseError('Failed to read variant stock', movements.error)

    const stock = new Map<string, number>()
    for (const movement of movements.data ?? []) {
      if (!movement.variant_id) continue
      stock.set(
        movement.variant_id,
        (stock.get(movement.variant_id) ?? 0) + asNumber(movement.quantity),
      )
    }

    const variants = await selectAllPages<
      {
        id: string
        template_product_id: string
        sku: string
        attributes: unknown
      },
      DbError
    >((from, to) =>
      supabase
        .from('product_variants')
        .select('id, template_product_id, sku, attributes')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (isNotDeployed(variants.error)) {
      return {
        items: [] as LowStockVariantItem[],
        totalLowStock: 0,
        variantsCount: null,
        hidden: false,
        unavailable: true,
      }
    }
    if (variants.error) throw new DatabaseError('Failed to read product variants', variants.error)

    const products = await selectAllPages<
      { id: string; name: string; min_stock_level: number | string | null },
      DbError
    >((from, to) =>
      supabase
        .from('products')
        .select('id, name, min_stock_level')
        .eq('workspace_id', workspaceId)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (products.error) throw new DatabaseError('Failed to read products', products.error)

    const productById = new Map((products.data ?? []).map((row) => [row.id, row]))
    const items: LowStockVariantItem[] = []
    for (const variant of variants.data ?? []) {
      const product = productById.get(variant.template_product_id)
      const minStock = asNumber(product?.min_stock_level)
      // No reorder level configured = no threshold to call «low» against.
      if (minStock <= 0) continue
      const currentStock = stock.get(variant.id) ?? 0
      if (currentStock > minStock) continue
      items.push({
        variantId: variant.id,
        templateProductId: variant.template_product_id,
        productName: product?.name ?? '',
        sku: variant.sku,
        attributes: parseAttributes(variant.attributes),
        currentStock,
        minStock,
      })
    }
    items.sort((a, b) => a.currentStock - b.currentStock)
    return {
      items,
      totalLowStock: items.length,
      variantsCount: (variants.data ?? []).length,
      hidden: false,
      unavailable: false,
    }
  }

  /** Today's sessions by practitioner/status, and the advances still held. */
  async todaySessions(ctx: TenancyContext) {
    const workspaceId = ctx.workspaceId
    const today = businessDayOf(new Date(), ctx.timeZone)

    const sessions = await selectAllPages<
      {
        id: string
        customer_id: string
        service_offering_id: string
        practitioner_id: string | null
        status: string
        start_time: string | null
        end_time: string | null
        settlement_method: string
      },
      DbError
    >((from, to) =>
      supabase
        .from('service_delivery_sessions')
        .select(
          'id, customer_id, service_offering_id, practitioner_id, status, start_time, end_time, settlement_method',
        )
        .eq('workspace_id', workspaceId)
        .eq('session_date', today)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (sessions.error) throw new DatabaseError('Failed to read today sessions', sessions.error)

    const rows = (sessions.data ?? []) as Array<{
      id: string
      customer_id: string
      service_offering_id: string
      practitioner_id: string | null
      status: string
      start_time: string | null
      end_time: string | null
      settlement_method: string
    }>

    const [customers, services, practitioners] = await Promise.all([
      namesById(
        'customers',
        workspaceId,
        rows.map((row) => row.customer_id),
      ),
      namesById(
        'products',
        workspaceId,
        rows.map((row) => row.service_offering_id),
      ),
      namesById(
        'employees',
        workspaceId,
        rows.map((row) => row.practitioner_id).filter((id): id is string => Boolean(id)),
      ),
    ])

    const byStatus: Record<string, number> = {}
    const byPractitioner: Record<string, number> = {}
    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
      if (row.practitioner_id) {
        byPractitioner[row.practitioner_id] = (byPractitioner[row.practitioner_id] ?? 0) + 1
      }
    }

    const deposits = await this.depositsHeld(ctx)
    return {
      date: today,
      sessions: rows.map<TodaySessionItem>((row) => ({
        id: row.id,
        customerId: row.customer_id,
        customerName: customers.get(row.customer_id) ?? '',
        serviceId: row.service_offering_id,
        serviceName: services.get(row.service_offering_id) ?? '',
        practitionerId: row.practitioner_id,
        practitionerName: row.practitioner_id
          ? (practitioners.get(row.practitioner_id) ?? '')
          : null,
        status: row.status,
        time: row.start_time ?? '',
        endTime: row.end_time ?? '',
        settlementMethod: row.settlement_method,
      })),
      byStatus,
      byPractitioner,
      totalSessions: rows.length,
      depositsHeld: deposits,
      hidden: false,
    }
  }

  /** Unapplied customer advances, one row per currency. Never one mixed total. */
  private async depositsHeld(ctx: TenancyContext) {
    const workspaceId = ctx.workspaceId
    const currency = await baseCurrencyOf(workspaceId)
    const deposits = await selectAllPages<
      { id: string; amount_minor: number | string; currency: string | null },
      DbError
    >((from, to) =>
      supabase
        .from('order_deposits')
        .select('id, amount_minor, currency')
        .eq('workspace_id', workspaceId)
        .is('applied_invoice_id', null)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (isNotDeployed(deposits.error)) return [] as Array<{ currency: string; amountMinor: number }>
    if (deposits.error) throw new DatabaseError('Failed to read held advances', deposits.error)

    const byCurrency = new Map<string, number>()
    for (const row of deposits.data ?? []) {
      const code = row.currency ?? currency
      byCurrency.set(code, (byCurrency.get(code) ?? 0) + asNumber(row.amount_minor))
    }
    return [...byCurrency.entries()]
      .map(([code, amountMinor]) => ({ currency: code, amountMinor }))
      .sort((a, b) => (a.currency < b.currency ? -1 : 1))
  }

  /** Packages with `LOW_PACKAGE_CREDIT_THRESHOLD` sessions or fewer left. */
  async packageCreditsLow(ctx: TenancyContext) {
    const workspaceId = ctx.workspaceId
    const today = businessDayOf(new Date(), ctx.timeZone)

    const ledger = await selectAllPages<LedgerRow, DbError>((from, to) =>
      supabase
        .from('package_credit_ledger')
        .select(
          'id, customer_id, package_product_id, entry_type, quantity, reference_entry_id, effective_date, deferred_amount, term_months',
        )
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (isNotDeployed(ledger.error)) {
      return {
        items: [] as PackageCreditLowItem[],
        lowCount: 0,
        packagesCount: null,
        hidden: false,
        unavailable: true,
      }
    }
    if (ledger.error) throw new DatabaseError('Failed to read the package ledger', ledger.error)

    const allocationRes = await selectAllPages<
      {
        entry_id: string
        grant_entry_id: string | null
        kind: 'CONSUME' | 'REVERSAL'
        quantity: number | string
        released_amount: number | string
        effective_date: string
      },
      DbError
    >((from, to) =>
      supabase
        .from('package_credit_allocations')
        .select('entry_id, grant_entry_id, kind, quantity, released_amount, effective_date')
        .eq('workspace_id', workspaceId)
        .order('entry_id', { ascending: true })
        .range(from, to),
    )
    const allocations: LedgerAllocationFact[] =
      allocationRes.error && isNotDeployed(allocationRes.error)
        ? []
        : allocationRes.error
          ? (() => {
              throw new DatabaseError('Failed to read the package allocations', allocationRes.error)
            })()
          : (allocationRes.data ?? []).map((row) => ({
              entryId: row.entry_id,
              grantId: row.grant_entry_id,
              kind: row.kind,
              quantity: asNumber(row.quantity),
              releasedAmount: asNumber(row.released_amount),
              effectiveDate: row.effective_date,
            }))

    const factsByGroup = new Map<
      string,
      { customerId: string; packageProductId: string; rows: PackageLedgerRowFact[] }
    >()
    for (const row of ledger.data ?? []) {
      const fact: PackageLedgerRowFact = {
        id: row.id,
        entryType: row.entry_type,
        quantity: asNumber(row.quantity),
        referenceEntryId: row.reference_entry_id,
        effectiveDate: row.effective_date,
        deferredAmount: row.deferred_amount == null ? null : asNumber(row.deferred_amount),
        termMonths: row.term_months ?? null,
      }
      const key = `${row.customer_id}::${row.package_product_id}`
      const group = factsByGroup.get(key)
      if (group) group.rows.push(fact)
      else
        factsByGroup.set(key, {
          customerId: row.customer_id,
          packageProductId: row.package_product_id,
          rows: [fact],
        })
    }

    const low: Array<{
      customerId: string
      packageProductId: string
      totalCredits: number
      remainingCredits: number
    }> = []

    for (const group of factsByGroup.values()) {
      const statuses = grantStatusesFromRows({
        rows: group.rows,
        allocations,
        // A suspended GRANT keeps its balance: suspension changes usability, not
        // what is left, so the count below is the same with or without it.
        suspensions: [],
        today,
      })
      if (statuses.length === 0) continue
      const remainingCredits = statuses.reduce((sum, status) => sum + status.remaining, 0)
      if (remainingCredits > LOW_PACKAGE_CREDIT_THRESHOLD) continue
      const totalCredits =
        group.rows
          .filter((row) => row.entryType === 'GRANT')
          .reduce((sum, row) => sum + row.quantity, 0) +
        group.rows
          .filter((row) => row.entryType === 'ADJUSTMENT' && row.referenceEntryId)
          .reduce((sum, row) => sum + row.quantity, 0)

      low.push({
        customerId: group.customerId,
        packageProductId: group.packageProductId,
        totalCredits,
        remainingCredits,
      })
    }

    const packagesCount = [...factsByGroup.values()].reduce(
      (sum, group) => sum + group.rows.filter((row) => row.entryType === 'GRANT').length,
      0,
    )

    const [customers, packages] = await Promise.all([
      namesById(
        'customers',
        workspaceId,
        low.map((item) => item.customerId),
      ),
      namesById(
        'products',
        workspaceId,
        low.map((item) => item.packageProductId),
      ),
    ])

    const items: PackageCreditLowItem[] = low
      .map((item) => ({
        customerId: item.customerId,
        customerName: customers.get(item.customerId) ?? '',
        packageProductId: item.packageProductId,
        packageName: packages.get(item.packageProductId) ?? '',
        totalCredits: item.totalCredits,
        remainingCredits: item.remainingCredits,
      }))
      .sort((a, b) => a.remainingCredits - b.remainingCredits)

    return { items, lowCount: items.length, packagesCount, hidden: false, unavailable: false }
  }

  /** Repair slips that are still in the workshop. */
  async openRepairTickets(ctx: TenancyContext) {
    const workspaceId = ctx.workspaceId
    const tickets = await selectAllPages<
      {
        id: string
        number: number | string
        customer_id: string
        device_label: string
        problem: string
        status: string
        technician_employee_id: string | null
        created_at: string
      },
      DbError
    >((from, to) =>
      supabase
        .from('repair_tickets')
        .select(
          'id, number, customer_id, device_label, problem, status, technician_employee_id, created_at',
        )
        .eq('workspace_id', workspaceId)
        .not('status', 'in', '("delivered","cancelled")')
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (isNotDeployed(tickets.error)) {
      return {
        items: [] as OpenRepairTicketItem[],
        byStatus: {},
        totalOpen: 0,
        totalTickets: null,
        hidden: false,
        unavailable: true,
      }
    }
    if (tickets.error) throw new DatabaseError('Failed to read repair tickets', tickets.error)

    const rows = [...(tickets.data ?? [])].sort((a, b) =>
      a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
    )
    // Every ticket the shop ever wrote, so the empty card can say «none yet»
    // instead of claiming «none open» over a workshop with eight delivered ones.
    const ticketCount = await supabase
      .from('repair_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    if (ticketCount.error && !isNotDeployed(ticketCount.error)) {
      throw new DatabaseError('Failed to count repair tickets', ticketCount.error)
    }
    const [customers, technicians] = await Promise.all([
      namesById(
        'customers',
        workspaceId,
        rows.map((row) => row.customer_id),
      ),
      namesById(
        'employees',
        workspaceId,
        rows.map((row) => row.technician_employee_id).filter((id): id is string => Boolean(id)),
      ),
    ])

    const byStatus: Record<string, number> = {}
    for (const row of rows) byStatus[row.status] = (byStatus[row.status] ?? 0) + 1

    return {
      items: rows.map<OpenRepairTicketItem>((row) => ({
        id: row.id,
        number: String(row.number),
        customerId: row.customer_id,
        customerName: customers.get(row.customer_id) ?? '',
        deviceLabel: row.device_label,
        problem: row.problem,
        status: row.status,
        technicianId: row.technician_employee_id,
        technicianName: row.technician_employee_id
          ? (technicians.get(row.technician_employee_id) ?? '')
          : null,
        createdAt: row.created_at,
      })),
      byStatus,
      totalOpen: rows.length,
      totalTickets: ticketCount.error ? null : (ticketCount.count ?? null),
      hidden: false,
      unavailable: false,
    }
  }
}
