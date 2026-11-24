// ============================================
// backend/src/storage/storage-adapter.ts
//
// Provider-Agnostic Object Storage Adapter
// Decouples file & asset storage (invoices, PDF cache, receipts, avatars)
// from Supabase Storage, supporting:
// - SupabaseStorageProvider (`supabase`)
// - S3CompatibleStorageProvider (AWS S3, Cloudflare R2, MinIO, ArvanCloud via SigV4)
// - LocalFilesystemStorageProvider (atomic disk writes + HMAC signed URLs)
// - MemoryStorageProvider (isolated in-memory testing)
// ============================================

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { mkdir, readdir, rename, rm, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../db'

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

function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest()
}

function encodeRfc3986Path(pathStr: string): string {
  return pathStr
    .split('/')
    .map((seg) =>
      encodeURIComponent(seg).replace(
        /[!'()*]/g,
        (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/')
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

export interface S3CompatibleConfig {
  readonly endpoint: string
  readonly region: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly forcePathStyle?: boolean | undefined
  readonly publicBaseUrl?: string | undefined
  readonly fetchImpl?: typeof fetch | undefined
}

/**
 * Pure AWS Signature Version 4 S3-compatible object storage provider
 * (AWS S3, Cloudflare R2, MinIO, ArvanCloud, DigitalOcean Spaces).
 */
export class S3CompatibleStorageProvider implements StorageProvider {
  public readonly name = 's3-compatible'
  private readonly endpointUrl: URL
  private readonly fetchFn: typeof fetch
  private readonly forcePathStyle: boolean

  constructor(private readonly config: S3CompatibleConfig) {
    if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey || !config.region) {
      throw new Error(
        '[S3CompatibleStorageProvider] endpoint, region, accessKeyId, and secretAccessKey are required.',
      )
    }
    this.endpointUrl = new URL(config.endpoint.replace(/\/$/, ''))
    this.fetchFn = config.fetchImpl ?? globalThis.fetch
    this.forcePathStyle = config.forcePathStyle ?? true
  }

  private buildObjectUrl(
    bucket: string,
    keyPath: string,
    queryParams?: Record<string, string>,
  ): URL {
    const cleanBucket = bucket.replace(/^\/+|\/+$/g, '')
    const cleanKey = keyPath.replace(/^\/+/, '')
    const url = new URL(this.endpointUrl.toString())

    if (this.forcePathStyle) {
      const joined = cleanKey ? `/${cleanBucket}/${cleanKey}` : `/${cleanBucket}`
      url.pathname = encodeRfc3986Path(joined)
    } else {
      url.hostname = `${cleanBucket}.${this.endpointUrl.hostname}`
      url.pathname = encodeRfc3986Path(cleanKey ? `/${cleanKey}` : '/')
    }

    if (queryParams) {
      for (const k of Object.keys(queryParams).sort()) {
        url.searchParams.set(k, queryParams[k]!)
      }
    }
    return url
  }

  private signingKey(dateStamp: string): Buffer {
    const kDate = hmacSha256(`AWS4${this.config.secretAccessKey}`, dateStamp)
    const kRegion = hmacSha256(kDate, this.config.region)
    const kService = hmacSha256(kRegion, 's3')
    return hmacSha256(kService, 'aws4_request')
  }

  private signHeaders(
    method: string,
    url: URL,
    payloadHash: string,
    extraHeaders: Record<string, string> = {},
    now: Date = new Date(),
  ): Record<string, string> {
    const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = iso.slice(0, 8)

    const lowerHeaders: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': iso,
    }
    for (const [k, v] of Object.entries(extraHeaders)) {
      lowerHeaders[k.toLowerCase()] = v.trim()
    }

    const sortedKeys = Object.keys(lowerHeaders).sort()
    const canonicalHeaders = sortedKeys.map((k) => `${k}:${lowerHeaders[k]}\n`).join('')
    const signedHeaders = sortedKeys.join(';')

    const canonicalQuery = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const canonicalRequest = [
      method.toUpperCase(),
      url.pathname || '/',
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', iso, scope, sha256Hex(canonicalRequest)].join('\n')
    const signature = createHmac('sha256', this.signingKey(dateStamp))
      .update(stringToSign)
      .digest('hex')

    return {
      ...extraHeaders,
      'x-amz-date': iso,
      'x-amz-content-sha256': payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    }
  }

  async upload(
    bucket: string,
    path: string,
    fileData: Buffer,
    options?: StorageUploadOptions,
  ): Promise<{ path: string; publicUrl?: string | undefined }> {
    const url = this.buildObjectUrl(bucket, path)
    const payloadHash = sha256Hex(fileData)
    const headers = this.signHeaders('PUT', url, payloadHash, {
      'content-type': options?.contentType ?? 'application/octet-stream',
    })

    const res = await this.fetchFn(url.toString(), {
      method: 'PUT',
      headers,
      body: new Uint8Array(fileData),
    })
    if (!res.ok) {
      throw new Error(
        `[S3CompatibleStorageProvider] Upload failed (${res.status}) for ${bucket}/${path}`,
      )
    }

    const publicUrl =
      options?.isPublic && this.config.publicBaseUrl
        ? `${this.config.publicBaseUrl.replace(/\/$/, '')}/${bucket}/${path.replace(/^\/+/, '')}`
        : undefined
    return { path, publicUrl }
  }

  async download(bucket: string, path: string): Promise<Buffer> {
    const url = this.buildObjectUrl(bucket, path)
    const headers = this.signHeaders('GET', url, sha256Hex(''))
    const res = await this.fetchFn(url.toString(), { method: 'GET', headers })
    if (!res.ok) {
      throw new Error(
        `[S3CompatibleStorageProvider] Download failed (${res.status}) for ${bucket}/${path}`,
      )
    }
    return Buffer.from(await res.arrayBuffer())
  }

  async getSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
    now: Date = new Date(),
  ): Promise<string> {
    const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = iso.slice(0, 8)
    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`
    const ttl = Math.max(1, Math.min(604800, Math.floor(expiresInSeconds)))

    const url = this.buildObjectUrl(bucket, path, {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.config.accessKeyId}/${scope}`,
      'X-Amz-Date': iso,
      'X-Amz-Expires': String(ttl),
      'X-Amz-SignedHeaders': 'host',
    })

    const canonicalQuery = [...url.searchParams.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const canonicalRequest = [
      'GET',
      url.pathname || '/',
      canonicalQuery,
      `host:${url.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n')

    const stringToSign = ['AWS4-HMAC-SHA256', iso, scope, sha256Hex(canonicalRequest)].join('\n')
    const signature = createHmac('sha256', this.signingKey(dateStamp))
      .update(stringToSign)
      .digest('hex')

    url.searchParams.set('X-Amz-Signature', signature)
    return url.toString()
  }

  async delete(bucket: string, path: string): Promise<void> {
    const url = this.buildObjectUrl(bucket, path)
    const headers = this.signHeaders('DELETE', url, sha256Hex(''))
    const res = await this.fetchFn(url.toString(), { method: 'DELETE', headers })
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `[S3CompatibleStorageProvider] Delete failed (${res.status}) for ${bucket}/${path}`,
      )
    }
  }

  async list(bucket: string, prefix?: string): Promise<string[]> {
    const query: Record<string, string> = { 'list-type': '2' }
    if (prefix) query.prefix = prefix
    const url = this.buildObjectUrl(bucket, '', query)
    const headers = this.signHeaders('GET', url, sha256Hex(''))
    const res = await this.fetchFn(url.toString(), { method: 'GET', headers })
    if (!res.ok) {
      throw new Error(`[S3CompatibleStorageProvider] List failed (${res.status}) for ${bucket}`)
    }
    const xml = await res.text()
    const keys: string[] = []
    for (const match of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) {
      if (match[1]) keys.push(match[1])
    }
    return keys
  }
}

/**
 * Atomic local-disk storage provider with strict path-traversal prevention and
 * HMAC-SHA256 signed download URLs for single-node/edge deployments.
 */
export class LocalFilesystemStorageProvider implements StorageProvider {
  public readonly name = 'local-filesystem'
  private readonly resolvedRoot: string

  constructor(
    rootDir: string,
    private readonly signingSecret: string = process.env.STORAGE_SIGNING_SECRET ??
      process.env.JWT_SECRET ??
      'hisabche-local-storage-signing-key',
    private readonly baseUrl: string = process.env.PUBLIC_STORAGE_URL ?? 'https://storage.local',
  ) {
    this.resolvedRoot = resolve(rootDir)
  }

  private safeResolve(bucket: string, objectPath: string): { bucketDir: string; fullPath: string } {
    const cleanBucket = bucket.replace(/[^a-zA-Z0-9._-]/g, '')
    if (!cleanBucket || cleanBucket.includes('..')) {
      throw new Error(`[LocalFilesystemStorageProvider] Unsafe bucket name: ${bucket}`)
    }
    const bucketDir = resolve(this.resolvedRoot, cleanBucket)
    const candidate = resolve(bucketDir, objectPath)
    if (candidate !== bucketDir && !candidate.startsWith(bucketDir + sep)) {
      throw new Error(
        `[LocalFilesystemStorageProvider] Path traversal blocked for ${bucket}/${objectPath}`,
      )
    }
    return { bucketDir, fullPath: candidate }
  }

  async upload(
    bucket: string,
    path: string,
    fileData: Buffer,
    options?: StorageUploadOptions,
  ): Promise<{ path: string; publicUrl?: string | undefined }> {
    const { fullPath } = this.safeResolve(bucket, path)
    await mkdir(dirname(fullPath), { recursive: true })
    const tmpPath = `${fullPath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tmpPath, fileData, options?.upsert === false ? { flag: 'wx' } : undefined)
    await rename(tmpPath, fullPath)
    return {
      path,
      publicUrl: options?.isPublic
        ? `${this.baseUrl.replace(/\/$/, '')}/${bucket}/${path.replace(/^\/+/, '')}`
        : undefined,
    }
  }

  async download(bucket: string, path: string): Promise<Buffer> {
    const { fullPath } = this.safeResolve(bucket, path)
    return readFile(fullPath)
  }

  async getSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string> {
    this.safeResolve(bucket, path)
    const exp = Math.floor(Date.now() / 1000) + Math.max(1, Math.floor(expiresInSeconds))
    const sig = createHmac('sha256', this.signingSecret)
      .update(`${bucket}:${path}:${exp}`)
      .digest('hex')
    return `${this.baseUrl.replace(/\/$/, '')}/${bucket}/${encodeRfc3986Path(path)}?exp=${exp}&sig=${sig}`
  }

  verifySignedToken(
    bucket: string,
    path: string,
    exp: number,
    sig: string,
    nowSec = Math.floor(Date.now() / 1000),
  ): boolean {
    if (!Number.isFinite(exp) || exp <= nowSec) return false
    const expected = createHmac('sha256', this.signingSecret)
      .update(`${bucket}:${path}:${exp}`)
      .digest('hex')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  async delete(bucket: string, path: string): Promise<void> {
    const { fullPath } = this.safeResolve(bucket, path)
    await rm(fullPath, { force: true })
  }

  async list(bucket: string, prefix = ''): Promise<string[]> {
    const { bucketDir } = this.safeResolve(bucket, '')
    const results: string[] = []
    async function walk(dir: string) {
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else if (entry.isFile() && !entry.name.endsWith('.tmp')) {
          const rel = relative(bucketDir, full).replace(/\\/g, '/')
          if (!prefix || rel.startsWith(prefix)) results.push(rel)
        }
      }
    }
    await walk(bucketDir)
    return results.sort()
  }
}

/**
 * In-Memory Storage Provider for fast deterministic unit tests.
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

  async getSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string> {
    return `https://storage.local/${bucket}/${path}?signed=true&exp=${Math.floor(Date.now() / 1000) + expiresInSeconds}`
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

export function createStorageProviderFromEnv(): StorageProvider {
  const mode = (process.env.STORAGE_PROVIDER ?? 'supabase').toLowerCase()
  if (mode === 's3' || mode === 'r2' || mode === 'minio' || mode === 'arvan') {
    return new S3CompatibleStorageProvider({
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
    })
  }
  if (mode === 'local') {
    return new LocalFilesystemStorageProvider(process.env.STORAGE_LOCAL_ROOT ?? './storage')
  }
  if (mode === 'memory') {
    return new MemoryStorageProvider()
  }
  return new SupabaseStorageProvider()
}

let activeStorageProvider: StorageProvider = new SupabaseStorageProvider()

export function setStorageProvider(provider: StorageProvider): void {
  activeStorageProvider = provider
}

export function getStorageProvider(): StorageProvider {
  return activeStorageProvider
}
