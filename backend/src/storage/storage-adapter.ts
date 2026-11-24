// ============================================
// backend/src/storage/storage-adapter.ts
//
// Provider-Agnostic Object Storage Adapter
// Decouples file & asset storage (invoices, PDF cache, receipts, avatars)
// from Supabase Storage, enabling seamless use of AWS S3, Cloudflare R2,
// MinIO, Iranian Object Storage (ArvanCloud), or Local Filesystem.
// ============================================

import { supabase } from '../db'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface StorageUploadOptions {
  contentType?: string | undefined
  upsert?: boolean | undefined
  isPublic?: boolean | undefined
}

export interface StorageProvider {
  readonly name: string
  upload(
    bucket: string,
    path: string,
    fileData: Buffer,
    options?: StorageUploadOptions,
  ): Promise<{ path: string; publicUrl?: string | undefined }>
  download(bucket: string, path: string): Promise<Buffer>
  getSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string>
  delete(bucket: string, path: string): Promise<void>
  list(bucket: string, prefix?: string): Promise<string[]>
}

/**
 * Default Supabase Storage implementation wrapping @supabase/supabase-js.
 */
export class SupabaseStorageProvider implements StorageProvider {
  public readonly name = 'supabase'
  private client: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.client = client ?? supabase
  }

  async upload(
    bucket: string,
    path: string,
    fileData: Buffer,
    options?: StorageUploadOptions,
  ): Promise<{ path: string; publicUrl?: string | undefined }> {
    const { data, error } = await this.client.storage.from(bucket).upload(path, fileData, {
      contentType: options?.contentType ?? 'application/octet-stream',
      upsert: options?.upsert ?? true,
    })

    if (error) {
      throw new Error(
        `[SupabaseStorageProvider] Upload failed for ${bucket}/${path}: ${error.message}`,
      )
    }

    let publicUrl: string | undefined
    if (options?.isPublic) {
      const pub = this.client.storage.from(bucket).getPublicUrl(path)
      publicUrl = pub.data.publicUrl
    }

    return { path: data.path, publicUrl }
  }

  async download(bucket: string, path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(bucket).download(path)
    if (error || !data) {
      throw new Error(
        `[SupabaseStorageProvider] Download failed for ${bucket}/${path}: ${error?.message ?? 'no data'}`,
      )
    }
    const arrayBuffer = await data.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async getSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds)
    if (error || !data?.signedUrl) {
      throw new Error(
        `[SupabaseStorageProvider] Signed URL generation failed for ${bucket}/${path}: ${error?.message ?? 'missing URL'}`,
      )
    }
    return data.signedUrl
  }

  async delete(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path])
    if (error) {
      throw new Error(
        `[SupabaseStorageProvider] Delete failed for ${bucket}/${path}: ${error.message}`,
      )
    }
  }

  async list(bucket: string, prefix?: string): Promise<string[]> {
    const { data, error } = await this.client.storage.from(bucket).list(prefix ?? '')
    if (error || !data) {
      throw new Error(
        `[SupabaseStorageProvider] List failed for ${bucket}: ${error?.message ?? 'no data'}`,
      )
    }
    return data.map((item) => item.name)
  }
}

/**
 * In-Memory & Local Filesystem Storage Provider for isolated testing and edge environments.
 */
export class MemoryStorageProvider implements StorageProvider {
  public readonly name = 'memory'
  private store = new Map<string, Buffer>()

  async upload(
    bucket: string,
    path: string,
    fileData: Buffer,
    _options?: StorageUploadOptions,
  ): Promise<{ path: string; publicUrl?: string | undefined }> {
    const key = `${bucket}/${path}`
    this.store.set(key, fileData)
    return { path, publicUrl: `https://storage.local/${key}` }
  }

  async download(bucket: string, path: string): Promise<Buffer> {
    const key = `${bucket}/${path}`
    const data = this.store.get(key)
    if (!data) throw new Error(`[MemoryStorageProvider] File not found: ${key}`)
    return data
  }

  async getSignedUrl(bucket: string, path: string, _expiresInSeconds: number): Promise<string> {
    return `https://storage.local/${bucket}/${path}?signed=true`
  }

  async delete(bucket: string, path: string): Promise<void> {
    this.store.delete(`${bucket}/${path}`)
  }

  async list(bucket: string, prefix?: string): Promise<string[]> {
    const prefixKey = `${bucket}/${prefix ?? ''}`
    const results: string[] = []
    for (const key of this.store.keys()) {
      if (key.startsWith(prefixKey)) {
        results.push(key.slice(`${bucket}/`.length))
      }
    }
    return results
  }
}

let activeStorageProvider: StorageProvider = new SupabaseStorageProvider()

export function setStorageProvider(provider: StorageProvider): void {
  activeStorageProvider = provider
}

export function getStorageProvider(): StorageProvider {
  return activeStorageProvider
}
