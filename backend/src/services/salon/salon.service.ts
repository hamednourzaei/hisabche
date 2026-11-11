// ============================================
// backend/src/services/salon/salon.service.ts
//
// Barber shop / beauty salon (salon-01, provider-commission-01; QA document
// §8, 10 Nov 2026). The parts a salon adds to the ONE service core:
//
//   • resources   chairs, rooms, beds (the double-booking rule is a trigger)
//   • catalog     a service's duration, department, resource kind, warehouse
//                 and recipe — delivery reads the recipe
//                 (ServiceDeliveryService#recipeOf → consumeMaterials)
//   • commission  rate per provider × what each delivered session was
//                 charged. Charged = the invoice line of that service on the
//                 session's invoice; a complimentary session is 0; a session
//                 settled from a package has no single price → unknown,
//                 never zero (CLAUDE.md «نامعلوم، صفر نیست»).
//
// Departments are HR `departments`; providers are `employees`; services are
// `products` with offering_type = service. Nothing here is a second list.
// ============================================

import {
  catalogRefusal,
  commissionReport,
  freeSlots,
  utilization,
  type CommissionRateInput,
  type CommissionSession,
  type ResourceBookingCreateInput,
  type ServiceCatalogInput,
  type ServiceResourceInput,
  type ServiceResourcePatch,
  type TimeRange,
} from '@hisabche/validation'
import { FRACTION_DIGITS } from '@hisabche/formatting'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { baseCurrencyOf } from '../base-currency'
import type { TenancyContext } from '../tenancy.service'

const isNotReady = (error: { code?: string } | null) =>
  error?.code === '42P01' || error?.code === 'PGRST205'

const RESOURCE_COLUMNS = 'id, name, kind, branch_id, department_id, is_active, created_at'

function mapResource(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as string,
    branchId: (row.branch_id as string | null) ?? null,
    departmentId: (row.department_id as string | null) ?? null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at as string,
  }
}

function toMinor(major: number, currency: string): number {
  const digits = (FRACTION_DIGITS as Record<string, number>)[currency] ?? 2
  return Math.round(major * 10 ** digits)
}

export class SalonService {
  /** One id in this workspace, or the refusal named for that field. */
  private async assertIn(
    table: 'branches' | 'departments' | 'warehouses' | 'employees',
    ws: string,
    id: string | null | undefined,
    code: string,
  ) {
    if (!id) return
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('workspace_id', ws)
      .eq('id', id)
      .maybeSingle()
    if (error) throw new DatabaseError(`Failed to read ${table}`, error)
    if (!data) throw new ValidationError(code)
  }

  // ─── Resources ────────────────────────────────────────────────────────────
  async resources(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('service_resources')
      .select(RESOURCE_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .order('name')
    if (isNotReady(error)) return { ready: false, resources: [] }
    if (error) throw new DatabaseError('Failed to read the resources', error)
    return { ready: true, resources: (data ?? []).map(mapResource) }
  }

  async createResource(ctx: TenancyContext, input: ServiceResourceInput) {
    await this.assertIn('branches', ctx.workspaceId, input.branchId, 'RESOURCE_BRANCH_NOT_FOUND')
    await this.assertIn(
      'departments',
      ctx.workspaceId,
      input.departmentId,
      'RESOURCE_DEPARTMENT_NOT_FOUND',
    )
    const { data, error } = await supabase
      .from('service_resources')
      .insert({
        workspace_id: ctx.workspaceId,
        name: input.name,
        kind: input.kind,
        branch_id: input.branchId ?? null,
        department_id: input.departmentId ?? null,
      })
      .select(RESOURCE_COLUMNS)
      .single()
    if (isNotReady(error)) throw new ValidationError('SALON_NOT_READY')
    if (error || !data) throw new DatabaseError('Failed to add the resource', error)
    return mapResource(data)
  }

  /** Rename, move or retire a resource. Never deleted: past sessions still name it. */
  async updateResource(ctx: TenancyContext, id: string, input: ServiceResourcePatch) {
    await this.assertIn('branches', ctx.workspaceId, input.branchId, 'RESOURCE_BRANCH_NOT_FOUND')
    await this.assertIn(
      'departments',
      ctx.workspaceId,
      input.departmentId,
      'RESOURCE_DEPARTMENT_NOT_FOUND',
    )
    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.kind !== undefined) patch.kind = input.kind
    if (input.branchId !== undefined) patch.branch_id = input.branchId
    if (input.departmentId !== undefined) patch.department_id = input.departmentId
    if (input.isActive !== undefined) patch.is_active = input.isActive
    const { data, error } = await supabase
      .from('service_resources')
      .update(patch)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', id)
      .select(RESOURCE_COLUMNS)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to update the resource', error)
    if (!data) throw new NotFoundError('Resource')
    return mapResource(data)
  }

