// ============================================
// Product Hooks — TanStack Query
// FIXED: اضافه شدن Realtime روی جدول products — با هر
// INSERT/UPDATE/DELETE، لیست و جزئیات محصولات بلافاصله invalidate
// می‌شوند (به‌جای تکیه‌ی صرف روی invalidateQueries دستی بعد از هر
// mutation که فقط تغییرات همین کلاینت را پوشش می‌داد).
//
// نکته: مثل invoices.ts، فقط useProducts (لیست) subscription
// realtime دارد — با productKeys.all (سطح ریشه) که هم لیست‌ها و هم
// صفحات جزئیات را پوشش می‌دهد. useProduct (جزئیات) عمداً subscription
// جدای خودش را ندارد تا از دو کانال هم‌زمان روی جدول products
// جلوگیری شود. اگر صفحه‌ای فقط useProduct را بدون useProducts در
// همان صفحه استفاده می‌کند، آن صفحه realtime نخواهد بود — در آن
// صورت باید یک useRealtime مستقل به useProduct اضافه شود.
// ============================================

import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient, { type ApiError } from '../lib/client'
import { getOfflineQueue } from '../lib/offline-queue'
import { useAuthReady } from './useAuthReady'
import { asList } from '../lib/as-list'
import { useRealtime } from './useRealtime'
import type { Product, CreateProduct, UpdateProduct, ProductFilters } from '@hisabche/validation'
import { normalizeBarcode } from '@hisabche/validation'

// ============================================
// Query Keys
// ============================================
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
}

// ============================================
// Hooks
// ============================================

/**
 * Stock figures computed by the server over EVERY product in the workspace —
 * never reduce a fetched page of products for these.
 */
export interface StockSummary {
  productCount: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
}

/**
 * What a scan resolved to. `error` is its own answer: a failed lookup must
 * never read as `unknown`, which invites creating a product that exists.
 */
export type BarcodeLookup =
  // `unit`: an EXTRA barcode that sells in its own unit — the carton's code
  // adds a carton (docs/product-barcodes-migration.sql).
  | {
      status: 'found'
      product: Product
      source: 'device' | 'server'
      unit?: Product['unit'] | undefined
    }
  | { status: 'ambiguous'; products: Product[] }
  | { status: 'unknown'; barcode: string }
  | { status: 'error'; barcode: string; offline: boolean }

/**
 * Resolve a scanned barcode: the device database first, then the server.
 *
 * Local-first (desktop): a hit is instant and works offline. A miss on the
 * device is not proof — the product may have been added since the last sync —
 * so the server is asked before «unknown» is said.
 */
export async function lookupProductByBarcode(raw: string): Promise<BarcodeLookup> {
  const barcode = normalizeBarcode(raw)
  // ⚠️ Never look up ''. «No barcode» is stored as '', so an empty code would
  // match every product that has none and offer them all as candidates.
  if (!barcode) return { status: 'unknown', barcode }
  const device = getOfflineQueue()

  if (device?.findByBarcode) {
    try {
      const rows = await device.findByBarcode(barcode)
      if (rows.length === 1)
        return { status: 'found', product: productFromRow(rows[0]!), source: 'device' }
      if (rows.length > 1) return { status: 'ambiguous', products: rows.map(productFromRow) }
    } catch {
      // A device-database hiccup is not an answer; the server still is.
    }
  }

  if (device?.isOffline()) return { status: 'error', barcode, offline: true }

  try {
    const { data } = await apiClient.get<{ product: Product; unit?: Product['unit'] }>(
      `/products/by-barcode/${encodeURIComponent(barcode)}`,
    )
    return data.unit
      ? { status: 'found', product: data.product, source: 'server', unit: data.unit }
      : { status: 'found', product: data.product, source: 'server' }
  } catch (error) {
    const apiError = error as Partial<ApiError>
    if (apiError.status === 404) return { status: 'unknown', barcode }
    if (apiError.status === 409)
      return { status: 'ambiguous', products: (apiError.candidates ?? []) as Product[] }
    return { status: 'error', barcode, offline: apiError.code === 'NETWORK_ERROR' }
  }
}

