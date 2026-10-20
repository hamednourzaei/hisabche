// ============================================
// backend/src/services/cloud-migration/cloud-migration.service.ts
//
// Safe Migration Engine: chunked, resumable, idempotent server-side migration.
// Reuses the claimRun/lease pattern. Calls canonical domain services only.
// ============================================

import { createHash } from 'node:crypto'
import type { MigrationPreview } from '@hisabche/local-engine'
import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import type { TenancyContext } from '../tenancy.service'
import { CustomerService } from '../customer.service'
import { ProductService } from '../product.service'
import { InvoiceService } from '../invoice.service'
import { PaymentsService } from '../payments/payments.service'
import { WarehouseService } from '../warehouse.service'
import { CostingService } from '../inventory-costing/costing.service'
import { ReconciliationService } from './reconciliation.service'
import type { CloudMigrationJob, MigrationChunkPayload, ReconciliationOutcome } from './types'

export const MIGRATION_LEASE_MS = 120_000 // 2 minutes takeover

export class CloudMigrationService {
  constructor(
    private readonly customerService: CustomerService = new CustomerService(),
    private readonly productService: ProductService = new ProductService(),
    private readonly invoiceService: InvoiceService = new InvoiceService(),
    private readonly paymentsService: PaymentsService = new PaymentsService(),
    private readonly warehouseService: WarehouseService = new WarehouseService(),
    private readonly costingService: CostingService = new CostingService(),
    private readonly reconciliationService: ReconciliationService = new ReconciliationService(),
  ) {}

  /** Derives deterministic idempotency key for entity replay. */
  makeKey(licenceId: string, entity: string, localId: string): string {
    const hash = createHash('sha256')
      .update(`${licenceId}:${entity}:${localId}`)
      .digest('hex')
      .slice(0, 32)
    return `cmig-${entity}-${hash}`
  }