  // ─── Catalog ──────────────────────────────────────────────────────────────
  async catalog(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('service_catalog')
      .select(
        'product_id, duration_minutes, department_id, resource_kind, warehouse_id, consumables, updated_at',
      )
      .eq('workspace_id', ctx.workspaceId)
    if (isNotReady(error)) return { ready: false, services: [] }
    if (error) throw new DatabaseError('Failed to read the service catalog', error)
    return {
      ready: true,
      services: (data ?? []).map((row) => ({
        productId: row.product_id as string,
        durationMinutes: Number(row.duration_minutes),
        departmentId: (row.department_id as string | null) ?? null,
        resourceKind: (row.resource_kind as string | null) ?? null,
        warehouseId: (row.warehouse_id as string | null) ?? null,
        consumables: Array.isArray(row.consumables)
          ? (row.consumables as Array<{ productId: string; quantity: number }>)
          : [],
        updatedAt: row.updated_at as string,
      })),
    }
  }

  async saveCatalog(ctx: TenancyContext, productId: string, input: ServiceCatalogInput) {
    const refusal = catalogRefusal(input)
    if (refusal) throw new ValidationError(refusal)
    const ws = ctx.workspaceId

    const ids = [productId, ...input.consumables.map((c) => c.productId)]
    const { data: products, error } = await supabase
      .from('products')
      .select('id, offering_type')
      .eq('workspace_id', ws)
      .in('id', ids)
    if (error) throw new DatabaseError('Failed to read the products', error)
    const byId = new Map(
      (products ?? []).map((p) => [p.id as string, p.offering_type as string | null]),
    )
    if (!byId.has(productId)) throw new NotFoundError('Service')
    if (byId.get(productId) !== 'service')
      throw new ValidationError('SERVICE_CATALOG_NOT_A_SERVICE')
    for (const item of input.consumables) {
      if (!byId.has(item.productId)) throw new ValidationError('SERVICE_CONSUMABLE_NOT_FOUND')
      // Materials are goods on a shelf; a service cannot be «used up».
      if (byId.get(item.productId) === 'service')
        throw new ValidationError('SERVICE_CONSUMABLE_IS_A_SERVICE')
    }
    await this.assertIn('departments', ws, input.departmentId, 'SERVICE_DEPARTMENT_NOT_FOUND')
    await this.assertIn('warehouses', ws, input.warehouseId, 'SERVICE_WAREHOUSE_NOT_FOUND')
    if (input.consumables.length > 0 && !input.warehouseId) {
      // Every stock change names its warehouse when the business has any (BUG-080).
      const { count, error: countError } = await supabase
        .from('warehouses')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', ws)
        .is('deleted_at', null)
      if (countError) throw new DatabaseError('Failed to read the warehouses', countError)
      if ((count ?? 0) > 0) throw new ValidationError('SERVICE_CONSUMABLE_WAREHOUSE_REQUIRED')
    }

    const { error: saveError } = await supabase.from('service_catalog').upsert(
      {
        workspace_id: ws,
        product_id: productId,
        duration_minutes: input.durationMinutes,
        department_id: input.departmentId ?? null,
        resource_kind: input.resourceKind ?? null,
        warehouse_id: input.warehouseId ?? null,
        consumables: input.consumables,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      },
      { onConflict: 'workspace_id,product_id' },
    )
    if (isNotReady(saveError)) throw new ValidationError('SALON_NOT_READY')
    if (saveError) throw new DatabaseError('Failed to save the service', saveError)
    return this.catalog(ctx)
  }

  // ─── Commission ───────────────────────────────────────────────────────────
  async commissionRates(ctx: TenancyContext) {
    const { data, error } = await supabase
      .from('provider_commission_rates')
      .select('employee_id, rate_bp, updated_at')
      .eq('workspace_id', ctx.workspaceId)
    if (isNotReady(error)) return { ready: false, rates: [] }
    if (error) throw new DatabaseError('Failed to read the commission rates', error)
    return {
      ready: true,
      rates: (data ?? []).map((row) => ({
        employeeId: row.employee_id as string,
        rateBp: Number(row.rate_bp),
        updatedAt: row.updated_at as string,
      })),
    }
  }

  async setCommissionRate(ctx: TenancyContext, input: CommissionRateInput) {
    await this.assertIn(
      'employees',
      ctx.workspaceId,
      input.employeeId,
      'COMMISSION_EMPLOYEE_NOT_FOUND',
    )
    const { error } = await supabase.from('provider_commission_rates').upsert(
      {
        workspace_id: ctx.workspaceId,
        employee_id: input.employeeId,
        rate_bp: input.rateBp,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      },
      { onConflict: 'workspace_id,employee_id' },
    )
    if (isNotReady(error)) throw new ValidationError('COMMISSION_NOT_READY')
    if (error) throw new DatabaseError('Failed to save the commission rate', error)
    return this.commissionRates(ctx)
  }