// ✅ گیت شده با authReady
/** A device-database product row (sync-engine FROM_LOG) in the API's shape. */
function productFromRow(r: Record<string, unknown>): Product {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    barcode: (r.barcode as string | null) ?? undefined,
    sku: (r.sku as string | null) ?? undefined,
    category: (r.category as string | null) ?? undefined,
    quantity: Number(r.quantity ?? 0),
    unit: (r.unit as string | null) ?? undefined,
    minStockLevel: Number(r.min_stock_level ?? 0),
    buyPrice: Number(r.buy_price ?? 0),
    sellPrice: Number(r.sell_price ?? 0),
    isActive: r.is_active !== 0,
    updatedAt: String(r.updated_at ?? ''),
  } as unknown as Product
}

export function useProducts(filters: Partial<ProductFilters> = {}) {
  const authReady = useAuthReady()

  // ✅ FIX: تنها subscription realtime برای جدول products — با
  // productKeys.all، هم لیست‌ها (هر فیلتری) و هم جزئیات محصول
  // پوشش داده می‌شوند.
  useRealtime({ table: 'products', queryKey: productKeys.all as unknown as string[] })

  // ✅ فقط فیلدهایی که ارسال نشده‌اند را با default پر کن
  const mergedFilters: ProductFilters = {
    page: filters.page ?? 1,
    limit: filters.limit ?? 20,
    sortDirection: filters.sortDirection ?? 'desc',
    search: filters.search ?? '',
    sortBy: filters.sortBy ?? 'created_at',
    isActive: filters.isActive,
    category: filters.category,
    barcode: filters.barcode,
    lowStock: filters.lowStock,
    includeSummary: filters.includeSummary,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    cursor: filters.cursor,
  }

  return useQuery({
    queryKey: productKeys.list(mergedFilters),
    // Aborted by React Query when the search term changes or the picker closes.
    queryFn: async ({ signal }) => {
      type Page = {
        products: Product[]
        total: number
        /** Present only when the request set `includeSummary: true`. */
        summary?: StockSummary | undefined
      }
      // ⚠️ Offline this list used to render "no products" — the network error
      // shown as an empty stock (راهنمای سشن §۷٫۳) — while the device database
      // held every product. A host with that database answers instead.
      const device = getOfflineQueue()
      const fromDevice = async (): Promise<Page> => {
        const rows = await device!.readRows!('product', mergedFilters.search ?? '')
        const products = rows.map(productFromRow)
        return { products, total: products.length }
      }
      if (device?.readRows && device.isOffline()) return fromDevice()
      try {
        const { data } = await apiClient.get<Page>('/products', { params: mergedFilters, signal })
        return data
      } catch (error) {
        // An aborted request is not "no network": never fall back to the device for it.
        if (signal.aborted) throw error
        if (device?.readRows && (error as Partial<ApiError>)?.code === 'NETWORK_ERROR')
          return fromDevice()
        throw error
      }
    },
    enabled: authReady,
    staleTime: 1000 * 60 * 2,
    // ⚠️ 'always', not the default 'online': offline, React Query PAUSES a
    // query and never calls queryFn — so the device-database answer above was
    // never reached and the stock picker said "no products" with all of them
    // on the device. This queryFn decides for itself what offline means.
    networkMode: 'always',
  })
}

// ⚠️ توجه: این هوک عمداً subscription realtime جدای خودش را ندارد
// (توضیح در بالای فایل). اگر در صفحه‌ای مستقل و بدون useProducts
// استفاده می‌شود، به‌روزرسانی realtime نخواهد داشت.
// ─── Extra barcodes of one product ──────────────────────────────────────
//
// ⚠️ ONLINE ONLY. The device database keeps each product's MAIN barcode; an
// extra code is resolved by the server, so offline it reads as «not on this
// device» (the error answer), never as a different product.

export interface ProductBarcode {
  id: string
  barcode: string
  /** The unit this code sells in; null = the product's own. */
  unit: Product['unit'] | null
}

export const productBarcodeKeys = {
  of: (productId: string) => [...productKeys.all, 'barcodes', productId] as const,
}

export function useProductBarcodes(productId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: productBarcodeKeys.of(productId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<{ barcodes?: ProductBarcode[] }>(
        `/products/${productId}/barcodes`,
      )
      return Array.isArray(data?.barcodes) ? data.barcodes : []
    },
    enabled: authReady && Boolean(productId),
  })
}