  // ─── 1. Create Migration Job ───────────────────────────────────────────────
  async createJob(
    ctx: TenancyContext,
    input: {
      deviceId: string
      licenceId: string
      packageChecksum: string
      chunksTotal: number
      previewMetrics: MigrationPreview
    },
  ): Promise<CloudMigrationJob> {
    const { workspaceId, userId } = ctx

    // Ensure target workspace is not already loaded with business invoices
    const { count: existingInvoices, error: countErr } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    if (countErr) throw new DatabaseError('Failed to check workspace state', countErr)
    if ((existingInvoices ?? 0) > 0) {
      throw new ConflictError('MIGRATION_TARGET_WORKSPACE_NOT_EMPTY')
    }

    const { data: job, error } = await supabase
      .from('cloud_migration_jobs')
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        device_id: input.deviceId,
        licence_id: input.licenceId,
        status: 'UPLOADING',
        chunks_total: input.chunksTotal,
        chunks_completed: 0,
        package_checksum: input.packageChecksum,
        preview_metrics: input.previewMetrics,
      })
      .select('*')
      .single()

    if (error || !job) throw new DatabaseError('Failed to create migration job', error)
    return this.mapJob(job)
  }

  // ─── 2. Claim Lease on Job (claimRun pattern) ──────────────────────────────
  async claimJob(ctx: TenancyContext, jobId: string): Promise<void> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + MIGRATION_LEASE_MS).toISOString()

    // 1. Try claiming idle or freshly started job
    const claim = await supabase
      .from('cloud_migration_jobs')
      .update({
        error_code: 'MIGRATION_RUNNING',
        lease_expires_at: expiresAt,
        updated_at: now.toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', jobId)
      .in('status', ['UPLOADING', 'RECONCILING'])
      .is('error_code', null)
      .select('id')

    if (claim.error) throw new DatabaseError('Failed to claim migration job', claim.error)
    if ((claim.data ?? []).length > 0) return

    // 2. Try takeover on stale lease (crashed worker)
    const takeover = await supabase
      .from('cloud_migration_jobs')
      .update({
        error_code: 'MIGRATION_RUNNING',
        lease_expires_at: expiresAt,
        updated_at: now.toISOString(),
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', jobId)
      .in('status', ['UPLOADING', 'RECONCILING'])
      .eq('error_code', 'MIGRATION_RUNNING')
      .lt('lease_expires_at', now.toISOString())
      .select('id')

    if (takeover.error) throw new DatabaseError('Failed to resume migration job', takeover.error)
    if ((takeover.data ?? []).length > 0) return

    throw new ConflictError('MIGRATION_BUSY')
  }

  // ─── 3. Release Lease ──────────────────────────────────────────────────────
  async releaseJob(ctx: TenancyContext, jobId: string, status?: string): Promise<void> {
    const updatePayload: Record<string, unknown> = {
      error_code: null,
      lease_expires_at: null,
      updated_at: new Date().toISOString(),
    }
    if (status) updatePayload.status = status

    await supabase
      .from('cloud_migration_jobs')
      .update(updatePayload)
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', jobId)
  }

  // ─── 4. Process One Chunk (Resumable & Idempotent) ──────────────────────────
  async processChunk(
    ctx: TenancyContext,
    chunk: MigrationChunkPayload,
  ): Promise<{ chunkIndex: number; completed: boolean }> {
    const { jobId, sectionName, rows } = chunk
    await this.claimJob(ctx, jobId)

    try {
      const job = await this.getJob(ctx, jobId)
      const licenceId = job.licenceId

      for (const row of rows) {
        await this.replayRecord(ctx, job, licenceId, sectionName, row.localId, row.data)
      }

      // Increment completed chunks
      const nextCompleted = chunk.chunkIndex + 1
      await supabase
        .from('cloud_migration_jobs')
        .update({
          chunks_completed: nextCompleted,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', jobId)

      await this.releaseJob(ctx, jobId)
      return { chunkIndex: chunk.chunkIndex, completed: true }
    } catch (err) {
      await this.releaseJob(ctx, jobId)
      throw err
    }
  }

  // ─── 5. Replay Individual Record through Domain Service ────────────────────
  private async replayRecord(
    ctx: TenancyContext,
    job: CloudMigrationJob,
    licenceId: string,
    section: string,
    localId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const key = this.makeKey(licenceId, section, localId)

    // Check if mapping already recorded
    const { data: existingMap } = await supabase
      .from('cloud_migration_map')
      .select('cloud_id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('entity_type', section)
      .eq('local_id', localId)
      .maybeSingle()

    if (existingMap?.cloud_id) return // Already processed

    let createdCloudId: string | null = null

    switch (section) {
      case 'inventory_settings': {
        await this.costingService.setSettings(ctx, {
          costingMethod: data.costing_method as 'fifo' | 'avco',
          negativeStock: data.negative_stock === 'allow' ? 'allow' : 'block',
        })
        break
      }

      case 'warehouse': {
        const created = await this.warehouseService.createWarehouse(ctx, {
          name: String(data.name || 'انبار'),
          location: String(data.location || ''),
          isActive: true,
        })
        createdCloudId = (created as { id: string }).id
        break
      }

      case 'product': {
        const productRes = await this.productService.create(
          ctx,
          {
            name: String(data.name),
            barcode: data.barcode ? String(data.barcode) : undefined,
            sku: data.sku ? String(data.sku) : undefined,
            category: data.category ? String(data.category) : 'general',
            unit: (data.unit as 'piece') || 'piece',
            minStockLevel: Number(data.min_stock_level) || 0,
            buyPrice: Number(data.buy_price) || 0,
            sellPrice: Number(data.sell_price) || 0,
            wholesalePrice: data.wholesale_price ? Number(data.wholesale_price) : undefined,
            quantity: 0,
            isActive: true,
          },
          { clientRequestId: key },
        )
        createdCloudId = (productRes as { id: string }).id
        break
      }

      case 'product_stock': {
        // Record opening stock for product in warehouse
        const cloudProductId = await this.resolveCloudId(
          ctx.workspaceId,
          'product',
          String(data.product_id),
        )
        const cloudWarehouseId = await this.resolveCloudId(
          ctx.workspaceId,
          'warehouse',
          String(data.warehouse_id),
        )
        const qty = Number(data.qty) || 0

        if (cloudProductId && cloudWarehouseId && qty > 0) {
          await this.productService.recordOpeningStock(ctx, cloudProductId, [
            { warehouseId: cloudWarehouseId, quantity: qty },
          ])
        }
        break
      }

      case 'customer': {
        const customerRes = await this.customerService.create(
          ctx,
          {
            fullName: String(data.full_name),
            phone: data.phone ? String(data.phone) : '',
            email: data.email ? String(data.email) : '',
            address: data.address ? String(data.address) : undefined,
            notes: data.notes ? String(data.notes) : '',
            openingBalance: Number(data.opening_balance) || 0,
            type: (data.type as 'cash' | 'credit') || 'cash',
            declaredRole: (data.declared_role as 'buyer' | 'seller') || null,
            isActive: true,
          },
          { clientRequestId: key },
        )
        createdCloudId = (customerRes as { id: string }).id
        break
      }

      case 'invoice': {
        const cloudCustomerId = data.customer_id
          ? await this.resolveCloudId(ctx.workspaceId, 'customer', String(data.customer_id))
          : null

        const rawItems = (data.items as Array<Record<string, unknown>>) || []
        const mappedItems = []
        for (const item of rawItems) {
          const cloudProdId = item.product_id
            ? await this.resolveCloudId(ctx.workspaceId, 'product', String(item.product_id))
            : null
          mappedItems.push({
            productId: cloudProdId ?? undefined,
            productName: String(item.product_name || 'کالا'),
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unit_price) || 0,
            discount: Number(item.discount) || 0,
          })
        }

        const invRes = await this.invoiceService.create(
          ctx,
          {
            type: data.type as 'sale' | 'purchase',
            customerId: cloudCustomerId ?? undefined,
            date: String(data.date),
            dueDate: data.due_date ? String(data.due_date) : undefined,
            currency: String(data.currency) as never,
            exchangeRate: data.exchange_rate ? Number(data.exchange_rate) : 1,
            reference: String(data.invoice_number || data.external_number || localId),
            notes: data.notes ? String(data.notes) : undefined,
            items: mappedItems,
          },
          null,
          { clientRequestId: key, isImport: true },
        )

        const invoiceId = (invRes as { id: string }).id
        createdCloudId = invoiceId

        // If invoice was cancelled on device, cancel it now to produce reverseEffects
        if (data.status === 'cancelled') {
          await this.invoiceService.update(invoiceId, ctx, { id: invoiceId, status: 'cancelled' })
        }
        break
      }

      case 'payment': {
        const cloudPartyId = data.party_id
          ? await this.resolveCloudId(ctx.workspaceId, 'customer', String(data.party_id))
          : null

        const rawAllocations =
          (data.allocations as Array<{ invoice_id: string; amount: number }>) || []
        const mappedAllocations = []
        for (const alloc of rawAllocations) {
          const cloudInvId = await this.resolveCloudId(ctx.workspaceId, 'invoice', alloc.invoice_id)
          if (cloudInvId) {
            mappedAllocations.push({ invoiceId: cloudInvId, amount: alloc.amount })
          }
        }

        const payRes = await this.paymentsService.recordPayment(
          ctx,
          {
            direction: data.direction as 'in' | 'out',
            partyType: (data.party_type as 'customer' | 'supplier') || 'customer',
            partyId: cloudPartyId,
            amount: Number(data.amount) || 0,
            currency: String(data.currency),
            entryDate: String(data.entry_date).slice(0, 10),
            method: (data.method as 'cash' | 'bank') || 'cash',
            reference: data.reference ? String(data.reference) : '',
            notes: data.notes ? String(data.notes) : '',
            allocations: mappedAllocations.length > 0 ? mappedAllocations : undefined,
          },
          { clientRequestId: key },
        )
        createdCloudId = (payRes as { id: string }).id
        break
      }

      case 'inventory_movement': {
        if (data.type === 'transfer') {
          const cloudProdId = await this.resolveCloudId(
            ctx.workspaceId,
            'product',
            String(data.product_id),
          )
          const fromWh = await this.resolveCloudId(
            ctx.workspaceId,
            'warehouse',
            String(data.from_warehouse_id),
          )
          const toWh = await this.resolveCloudId(
            ctx.workspaceId,
            'warehouse',
            String(data.to_warehouse_id),
          )

          if (cloudProdId && fromWh && toWh) {
            await this.warehouseService.transferStock(
              ctx,
              {
                productId: cloudProdId,
                fromWarehouseId: fromWh,
                toWarehouseId: toWh,
                quantity: Number(data.quantity) || 0,
                notes: data.notes ? String(data.notes) : undefined,
              },
              { idempotencyKey: key },
            )
          }
        }
        break
      }
    }

    // Record mapping if entity produced a cloud UUID
    if (createdCloudId) {
      await supabase.from('cloud_migration_map').insert({
        workspace_id: ctx.workspaceId,
        job_id: job.id,
        entity_type: section,
        local_id: localId,
        cloud_id: createdCloudId,
      })
    }
  }

  // ─── 6. Resolve Local ID to Cloud ID ───────────────────────────────────────
  async resolveCloudId(
    workspaceId: string,
    entity: string,
    localId: string,
  ): Promise<string | null> {
    const { data } = await supabase
      .from('cloud_migration_map')
      .select('cloud_id')
      .eq('workspace_id', workspaceId)
      .eq('entity_type', entity)
      .eq('local_id', localId)
      .maybeSingle()

    return data?.cloud_id ?? null
  }

  // ─── 7. Reconcile Job (Step M3) ────────────────────────────────────────────
  async reconcileJob(
    ctx: TenancyContext,
    jobId: string,
    expectedPreview: MigrationPreview,
  ): Promise<ReconciliationOutcome> {
    await this.claimJob(ctx, jobId)

    try {
      // Build full local -> cloud ID mapping
      const { data: mappings } = await supabase
        .from('cloud_migration_map')
        .select('entity_type, local_id, cloud_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('job_id', jobId)

      const cloudIdMap = new Map<string, string>()
      for (const m of mappings ?? []) {
        cloudIdMap.set(`${m.entity_type}:${m.local_id}`, m.cloud_id)
        cloudIdMap.set(m.local_id, m.cloud_id)
      }

      const outcome = await this.reconciliationService.reconcile(ctx, expectedPreview, cloudIdMap)

      const nextStatus = outcome.matched ? 'AWAITING_CONFIRMATION' : 'ROLLED_BACK'
      await supabase
        .from('cloud_migration_jobs')
        .update({
          status: nextStatus,
          reconciliation_result: outcome,
          reconciliation_diffs: outcome.diffs,
          error_code: null,
          lease_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', jobId)

      return outcome
    } catch (err) {
      await this.releaseJob(ctx, jobId)
      throw err
    }
  }

  // ─── 8. Confirm Migration (Switch to Cloud) ────────────────────────────────
  async confirmJob(ctx: TenancyContext, jobId: string): Promise<CloudMigrationJob> {
    const job = await this.getJob(ctx, jobId)
    if (job.status !== 'AWAITING_CONFIRMATION') {
      throw new ValidationError(`CANNOT_CONFIRM_JOB_IN_STATUS_${job.status}`)
    }

    const now = new Date().toISOString()
    const { data: updated, error } = await supabase
      .from('cloud_migration_jobs')
      .update({
        status: 'COMPLETED',
        completed_at: now,
        updated_at: now,
      })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', jobId)
      .select('*')
      .single()

    if (error || !updated) throw new DatabaseError('Failed to confirm migration job', error)
    return this.mapJob(updated)
  }

  // ─── Getters ───────────────────────────────────────────────────────────────
  async getJob(ctx: TenancyContext, jobId: string): Promise<CloudMigrationJob> {
    const { data, error } = await supabase
      .from('cloud_migration_jobs')
      .select('*')
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', jobId)
      .maybeSingle()

    if (error) throw new DatabaseError('Failed to fetch migration job', error)
    if (!data) throw new NotFoundError('CloudMigrationJob')
    return this.mapJob(data)
  }

  private mapJob(row: Record<string, unknown>): CloudMigrationJob {
    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      createdBy: String(row.created_by),
      deviceId: String(row.device_id),
      licenceId: String(row.licence_id),
      status: row.status as CloudMigrationJob['status'],
      errorCode: (row.error_code as string) || null,
      leaseExpiresAt: (row.lease_expires_at as string) || null,
      chunksTotal: Number(row.chunks_total) || 0,
      chunksCompleted: Number(row.chunks_completed) || 0,
      packageChecksum: (row.package_checksum as string) || null,
      previewMetrics: (row.preview_metrics as MigrationPreview) || null,
      reconciliationResult: (row.reconciliation_result as ReconciliationOutcome) || null,
      reconciliationDiffs:
        (row.reconciliation_diffs as CloudMigrationJob['reconciliationDiffs']) || null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      completedAt: (row.completed_at as string) || null,
    }
  }
}
