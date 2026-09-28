// The product-images layer in front of the database functions
// (product-images.pg.test.ts proves the functions themselves):
//   - the type comes from the bytes; a disguised file never reaches storage;
//   - the path is random and names no workspace or product;
//   - a refused add removes the object it just uploaded;
//   - a removal deletes the object only after the row is gone;
//   - raised codes → HTTP; the migration not run → 503, not 500;
//   - every write asks product.write on that product.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const upload = vi.fn()
const remove = vi.fn()
const assertMay = vi.fn()
vi.mock('../db', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => upload(...a),
        remove: (...a: unknown[]) => remove(...a),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    },
  },
}))
vi.mock('../services/authorization/scope.service', () => ({
  scopes: { assertMay: (...a: unknown[]) => assertMay(...a) },
}))

const { productImagesService, productImageFailure, ProductImageError } =
  await import('../services/product-images/product-images.service')

const ctx = { workspaceId: 'ws-1', userId: 'u', role: 'owner' } as never
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

beforeEach(() => {
  rpc.mockReset()
  upload.mockReset().mockResolvedValue({ error: null })
  remove.mockReset().mockResolvedValue({ error: null })
  assertMay.mockReset().mockResolvedValue(undefined)
})

describe('adding an image', () => {
  it('a real PNG: uploaded under a random path, then filed with its public url', async () => {
    rpc.mockResolvedValue({
      data: { id: 'i', product_id: 'p', position: 0, alt_text: '', url: 'x', created_at: 't' },
      error: null,
    })
    await productImagesService.add(ctx, 'p', { base64: PNG.toString('base64') })
    expect(assertMay).toHaveBeenCalledWith(ctx, 'product', 'p', 'product.write')
    const [path, , options] = upload.mock.calls[0]!
    expect(path).toMatch(/^[0-9a-f-]{36}\.png$/)
    expect(path).not.toContain('ws-1')
    expect(options).toMatchObject({ contentType: 'image/png', upsert: false })
    expect(rpc).toHaveBeenCalledWith(
      'add_product_image',
      expect.objectContaining({
        p_workspace_id: 'ws-1',
        p_path: path,
        p_url: `https://cdn.test/${path}`,
      }),
    )
  })

  it('a file that is not an image never reaches storage', async () => {
    const html = Buffer.from('<html><script>alert(1)</script>').toString('base64')
    await expect(productImagesService.add(ctx, 'p', { base64: html })).rejects.toMatchObject({
      message: 'PRODUCT_IMAGE_TYPE',
      statusCode: 415,
    })
    expect(upload).not.toHaveBeenCalled()
  })

  it('too large is refused before upload', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]).toString('base64')
    await expect(productImagesService.add(ctx, 'p', { base64: big })).rejects.toMatchObject({
      message: 'PRODUCT_IMAGE_TOO_LARGE',
    })
    expect(upload).not.toHaveBeenCalled()
  })

  it('refused by the database (the 9th): the uploaded object is removed', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'PRODUCT_IMAGE_LIMIT' } })
    await expect(
      productImagesService.add(ctx, 'p', { base64: PNG.toString('base64') }),
    ).rejects.toMatchObject({ message: 'PRODUCT_IMAGE_LIMIT', statusCode: 409 })
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]![0]])
  })
})

describe('removing an image', () => {
  it('the object goes only after the row is gone', async () => {
    const order: string[] = []
    rpc.mockImplementation(async () => {
      order.push('row')
      return { data: 'abc.webp', error: null }
    })
    remove.mockImplementation(async () => {
      order.push('object')
      return { error: null }
    })
    await productImagesService.remove(ctx, 'p', 'img')
    expect(order).toEqual(['row', 'object'])
    expect(remove).toHaveBeenCalledWith(['abc.webp'])
  })

  it('a refused removal touches no object', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0002', message: 'PRODUCT_IMAGE_NOT_FOUND' },
    })
    await expect(productImagesService.remove(ctx, 'p', 'img')).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(remove).not.toHaveBeenCalled()
  })
})

describe('raised codes → HTTP', () => {
  it.each([
    ['PRODUCT_IMAGE_LIMIT', 409],
    ['PRODUCT_IMAGE_ORDER_INVALID', 400],
    ['PRODUCT_IMAGE_NOT_FOUND', 404],
    ['PRODUCT_NOT_FOUND', 404],
  ])('%s → %i', (code, status) => {
    const err = productImageFailure({ code: 'P0001', message: code }, 'x')
    expect(err).toBeInstanceOf(ProductImageError)
    expect((err as InstanceType<typeof ProductImageError>).statusCode).toBe(status)
  })

  it('the migration not run → 503 PRODUCT_IMAGES_NOT_CONFIGURED', () => {
    expect(productImageFailure({ code: 'PGRST202' }, 'x').message).toBe(
      'PRODUCT_IMAGES_NOT_CONFIGURED',
    )
  })

  it('anything else is a 500, never a guessed code', () => {
    expect(productImageFailure({ code: '57014', message: 'timeout' }, 'x')).not.toBeInstanceOf(
      ProductImageError,
    )
  })
})

describe('routes', () => {
  const src = readFileSync(join(__dirname, '..', 'routes', 'product-images.routes.ts'), 'utf8')

  it('all five are behind authenticate + workspace context, and registered', () => {
    const routes = [
      ...src.matchAll(
        /fastify\.(get|post|put|patch|delete)\(\s*'([^']+)',\s*\{\s*preHandler:\s*(\w+)/g,
      ),
    ]
    expect(routes).toHaveLength(5)
    for (const [, , , guard] of routes) expect(guard).toBe('guard')
    expect(src).toContain('const guard = [authenticate, requireWorkspaceContext]')
    const index = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
    expect(index).toContain('await server.register(productImagesRoutes)')
  })

  it('every write invalidates the cached product lists (the cover changes)', () => {
    expect(src.match(/invalidateMoneyCaches\(request\.tenancy\.workspaceId\)/g)).toHaveLength(3)
  })
})
