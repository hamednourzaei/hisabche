// ============================================
// backend/src/services/package-credits/package-credits.service.ts
//
// M3 — PACKAGE CREDIT & ENTITLEMENT LEDGER (Server Authority)
//
// Authoritative PostgreSQL service for package credits and service entitlements.
// Invariants:
// 1. Package Credit/Entitlement Truth is an append-only ledger of immutable facts.
// 2. Derived Balance: Remaining = Grants + Adjustments + Reversals - Consumes - Expirations.
// 3. Fail-closed: Cannot consume more credits than remaining balance.
// 4. Expiration zeroes remaining entitlement without creating cash refund or modifying past revenue.
// 5. Payment Truth and Accounting Truth remain separate and undisturbed.
// ============================================

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  derivePackageBalance,
  filterEntriesForAccount,
  planPackageAdjustment,
  planPackageExpiration,
  planPackageReversal,
  type PackageCreditEntry,
  type PackageCreditEntryType,
} from '@hisabche/validation'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'

export interface GrantPackageCreditInput {
  customerId: string
  packageProductId: string
  quantity: number
  unit?: string | null | undefined
  sourceDocumentType?: string | undefined
  sourceDocumentId?: string | undefined
  sourceLineId?: string | undefined
  idempotencyKey?: string | null | undefined
  notes?: string | null | undefined
  expiresAt?: string | null | undefined
  effectiveDate?: string | undefined
  clientRequestId?: string | null | undefined
}

export interface ConsumePackageCreditInput {
  customerId: string
  packageProductId: string
  quantity: number
  unit?: string | null | undefined
  idempotencyKey?: string | null | undefined
  notes?: string | null | undefined
  effectiveDate?: string | undefined
  clientRequestId?: string | null | undefined
}

export interface ReversePackageCreditInput {
  referenceEntryId: string
  quantity?: number | undefined
  idempotencyKey?: string | null | undefined
  notes?: string | null | undefined
  effectiveDate?: string | undefined
  clientRequestId?: string | null | undefined
}

export interface ExpirePackageCreditInput {
  customerId: string
  packageProductId: string
  idempotencyKey?: string | null | undefined
  notes?: string | null | undefined
  effectiveDate?: string | undefined
  clientRequestId?: string | null | undefined
}

export interface AdjustPackageCreditInput {
  customerId: string
  packageProductId: string
  quantityDelta: number
  unit?: string | null | undefined
  idempotencyKey?: string | null | undefined
  notes?: string | null | undefined
  effectiveDate?: string | undefined
  clientRequestId?: string | null | undefined
}

const isMissingTable = (error: { code?: string } | null | undefined) =>
  error?.code === '42P01' || error?.code === 'PGRST205'

function mapDbRowToEntry(row: Record<string, unknown>): PackageCreditEntry {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    customerId: String(row.customer_id),
    packageProductId: String(row.package_product_id),
    entryType: row.entry_type as PackageCreditEntryType,
    quantity: Number(row.quantity),
    unit: (row.unit as string | null) ?? undefined,
    sourceDocumentType: (row.source_document_type as string | null) ?? undefined,
    sourceDocumentId: (row.source_document_id as string | null) ?? undefined,
    sourceLineId: (row.source_line_id as string | null) ?? undefined,
    referenceEntryId: (row.reference_entry_id as string | null) ?? undefined,
    idempotencyKey: (row.idempotency_key as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    expiresAt: (row.expires_at as string | null) ?? undefined,
    effectiveDate: String(row.effective_date ?? ''),
    createdAt: String(row.created_at ?? ''),
    updatedAt: (row.updated_at as string | null) ?? undefined,
  }
}

export class PackageCreditsService {
  constructor(private readonly db: SupabaseClient = supabase) {}

  /**
   * Find entry by idempotency key within workspace.
   */
  private async findByIdempotencyKey(
    workspaceId: string,
    key: string | null | undefined,
  ): Promise<PackageCreditEntry | null> {
    if (!key) return null
    const { data, error } = await this.db
      .from('package_credit_ledger')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('idempotency_key', key)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {
      if (isMissingTable(error)) return null
      throw new DatabaseError('Failed to query idempotency key in package_credit_ledger', error)
    }
    return data ? mapDbRowToEntry(data) : null
  }