  /** Delivered sessions between two days (inclusive), per provider and currency. */
  async commission(
    ctx: TenancyContext,
    from: string,
    to: string,
    onlyPractitionerId?: string | undefined,
  ) {
    const ws = ctx.workspaceId
    const { data: sessions, error } = await selectAllPages<
      {
        id: string
        practitioner_id: string | null
        service_offering_id: string
        settlement_method: string
        invoice_id: string | null
      },
      { message: string; code?: string }
    >((lo, hi) => {
      let q = supabase
        .from('service_delivery_sessions')
        .select('id, practitioner_id, service_offering_id, settlement_method, invoice_id')
        .eq('workspace_id', ws)
        .eq('status', 'delivered')
        .is('deleted_at', null)
        .gte('session_date', from)
        .lte('session_date', to)
      if (onlyPractitionerId) {
        q = q.eq('practitioner_id', onlyPractitionerId)
      }
      return q.order('id', { ascending: true }).range(lo, hi) as unknown as Promise<{
        data: Array<{
          id: string
          practitioner_id: string | null
          service_offering_id: string
          settlement_method: string
          invoice_id: string | null
        }> | null
        error: { message: string; code?: string } | null
      }>
    })
    if (error) throw new DatabaseError('Failed to read the delivered sessions', error)

    const invoiceIds = [
      ...new Set((sessions ?? []).map((s) => s.invoice_id).filter((v): v is string => Boolean(v))),
    ]
    const lines = new Map<string, number>()
    const currencies = new Map<string, string>()
    if (invoiceIds.length > 0) {
      for (let i = 0; i < invoiceIds.length; i += 200) {
        const chunk = invoiceIds.slice(i, i + 200)
        const [invoices, items] = await Promise.all([
          supabase.from('invoices').select('id, currency').eq('workspace_id', ws).in('id', chunk),
          supabase
            .from('invoice_items')
            .select('invoice_id, product_id, unit_price')
            .in('invoice_id', chunk),
        ])
        if (invoices.error) throw new DatabaseError('Failed to read the invoices', invoices.error)
        if (items.error) throw new DatabaseError('Failed to read the invoice lines', items.error)
        for (const inv of invoices.data ?? [])
          currencies.set(inv.id as string, (inv.currency as string) ?? '')
        for (const item of items.data ?? []) {
          // Only invoices of THIS workspace (read above) are priced.
          if (!currencies.has(item.invoice_id as string)) continue
          lines.set(`${item.invoice_id}|${item.product_id}`, Number(item.unit_price))
        }
      }
    }

    const book = await baseCurrencyOf(ws)
    const priced: CommissionSession[] = (sessions ?? []).map((s) => {
      if (s.settlement_method === 'complementary') {
        return { practitionerId: s.practitioner_id, currency: book, chargedMinor: 0 }
      }
      if (s.invoice_id) {
        const currency = currencies.get(s.invoice_id) || book
        const price = lines.get(`${s.invoice_id}|${s.service_offering_id}`)
        return {
          practitionerId: s.practitioner_id,
          currency,
          chargedMinor:
            price === undefined || !Number.isFinite(price) ? null : toMinor(price, currency),
        }
      }
      // From a package: one price per session is not recorded → unknown.
      return { practitionerId: s.practitioner_id, currency: null, chargedMinor: null }
    })

    const rates = await this.commissionRates(ctx)
    const rateMap = new Map(rates.rates.map((r) => [r.employeeId, r.rateBp]))
    const filteredRates: ReadonlyMap<string, number> = onlyPractitionerId
      ? rateMap.has(onlyPractitionerId)
        ? new Map([[onlyPractitionerId, rateMap.get(onlyPractitionerId)!]])
        : new Map()
      : rateMap
    return { ready: rates.ready, from, to, lines: commissionReport(priced, filteredRates) }
  }

  /** Stylist self-view: only commission lines belonging to the acting user's employee record. */
  async myCommission(ctx: TenancyContext, from: string, to: string) {
    const { data, error } = await selectAllPages<
      { id: string; user_id: string | null },
      { message: string; code?: string }
    >(
      (rangeFrom, rangeTo) =>
        supabase
          .from('employees')
          .select('id, user_id')
          .eq('workspace_id', ctx.workspaceId)
          .order('id', { ascending: true })
          .range(rangeFrom, rangeTo) as unknown as Promise<{
          data: Array<{ id: string; user_id: string | null }> | null
          error: { message: string; code?: string } | null
        }>,
    )
    if (error) throw new DatabaseError('Failed to resolve employee profile', error)
    const me = (data ?? []).find((row) => row.user_id === ctx.userId)
    if (!me?.id) {
      return { ready: true, from, to, lines: [] }
    }
    return this.commission(ctx, from, to, String(me.id))
  }

