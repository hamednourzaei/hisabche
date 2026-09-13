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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'
import type { Product, CreateProduct, UpdateProduct, ProductFilters } from '@hisabche/validation'

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

// ✅ گیت شده با authReady
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
    queryFn: async () => {
      const { data } = await apiClient.get<{
        products: Product[]
        total: number
        /** Present only when the request set `includeSummary: true`. */
        summary?: StockSummary | undefined
      }>('/products', {
        params: mergedFilters,
      })
      return data
    },
    enabled: authReady,
    staleTime: 1000 * 60 * 2,
  })
}

// ⚠️ توجه: این هوک عمداً subscription realtime جدای خودش را ندارد
// (توضیح در بالای فایل). اگر در صفحه‌ای مستقل و بدون useProducts
// استفاده می‌شود، به‌روزرسانی realtime نخواهد داشت.
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