  /**
   * Get balance for a customer and optional package product.
   */
  async getBalance(
    ctx: TenancyContext,
    customerId: string,
    packageProductId?: string,
  ): Promise<{
    customerId: string
    packageProductId?: string | undefined
    balance: number
    unit?: string | null | undefined
    entriesCount: number
  }> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!customerId) throw new ValidationError('CUSTOMER_ID_REQUIRED')

    let query = this.db
      .from('package_credit_ledger')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (packageProductId) {
      query = query.eq('package_product_id', packageProductId)
    }

    const { data, error } = await query
    if (error) {
      if (isMissingTable(error)) {
        return {
          customerId,
          packageProductId,
          balance: 0,
          entriesCount: 0,
        }
      }
      throw new DatabaseError('Failed to fetch package credit ledger entries', error)
    }

    const entries = (data ?? []).map(mapDbRowToEntry)
    const targetEntries = packageProductId
      ? filterEntriesForAccount(entries, customerId, packageProductId)
      : entries

    const balance = derivePackageBalance(targetEntries)
    const unit = targetEntries.find((e) => e.unit)?.unit

    return {
      customerId,
      packageProductId,
      balance,
      unit,
      entriesCount: targetEntries.length,
    }
  }

  /**
   * Get append-only ledger entries for an account.
   */
  async getLedger(
    ctx: TenancyContext,
    customerId: string,
    packageProductId?: string,
  ): Promise<PackageCreditEntry[]> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!customerId) throw new ValidationError('CUSTOMER_ID_REQUIRED')

    let query = this.db
      .from('package_credit_ledger')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (packageProductId) {
      query = query.eq('package_product_id', packageProductId)
    }

    const { data, error } = await query
    if (error) {
      if (isMissingTable(error)) return []
      throw new DatabaseError('Failed to fetch package credit ledger', error)
    }

    return (data ?? []).map(mapDbRowToEntry)
  }

  /**
   * Grant credits to a customer's package account.
   */
  async grant(
    ctx: TenancyContext,
    input: GrantPackageCreditInput,
  ): Promise<PackageCreditEntry & { idempotentReplay?: boolean }> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!input.customerId) throw new ValidationError('CUSTOMER_ID_REQUIRED')
    if (!input.packageProductId) throw new ValidationError('PACKAGE_PRODUCT_ID_REQUIRED')
    if (!(input.quantity > 0)) throw new ValidationError('PACKAGE_CREDIT_QUANTITY_MUST_BE_POSITIVE')

    const key = input.idempotencyKey || input.clientRequestId
    if (key) {
      const existing = await this.findByIdempotencyKey(ctx.workspaceId, key)
      if (existing) return { ...existing, idempotentReplay: true }
    }

    const newId = randomUUID()
    const now = new Date().toISOString()
    const effectiveDate = input.effectiveDate || now.split('T')[0]!

    const row = {
      id: newId,
      workspace_id: ctx.workspaceId,
      customer_id: input.customerId,
      package_product_id: input.packageProductId,
      entry_type: 'GRANT',
      quantity: input.quantity,
      unit: input.unit ?? null,
      source_document_type: input.sourceDocumentType ?? 'manual',
      source_document_id: input.sourceDocumentId ?? null,
      source_line_id: input.sourceLineId ?? null,
      reference_entry_id: null,
      idempotency_key: key ?? null,
      notes: input.notes ?? null,
      expires_at: input.expiresAt ?? null,
      effective_date: effectiveDate,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    const { data, error } = await this.db
      .from('package_credit_ledger')
      .insert(row)
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505' && key) {
        const replay = await this.findByIdempotencyKey(ctx.workspaceId, key)
        if (replay) return { ...replay, idempotentReplay: true }
      }
      throw new DatabaseError('Failed to grant package credits', error)
    }

    return mapDbRowToEntry(data)
  }

  /**
   * Authoritative Consumption with fail-closed concurrency check.
   */
  async consume(
    ctx: TenancyContext,
    input: ConsumePackageCreditInput,
  ): Promise<
    PackageCreditEntry & {
      remainingBalance?: number | undefined
      idempotentReplay?: boolean | undefined
    }
  > {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!input.customerId) throw new ValidationError('CUSTOMER_ID_REQUIRED')
    if (!input.packageProductId) throw new ValidationError('PACKAGE_PRODUCT_ID_REQUIRED')
    if (!(input.quantity > 0)) throw new ValidationError('CONSUMPTION_QUANTITY_MUST_BE_POSITIVE')

    const key = input.idempotencyKey || input.clientRequestId
    if (key) {
      const existing = await this.findByIdempotencyKey(ctx.workspaceId, key)
      if (existing) return { ...existing, idempotentReplay: true }
    }

    const effectiveDate = input.effectiveDate || new Date().toISOString().split('T')[0]!

    // Try PostgreSQL atomic RPC function first
    const { data: rpcResult, error: rpcError } = await this.db.rpc('package_credit_consume', {
      p_workspace_id: ctx.workspaceId,
      p_customer_id: input.customerId,
      p_package_product_id: input.packageProductId,
      p_quantity: input.quantity,
      p_unit: input.unit ?? null,
      p_idempotency_key: key ?? null,
      p_notes: input.notes ?? null,
      p_effective_date: effectiveDate,
      p_user_id: ctx.userId ?? null,
    })

    if (!rpcError && rpcResult) {
      const res = rpcResult as Record<string, unknown>
      return {
        id: String(res.id),
        workspaceId: String(res.workspace_id),
        customerId: String(res.customer_id),
        packageProductId: String(res.package_product_id),
        entryType: 'CONSUME',
        quantity: Number(res.quantity),
        unit: (res.unit as string | null) ?? undefined,
        idempotencyKey: (res.idempotency_key as string | null) ?? undefined,
        notes: (res.notes as string | null) ?? undefined,
        effectiveDate: String(res.effective_date ?? ''),
        createdAt: String(res.created_at ?? ''),
        remainingBalance:
          res.remaining_balance !== undefined ? Number(res.remaining_balance) : undefined,
        idempotentReplay: Boolean(res.is_replayed),
      }
    }

    if (rpcError) {
      const msg = rpcError.message || ''
      if (rpcError.code === 'P0001' || msg.includes('INSUFFICIENT_PACKAGE_CREDIT')) {
        throw new ConflictError(
          `INSUFFICIENT_PACKAGE_CREDIT: ${msg || 'Requested quantity exceeds available credit balance'}`,
        )
      }
      // If RPC is missing (test environment or mock db), fallback to direct ledger validation
      if (
        rpcError.code !== 'PGRST202' &&
        rpcError.code !== '42883' &&
        !/could not find the function|function .* does not exist/i.test(msg)
      ) {
        throw new DatabaseError('Failed to execute package_credit_consume RPC', rpcError)
      }
    }

    // Direct fallback path: calculate balance using universal domain logic
    const { data: entriesData, error: entriesError } = await this.db
      .from('package_credit_ledger')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('customer_id', input.customerId)
      .eq('package_product_id', input.packageProductId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (entriesError) {
      throw new DatabaseError('Failed to read balance for package consumption', entriesError)
    }

    const currentEntries = (entriesData ?? []).map(mapDbRowToEntry)
    const currentBalance = derivePackageBalance(currentEntries)

    if (currentBalance < input.quantity) {
      throw new ConflictError(
        `INSUFFICIENT_PACKAGE_CREDIT: Cannot consume ${input.quantity} credits; current available balance is ${currentBalance}`,
      )
    }

    const newId = randomUUID()
    const now = new Date().toISOString()
    const row = {
      id: newId,
      workspace_id: ctx.workspaceId,
      customer_id: input.customerId,
      package_product_id: input.packageProductId,
      entry_type: 'CONSUME',
      quantity: input.quantity,
      unit: input.unit ?? null,
      source_document_type: 'manual',
      source_document_id: null,
      source_line_id: null,
      reference_entry_id: null,
      idempotency_key: key ?? null,
      notes: input.notes ?? null,
      expires_at: null,
      effective_date: effectiveDate,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    const { data: inserted, error: insertError } = await this.db
      .from('package_credit_ledger')
      .insert(row)
      .select('*')
      .single()

    if (insertError) {
      if (insertError.code === '23505' && key) {
        const replay = await this.findByIdempotencyKey(ctx.workspaceId, key)
        if (replay) return { ...replay, idempotentReplay: true }
      }
      throw new DatabaseError('Failed to record package consumption', insertError)
    }

    return {
      ...mapDbRowToEntry(inserted),
      remainingBalance: currentBalance - input.quantity,
    }
  }

  /**
   * Reverse an existing ledger entry.
   */
  async reverse(
    ctx: TenancyContext,
    input: ReversePackageCreditInput,
  ): Promise<PackageCreditEntry & { idempotentReplay?: boolean }> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!input.referenceEntryId) throw new ValidationError('REFERENCE_ENTRY_ID_REQUIRED')

    const key = input.idempotencyKey || input.clientRequestId
    if (key) {
      const existing = await this.findByIdempotencyKey(ctx.workspaceId, key)
      if (existing) return { ...existing, idempotentReplay: true }
    }

    const { data: refData, error: refError } = await this.db
      .from('package_credit_ledger')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', input.referenceEntryId)
      .is('deleted_at', null)
      .maybeSingle()

    if (refError) throw new DatabaseError('Failed to fetch reference entry', refError)
    if (!refData) throw new NotFoundError('PackageCreditEntry')

    const originalEntry = mapDbRowToEntry(refData)
    const entries = await this.getLedger(
      ctx,
      originalEntry.customerId,
      originalEntry.packageProductId,
    )
    const { entry: planned } = planPackageReversal({
      entries,
      referenceEntryId: input.referenceEntryId,
      quantity: input.quantity,
      notes: input.notes,
      effectiveDate: input.effectiveDate,
      idempotencyKey: key,
    })

    const newId = randomUUID()
    const now = new Date().toISOString()
    const row = {
      id: newId,
      workspace_id: ctx.workspaceId,
      customer_id: planned.customerId,
      package_product_id: planned.packageProductId,
      entry_type: 'REVERSAL',
      quantity: planned.quantity,
      unit: planned.unit ?? null,
      source_document_type: planned.sourceDocumentType ?? 'reversal',
      source_document_id: null,
      source_line_id: null,
      reference_entry_id: planned.referenceEntryId ?? null,
      idempotency_key: key ?? null,
      notes: planned.notes ?? null,
      expires_at: null,
      effective_date: planned.effectiveDate,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    const { data: inserted, error: insertError } = await this.db
      .from('package_credit_ledger')
      .insert(row)
      .select('*')
      .single()

    if (insertError) {
      if (insertError.code === '23505' && key) {
        const replay = await this.findByIdempotencyKey(ctx.workspaceId, key)
        if (replay) return { ...replay, idempotentReplay: true }
      }
      throw new DatabaseError('Failed to reverse package credit entry', insertError)
    }

    return mapDbRowToEntry(inserted)
  }

  /**
   * Expire remaining credits on an account.
   * Invariant: Zero cash movements, zero payments, zero accounting journal modifications!
   */
  async expire(
    ctx: TenancyContext,
    input: ExpirePackageCreditInput,
  ): Promise<PackageCreditEntry | { expired: false; balance: 0 }> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!input.customerId) throw new ValidationError('CUSTOMER_ID_REQUIRED')
    if (!input.packageProductId) throw new ValidationError('PACKAGE_PRODUCT_ID_REQUIRED')

    const key = input.idempotencyKey || input.clientRequestId
    if (key) {
      const existing = await this.findByIdempotencyKey(ctx.workspaceId, key)
      if (existing) return existing
    }

    const entries = await this.getLedger(ctx, input.customerId, input.packageProductId)
    const { entry: planned } = planPackageExpiration({
      entries,
      workspaceId: ctx.workspaceId,
      customerId: input.customerId,
      packageProductId: input.packageProductId,
      effectiveDate: input.effectiveDate,
      notes: input.notes,
      idempotencyKey: key,
    })

    if (!planned) {
      return { expired: false, balance: 0 }
    }

    const newId = randomUUID()
    const now = new Date().toISOString()
    const row = {
      id: newId,
      workspace_id: ctx.workspaceId,
      customer_id: planned.customerId,
      package_product_id: planned.packageProductId,
      entry_type: 'EXPIRE',
      quantity: planned.quantity,
      unit: planned.unit ?? null,
      source_document_type: 'expiration',
      source_document_id: null,
      source_line_id: null,
      reference_entry_id: null,
      idempotency_key: key ?? null,
      notes: planned.notes ?? null,
      expires_at: null,
      effective_date: planned.effectiveDate,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    const { data: inserted, error: insertError } = await this.db
      .from('package_credit_ledger')
      .insert(row)
      .select('*')
      .single()

    if (insertError) {
      if (insertError.code === '23505' && key) {
        const replay = await this.findByIdempotencyKey(ctx.workspaceId, key)
        if (replay) return replay
      }
      throw new DatabaseError('Failed to record package expiration', insertError)
    }

    return mapDbRowToEntry(inserted)
  }

  /**
   * Adjust credits on an account.
   */
  async adjust(
    ctx: TenancyContext,
    input: AdjustPackageCreditInput,
  ): Promise<PackageCreditEntry & { idempotentReplay?: boolean }> {
    if (!ctx.workspaceId) throw new ValidationError('WORKSPACE_REQUIRED')
    if (!input.customerId) throw new ValidationError('CUSTOMER_ID_REQUIRED')
    if (!input.packageProductId) throw new ValidationError('PACKAGE_PRODUCT_ID_REQUIRED')
    if (!input.quantityDelta || input.quantityDelta === 0) {
      throw new ValidationError('ADJUSTMENT_DELTA_MUST_BE_NON_ZERO')
    }

    const key = input.idempotencyKey || input.clientRequestId
    if (key) {
      const existing = await this.findByIdempotencyKey(ctx.workspaceId, key)
      if (existing) return { ...existing, idempotentReplay: true }
    }

    const entries = await this.getLedger(ctx, input.customerId, input.packageProductId)
    const { entry: planned } = planPackageAdjustment({
      entries,
      workspaceId: ctx.workspaceId,
      customerId: input.customerId,
      packageProductId: input.packageProductId,
      quantityDelta: input.quantityDelta,
      unit: input.unit,
      notes: input.notes,
      effectiveDate: input.effectiveDate,
      idempotencyKey: key,
    })

    const newId = randomUUID()
    const now = new Date().toISOString()
    const row = {
      id: newId,
      workspace_id: ctx.workspaceId,
      customer_id: planned.customerId,
      package_product_id: planned.packageProductId,
      entry_type: 'ADJUSTMENT',
      quantity: planned.quantity,
      unit: planned.unit ?? null,
      source_document_type: 'manual',
      source_document_id: null,
      source_line_id: null,
      reference_entry_id: null,
      idempotency_key: key ?? null,
      notes: planned.notes ?? null,
      expires_at: null,
      effective_date: planned.effectiveDate,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    const { data: inserted, error: insertError } = await this.db
      .from('package_credit_ledger')
      .insert(row)
      .select('*')
      .single()

    if (insertError) {
      if (insertError.code === '23505' && key) {
        const replay = await this.findByIdempotencyKey(ctx.workspaceId, key)
        if (replay) return { ...replay, idempotentReplay: true }
      }
      throw new DatabaseError('Failed to record package adjustment', insertError)
    }

    return mapDbRowToEntry(inserted)
  }
}
