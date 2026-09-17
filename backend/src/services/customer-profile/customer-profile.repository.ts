// ============================================
// Customer Profile Core — repository. The only file that names
// `customer_documents`, the phase-3 customer columns, or the bucket.
//
// Every read of the phase-3 schema tolerates it not existing yet
// (isMissingSchema): code can ship before the human runs the migration.
// ============================================

import { supabase } from '../../db'
import { DatabaseError } from '../../errors/database.error'
import {
  CustomerProfileError,
  isMissingSchema,
  type CustomerDocument,
  toDocument,
} from './customer-profile.domain'

const BUCKET = 'customer-documents'

export interface CustomerTerms {
  configured: boolean
  creditLimit: number | null
  paymentTermsDays: number | null
  supplierId: string | null
}

const numberOrNull = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : Number(value)

export class CustomerProfileRepository {
  async customerExists(workspaceId: string, customerId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('id', customerId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to fetch customer', error)
    return !!data
  }

  async terms(workspaceId: string, customerId: string): Promise<CustomerTerms> {
    const { data, error } = await supabase
      .from('customers')
      .select('id, credit_limit, payment_terms_days, supplier_id')
      .eq('workspace_id', workspaceId)
      .eq('id', customerId)
      .maybeSingle()
    if (isMissingSchema(error)) {
      if (!(await this.customerExists(workspaceId, customerId))) {
        throw new CustomerProfileError('CUSTOMER_NOT_FOUND')
      }
      return { configured: false, creditLimit: null, paymentTermsDays: null, supplierId: null }
    }
    if (error) throw new DatabaseError('Failed to fetch customer terms', error)
    if (!data) throw new CustomerProfileError('CUSTOMER_NOT_FOUND')
    return {
      configured: true,
      creditLimit: numberOrNull(data.credit_limit),
      paymentTermsDays: numberOrNull(data.payment_terms_days),
      supplierId: data.supplier_id ? String(data.supplier_id) : null,
    }
  }

  async updateTerms(
    workspaceId: string,
    customerId: string,
    patch: {
      credit_limit?: number | null
      payment_terms_days?: number | null
      supplier_id?: string | null
    },
  ): Promise<void> {
    const { data, error } = await supabase
      .from('customers')
      .update(patch)
      .eq('workspace_id', workspaceId)
      .eq('id', customerId)
      .select('id')
    if (isMissingSchema(error)) throw new CustomerProfileError('CUSTOMER_PROFILE_MIGRATION_PENDING')
    if (error?.code === '23505') throw new CustomerProfileError('CUSTOMER_SUPPLIER_ALREADY_LINKED')
    if (error) throw new DatabaseError('Failed to update customer terms', error)
    if (!data || data.length === 0) throw new CustomerProfileError('CUSTOMER_NOT_FOUND')
  }

  async supplier(
    workspaceId: string,
    supplierId: string,
  ): Promise<{ id: string; name: string } | null> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .eq('id', supplierId)
      .maybeSingle()
    if (error) throw new DatabaseError('Failed to fetch supplier', error)
    return data ? { id: String(data.id), name: String(data.name ?? '') } : null
  }

  /** null = the table does not exist yet. */
  async listDocuments(workspaceId: string, customerId: string): Promise<CustomerDocument[] | null> {
    const { data, error } = await supabase
      .from('customer_documents')
      .select('id, file_name, mime_type, size_bytes, created_at, uploaded_by')
      .eq('workspace_id', workspaceId)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (isMissingSchema(error)) return null
    if (error) throw new DatabaseError('Failed to fetch customer documents', error)
    return (data ?? []).map(toDocument)
  }

  async findDocument(workspaceId: string, customerId: string, documentId: string) {
    const { data, error } = await supabase
      .from('customer_documents')
      .select('id, storage_path, file_name')
      .eq('workspace_id', workspaceId)
      .eq('customer_id', customerId)
      .eq('id', documentId)
      .is('deleted_at', null)
      .maybeSingle()
    if (isMissingSchema(error)) throw new CustomerProfileError('CUSTOMER_PROFILE_MIGRATION_PENDING')
    if (error) throw new DatabaseError('Failed to fetch customer document', error)
    if (!data) throw new CustomerProfileError('CUSTOMER_DOCUMENT_NOT_FOUND')
    return {
      id: String(data.id),
      storagePath: String(data.storage_path),
      fileName: String(data.file_name),
    }
  }

  /**
   * Upload, then record. If the row insert fails the object is removed again —
   * an orphan file with no row is invisible, not a second ledger entry, so
   * this is cleanup of storage rather than a compensating DELETE of data.
   */
  async addDocument(input: {
    workspaceId: string
    customerId: string
    userId: string
    fileName: string
    mimeType: string
    sizeBytes: number
    content: Buffer
  }): Promise<CustomerDocument> {
    const id = crypto.randomUUID()
    const storagePath = `${input.workspaceId}/${input.customerId}/${id}`
    const upload = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, input.content, { contentType: input.mimeType, upsert: false })
    if (upload.error) {
      if (/bucket not found/i.test(upload.error.message)) {
        throw new CustomerProfileError('CUSTOMER_PROFILE_MIGRATION_PENDING')
      }
      throw new DatabaseError('Failed to store customer document', upload.error)
    }
    const { data, error } = await supabase
      .from('customer_documents')
      .insert({
        id,
        workspace_id: input.workspaceId,
        customer_id: input.customerId,
        storage_path: storagePath,
        file_name: input.fileName,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        uploaded_by: input.userId,
      })
      .select('id, file_name, mime_type, size_bytes, created_at, uploaded_by')
      .single()
    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath])
      if (isMissingSchema(error))
        throw new CustomerProfileError('CUSTOMER_PROFILE_MIGRATION_PENDING')
      throw new DatabaseError('Failed to record customer document', error)
    }
    return toDocument(data)
  }

  async signedUrl(storagePath: string, fileName: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 300, { download: fileName })
    if (error || !data) throw new DatabaseError('Failed to sign document url', error)
    return data.signedUrl
  }

  /** Soft delete; the object stays so the audit trail can still be opened. */
  async removeDocument(workspaceId: string, documentId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('customer_documents')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq('workspace_id', workspaceId)
      .eq('id', documentId)
    if (error) throw new DatabaseError('Failed to remove customer document', error)
  }
}
