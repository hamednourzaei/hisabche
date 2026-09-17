// ============================================
// Customer Profile Core — service.
// Receivable/payable come from the Payments Core; nothing is totalled here.
// ============================================

import { PaymentsService } from '../payments'
import { AccountingService } from '../accounting'
import type { TenancyContext } from '../tenancy.service'
import { NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { ConflictError } from '../../errors/database.error'
import { CustomerProfileRepository } from './customer-profile.repository'
import {
  CustomerProfileError,
  cleanFileName,
  combinedBalance,
  creditControl,
  customerInsights,
  matchDocumentEntries,
  validateDocument,
  type CreditControl,
  type CustomerDocument,
  type DocumentAccounting,
  type Insight,
} from './customer-profile.domain'

export interface CustomerAccounting {
  documents: DocumentAccounting[]
  postedCount: number
  unpostedCount: number
}

export interface CustomerProfile {
  /** false until docs/customer-360-phase3-migration.sql has been run. */
  configured: boolean
  creditLimit: number | null
  paymentTermsDays: number | null
  credit: CreditControl | null
  linkedSupplier: { id: string; name: string } | null
  /** Present only when linked: both sides of the same party. */
  combined: {
    customerNet: number
    supplierPayable: number
    net: number
    mixedCurrencies: boolean
  } | null
}

export interface TermsInput {
  creditLimit?: number | null | undefined
  paymentTermsDays?: number | null | undefined
  supplierId?: string | null | undefined
}

const rethrow = (err: unknown): never => {
  if (err instanceof CustomerProfileError) {
    if (
      err.code === 'CUSTOMER_NOT_FOUND' ||
      err.code === 'CUSTOMER_DOCUMENT_NOT_FOUND' ||
      err.code === 'CUSTOMER_SUPPLIER_NOT_FOUND'
    ) {
      throw new NotFoundError(err.code)
    }
    if (
      err.code === 'CUSTOMER_PROFILE_MIGRATION_PENDING' ||
      err.code === 'CUSTOMER_SUPPLIER_ALREADY_LINKED'
    ) {
      throw new ConflictError(err.code)
    }
    throw new ValidationError(err.code)
  }
  throw err
}

export class CustomerProfileService {
  constructor(
    private readonly repo = new CustomerProfileRepository(),
    private readonly payments = new PaymentsService(),
    private readonly accounting = new AccountingService(),
  ) {}

  /** Every statement document with the journal entries that account for it. Newest first. */
  async getAccounting(ctx: TenancyContext, customerId: string): Promise<CustomerAccounting> {
    if (!(await this.repo.customerExists(ctx.workspaceId, customerId)))
      throw new NotFoundError('CUSTOMER_NOT_FOUND')
    const ledger = await this.payments.getPartyLedger(ctx, 'customer', customerId)
    const documents = ledger.movements.flatMap((row) =>
      row.sourceType && row.sourceId
        ? [
            {
              sourceType: row.sourceType,
              sourceId: row.sourceId,
              date: row.date,
              kind: row.kind,
              reference: row.reference,
              amount: row.amount,
            },
          ]
        : [],
    )
    const entries = await this.accounting.entriesForDocuments(ctx, documents)
    const matched = matchDocumentEntries(documents, entries).reverse()
    const unpostedCount = matched.filter((document) => document.unposted).length
    return { documents: matched, postedCount: matched.length - unpostedCount, unpostedCount }
  }

  /** Rule-based observations built only from server figures. */
  async getInsights(
    ctx: TenancyContext,
    customerId: string,
  ): Promise<{ asOf: string; insights: Insight[] }> {
    const asOf = new Date().toISOString().slice(0, 10)
    const [profile, summary, activity, accounting] = await Promise.all([
      this.getProfile(ctx, customerId),
      this.payments.getPartySummary(ctx, 'customer', customerId, asOf),
      this.payments.getPartyActivity(ctx, 'customer', customerId, asOf),
      this.getAccounting(ctx, customerId),
    ])
    return {
      asOf,
      insights: customerInsights({
        asOf,
        receivable: summary.receivable,
        overdue: summary.overdue,
        overdueInvoiceCount: summary.overdueInvoiceCount,
        lastSaleAt: summary.lastSaleAt,
        monthly: activity.monthly,
        credit: profile.credit,
        unpostedCount: accounting.unpostedCount,
      }),
    }
  }

  async getProfile(ctx: TenancyContext, customerId: string): Promise<CustomerProfile> {
    try {
      const terms = await this.repo.terms(ctx.workspaceId, customerId)
      const summary = await this.payments.getPartySummary(ctx, 'customer', customerId)
      const supplier = terms.supplierId
        ? await this.repo.supplier(ctx.workspaceId, terms.supplierId)
        : null
      let combined: CustomerProfile['combined'] = null
      if (supplier) {
        const supplierSummary = await this.payments.getPartySummary(ctx, 'supplier', supplier.id)
        const currencies = new Set([...summary.currencies, ...supplierSummary.currencies])
        combined = {
          ...combinedBalance(summary.netBalance, supplierSummary.payable),
          mixedCurrencies: currencies.size > 1,
        }
      }
      return {
        configured: terms.configured,
        creditLimit: terms.creditLimit,
        paymentTermsDays: terms.paymentTermsDays,
        credit: creditControl(summary.receivable, terms.creditLimit),
        linkedSupplier: supplier,
        combined,
      }
    } catch (err) {
      return rethrow(err)
    }
  }

  async updateTerms(
    ctx: TenancyContext,
    customerId: string,
    input: TermsInput,
  ): Promise<CustomerProfile> {
    try {
      const patch: {
        credit_limit?: number | null
        payment_terms_days?: number | null
        supplier_id?: string | null
      } = {}
      if (input.creditLimit !== undefined) patch.credit_limit = input.creditLimit
      if (input.paymentTermsDays !== undefined) patch.payment_terms_days = input.paymentTermsDays
      if (input.supplierId !== undefined) {
        // The supplier must be in THIS workspace; an id from another tenant is "not found".
        if (input.supplierId && !(await this.repo.supplier(ctx.workspaceId, input.supplierId))) {
          throw new CustomerProfileError('CUSTOMER_SUPPLIER_NOT_FOUND')
        }
        patch.supplier_id = input.supplierId
      }
      await this.repo.updateTerms(ctx.workspaceId, customerId, patch)
    } catch (err) {
      rethrow(err)
    }
    return this.getProfile(ctx, customerId)
  }

  /** null = documents are not available until the migration runs. */
  async listDocuments(ctx: TenancyContext, customerId: string): Promise<CustomerDocument[] | null> {
    if (!(await this.repo.customerExists(ctx.workspaceId, customerId)))
      throw new NotFoundError('CUSTOMER_NOT_FOUND')
    return this.repo.listDocuments(ctx.workspaceId, customerId)
  }

  async addDocument(
    ctx: TenancyContext,
    customerId: string,
    input: { fileName: string; mimeType: string; contentBase64: string },
  ): Promise<CustomerDocument> {
    try {
      const sizeBytes = validateDocument(input)
      if (!(await this.repo.customerExists(ctx.workspaceId, customerId))) {
        throw new CustomerProfileError('CUSTOMER_NOT_FOUND')
      }
      return await this.repo.addDocument({
        workspaceId: ctx.workspaceId,
        customerId,
        userId: ctx.userId,
        fileName: cleanFileName(input.fileName),
        mimeType: input.mimeType,
        sizeBytes,
        content: Buffer.from(input.contentBase64, 'base64'),
      })
    } catch (err) {
      return rethrow(err)
    }
  }

  async documentUrl(
    ctx: TenancyContext,
    customerId: string,
    documentId: string,
  ): Promise<{ url: string }> {
    try {
      const doc = await this.repo.findDocument(ctx.workspaceId, customerId, documentId)
      return { url: await this.repo.signedUrl(doc.storagePath, doc.fileName) }
    } catch (err) {
      return rethrow(err)
    }
  }

  async removeDocument(ctx: TenancyContext, customerId: string, documentId: string): Promise<void> {
    try {
      const doc = await this.repo.findDocument(ctx.workspaceId, customerId, documentId)
      await this.repo.removeDocument(ctx.workspaceId, doc.id, ctx.userId)
    } catch (err) {
      rethrow(err)
    }
  }
}
