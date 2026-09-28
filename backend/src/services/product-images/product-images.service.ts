// ============================================
// backend/src/services/product-images/product-images.service.ts
//
// A product's gallery: up to 8 images, ordered, each with alt text
// (docs/product-images-migration.sql). The first image is the product's cover
// (`products.image_url`), kept in step by the database functions.
//
// ⚠️ THE TYPE COMES FROM THE BYTES (sniffImageType), never from a file name or
// a claimed MIME type. Paths are random UUIDs — the bucket is public, so a
// path must reveal nothing and be unguessable.
//
// Order of work, so a failure never leaves a row pointing at nothing:
//   add     upload → function (refused? remove the orphan object)
//   remove  function → remove the object (a leftover file is harmless)
// ============================================

import { randomUUID } from 'node:crypto'

import { supabase } from '../../db'
import { BaseError } from '../../errors/base.error'
import { DatabaseError } from '../../errors/database.error'
import type { TenancyContext } from '../tenancy.service'
import { scopes } from '../authorization/scope.service'
import { IMAGE_EXTENSION, sniffImageType } from '../blog/blog.domain'

export const PRODUCT_IMAGE_BUCKET = 'product-images'
export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const PRODUCT_IMAGE_LIMIT = 8

export class ProductImageError extends BaseError {
  constructor(code: string, statusCode: number) {
    super(code, statusCode)
    this.name = 'ProductImageError'
  }
}

const RAISED: Record<string, number> = {
  PRODUCT_IMAGE_LIMIT: 409,
  PRODUCT_IMAGE_ORDER_INVALID: 400,
  PRODUCT_IMAGE_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
}

/** The tables or functions are absent: the migration has not run. */
function notConfigured(error: { code?: string } | null): boolean {
  return !!error && ['42P01', 'PGRST205', '42883', 'PGRST202'].includes(error.code ?? '')
}

export function productImageFailure(
  error: { code?: string; message?: string },
  fallback: string,
): Error {
  if (notConfigured(error)) return new ProductImageError('PRODUCT_IMAGES_NOT_CONFIGURED', 503)
  const code = Object.keys(RAISED).find((c) => (error.message ?? '').includes(c))
  return code ? new ProductImageError(code, RAISED[code]!) : new DatabaseError(fallback, error)
}

export interface ProductImage {
  id: string
  productId: string
  position: number
  altText: string
  url: string
  createdAt: string
}

const COLUMNS = 'id, product_id, position, alt_text, url, created_at'

const toImage = (r: Record<string, unknown>): ProductImage => ({
  id: String(r.id),
  productId: String(r.product_id),
  position: Number(r.position),
  altText: String(r.alt_text ?? ''),
  url: String(r.url),
  createdAt: String(r.created_at),
})

export class ProductImagesService {
  async list(ctx: TenancyContext, productId: string): Promise<ProductImage[]> {
    const { data, error } = await supabase
      .from('product_images')
      .select(COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('product_id', productId)
      .order('position', { ascending: true })
    if (error) throw productImageFailure(error, 'Failed to read product images')
    return (data ?? []).map((r) => toImage(r as Record<string, unknown>))
  }

  async add(
    ctx: TenancyContext,
    productId: string,
    input: { base64: string; altText?: string | undefined },
  ): Promise<ProductImage> {
    await scopes.assertMay(ctx, 'product', productId, 'product.write')

    const bytes = Buffer.from(input.base64, 'base64')
    if (bytes.length === 0) throw new ProductImageError('PRODUCT_IMAGE_EMPTY', 400)
    if (bytes.length > PRODUCT_IMAGE_MAX_BYTES) {
      throw new ProductImageError('PRODUCT_IMAGE_TOO_LARGE', 413)
    }
    // jpeg, png, webp or avif — decided by the bytes.
    const mime = sniffImageType(bytes)
    if (!mime) throw new ProductImageError('PRODUCT_IMAGE_TYPE', 415)

    const path = `${randomUUID()}.${IMAGE_EXTENSION[mime]}`
    const upload = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(path, bytes, {
      contentType: mime,
      upsert: false,
      cacheControl: '31536000',
    })
    if (upload.error) {
      if (/bucket not found/i.test(upload.error.message)) {
        throw new ProductImageError('PRODUCT_IMAGES_NOT_CONFIGURED', 503)
      }
      throw new DatabaseError('Failed to store the product image', upload.error)
    }
    const url = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl

    const { data, error } = await supabase.rpc('add_product_image', {
      p_workspace_id: ctx.workspaceId,
      p_product_id: productId,
      p_user_id: ctx.userId,
      p_path: path,
      p_url: url,
      p_alt_text: input.altText ?? '',
    })
    if (error) {
      // Refused (the 9th image, a product of another business): the file has
      // no row. Removing an orphan object is storage cleanup, not a
      // compensating write of data.
      await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path])
      throw productImageFailure(error, 'Failed to add the product image')
    }
    return toImage(data as Record<string, unknown>)
  }

  async remove(ctx: TenancyContext, productId: string, imageId: string): Promise<void> {
    await scopes.assertMay(ctx, 'product', productId, 'product.write')
    const { data, error } = await supabase.rpc('remove_product_image', {
      p_workspace_id: ctx.workspaceId,
      p_image_id: imageId,
    })
    if (error) throw productImageFailure(error, 'Failed to remove the product image')
    const path = typeof data === 'string' ? data : null
    // The row is gone; a file left behind is only storage, never shown.
    if (path) await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path])
  }

  async reorder(ctx: TenancyContext, productId: string, ids: string[]): Promise<void> {
    await scopes.assertMay(ctx, 'product', productId, 'product.write')
    const { error } = await supabase.rpc('reorder_product_images', {
      p_workspace_id: ctx.workspaceId,
      p_product_id: productId,
      p_ids: ids,
    })
    if (error) throw productImageFailure(error, 'Failed to reorder the product images')
  }

  /** Alt text only — one row, one table, no function needed. */
  async setAltText(
    ctx: TenancyContext,
    productId: string,
    imageId: string,
    altText: string,
  ): Promise<ProductImage> {
    await scopes.assertMay(ctx, 'product', productId, 'product.write')
    const { data, error } = await supabase
      .from('product_images')
      .update({ alt_text: altText })
      .eq('id', imageId)
      .eq('product_id', productId)
      .eq('workspace_id', ctx.workspaceId)
      .select(COLUMNS)
      .maybeSingle()
    if (error) throw productImageFailure(error, 'Failed to save the alt text')
    if (!data) throw new ProductImageError('PRODUCT_IMAGE_NOT_FOUND', 404)
    return toImage(data as Record<string, unknown>)
  }
}

export const productImagesService = new ProductImagesService()