export function useAddProductBarcode(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { barcode: string; unit?: Product['unit'] | null }) => {
      const { data } = await apiClient.post<ProductBarcode>(
        `/products/${productId}/barcodes`,
        input,
      )
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productBarcodeKeys.of(productId) }),
  })
}

export function useRemoveProductBarcode(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (barcodeId: string) => {
      await apiClient.delete(`/products/${productId}/barcodes/${barcodeId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productBarcodeKeys.of(productId) }),
  })
}

// ─── Product images (docs/product-images-migration.sql) ─────────────
// Up to 8 per product, ordered; the first is the product's cover, which every
// product and warehouse list shows — so a change refreshes those lists too.

export interface ProductImage {
  id: string
  productId: string
  position: number
  altText: string
  url: string
  createdAt: string
}

export const productImageKeys = {
  of: (productId: string) => [...productKeys.all, 'images', productId] as const,
}

/** The most images a product may have — the database refuses a 9th. */
export const PRODUCT_IMAGE_LIMIT = 8

function useImageInvalidation(productId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: productImageKeys.of(productId) })
    void queryClient.invalidateQueries({ queryKey: productKeys.detail(productId) })
    void queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    // warehouseKeys.all, by value: warehouses.ts imports this module, so
    // importing it back would be a cycle (CLAUDE.md §8).
    void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
  }
}

export function useProductImages(productId: string | undefined) {
  const authReady = useAuthReady()
  return useQuery({
    queryKey: productImageKeys.of(productId ?? ''),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ images?: unknown }>(`/products/${productId}/images`, {
        signal,
      })
      return asList<ProductImage>(data?.images)
    },
    enabled: authReady && Boolean(productId),
    // 503 (not configured) and 403 are answers, not blips.
    retry: false,
  })
}

export function useAddProductImage(productId: string) {
  const invalidate = useImageInvalidation(productId)
  return useMutation({
    mutationFn: async (input: { base64: string; altText?: string | undefined }) => {
      const { data } = await apiClient.post<ProductImage>(`/products/${productId}/images`, input)
      return data
    },
    onSuccess: invalidate,
  })
}

export function useRemoveProductImage(productId: string) {
  const invalidate = useImageInvalidation(productId)
  return useMutation({
    mutationFn: async (imageId: string) => {
      await apiClient.delete(`/products/${productId}/images/${imageId}`)
    },
    onSuccess: invalidate,
  })
}

export function useReorderProductImages(productId: string) {
  const invalidate = useImageInvalidation(productId)
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await apiClient.put(`/products/${productId}/images/order`, { ids })
    },
    onSuccess: invalidate,
  })
}

export function useSetProductImageAlt(productId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { imageId: string; altText: string }) => {
      const { data } = await apiClient.patch<ProductImage>(
        `/products/${productId}/images/${input.imageId}`,
        { altText: input.altText },
      )
      return data
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: productImageKeys.of(productId) }),
  })
}

export function useProduct(id: string | undefined) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: productKeys.detail(id!),
    queryFn: async () => {
      const { data } = await apiClient.get<Product>(`/products/${id}`)
      return data
    },
    enabled: authReady && !!id,
  })
}

/**
 * Several products by id — each one its own cached detail query, shared with
 * `useProduct`. For the invoice form's stock check: a list query with a limit
 * (the old `useProducts({ limit: 100 })`) silently skipped every product past
 * the first hundred, so an oversell on those raised no warning at all.
 */
export function useProductsByIds(ids: readonly string[]) {
  const authReady = useAuthReady()
  useRealtime({ table: 'products', queryKey: productKeys.all as unknown as string[] })

  return useQueries({
    queries: ids.map((id) => ({
      queryKey: productKeys.detail(id),
      queryFn: async () => {
        const { data } = await apiClient.get<Product>(`/products/${id}`)
        return data
      },
      enabled: authReady && !!id,
    })),
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateProduct) => {
      const { data } = await apiClient.post<Product>('/products', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProduct) => {
      // PATCH, not PUT: the route is `fastify.patch('/api/products/:id')`, so
      // a PUT matched nothing and every product edit answered 404 while the
      // form reported success.
      const { data } = await apiClient.patch<Product>(`/products/${id}`, input)
      return data
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/products/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}