  // ─── Resource Bookings & Capacity (V60 Slice 7) ───────────────────────────
  private parseTstzRange(raw: unknown): TimeRange | null {
    if (typeof raw !== 'string') return null
    const cleaned = raw.replace(/^[[(]/, '').replace(/[\])]$/, '')
    const parts = cleaned.split(',')
    if (parts.length !== 2) return null
    const startMs = Date.parse(parts[0]!.replace(/^"|"$/g, ''))
    const endMs = Date.parse(parts[1]!.replace(/^"|"$/g, ''))
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null
    return { startAt: new Date(startMs).toISOString(), endAt: new Date(endMs).toISOString() }
  }

  async listResourceBookings(ctx: TenancyContext, resourceId?: string) {
    let query = supabase
      .from('resource_bookings')
      .select(
        'id, resource_id, during, source_type, source_id, status, notes, created_at, released_at',
      )
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
    if (resourceId) query = query.eq('resource_id', resourceId)
    const { data, error } = await query
    if (isNotReady(error)) return { ready: false, bookings: [] }
    if (error) throw new DatabaseError('Failed to read resource bookings', error)
    return {
      ready: true,
      bookings: (data ?? []).map((row: Record<string, unknown>) => {
        const range = this.parseTstzRange(row.during)
        return {
          id: row.id as string,
          resourceId: row.resource_id as string,
          startAt: range?.startAt ?? null,
          endAt: range?.endAt ?? null,
          sourceType: row.source_type as string,
          sourceId: (row.source_id as string | null) ?? null,
          status: row.status as string,
          notes: (row.notes as string | null) ?? null,
          createdAt: row.created_at as string,
          releasedAt: (row.released_at as string | null) ?? null,
        }
      }),
    }
  }

  async bookResource(ctx: TenancyContext, input: ResourceBookingCreateInput) {
    const during = `[${new Date(input.startAt).toISOString()},${new Date(input.endAt).toISOString()})`
    const { data, error } = await supabase
      .from('resource_bookings')
      .insert({
        workspace_id: ctx.workspaceId,
        resource_id: input.resourceId,
        during,
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        notes: input.notes ?? null,
        created_by: ctx.userId,
        status: 'active',
      })
      .select('id, resource_id, during, source_type, source_id, status, notes, created_at')
      .single()

    if (error) {
      if (
        error.code === '23P01' ||
        (error.message ?? '').includes('resource_bookings_no_overlap')
      ) {
        throw new ConflictError('RESOURCE_BOOKING_OVERLAP')
      }
      if ((error.message ?? '').includes('RESOURCE_INACTIVE')) {
        throw new ValidationError('RESOURCE_INACTIVE')
      }
      if ((error.message ?? '').includes('RESOURCE_NOT_FOUND')) {
        throw new NotFoundError('Resource')
      }
      if ((error.message ?? '').includes('TENANT_RESOURCE_MISMATCH')) {
        throw new NotFoundError('Resource')
      }
      throw new DatabaseError('Failed to book resource', error)
    }

    const row = data as Record<string, unknown>
    const range = this.parseTstzRange(row.during)
    return {
      id: row.id as string,
      resourceId: row.resource_id as string,
      startAt: range?.startAt ?? input.startAt,
      endAt: range?.endAt ?? input.endAt,
      sourceType: row.source_type as string,
      sourceId: (row.source_id as string | null) ?? null,
      status: row.status as string,
      notes: (row.notes as string | null) ?? null,
      createdAt: row.created_at as string,
    }
  }

  async releaseResourceBooking(ctx: TenancyContext, bookingId: string) {
    const { data, error } = await supabase
      .from('resource_bookings')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', bookingId)
      .eq('status', 'active')
      .select('id, status, released_at')
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to release booking', error)
    if (!data) throw new NotFoundError('Resource booking')
    return data
  }

  async getResourceSlots(
    ctx: TenancyContext,
    resourceId: string,
    window: TimeRange,
    slotMinutes = 60,
  ) {
    const { bookings } = await this.listResourceBookings(ctx, resourceId)
    const activeIntervals: TimeRange[] = bookings
      .filter((b) => b.status === 'active' && b.startAt && b.endAt)
      .map((b) => ({ startAt: b.startAt!, endAt: b.endAt! }))

    return {
      resourceId,
      window,
      slotMinutes,
      freeSlots: freeSlots(window, activeIntervals, slotMinutes),
      utilization: utilization(window, activeIntervals),
    }
  }
}
