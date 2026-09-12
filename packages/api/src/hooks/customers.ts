// ============================================
// Customer Hooks — TanStack Query
// FIXED: اضافه شدن Realtime روی جدول customers — با هر
// INSERT/UPDATE/DELETE، لیست و جزئیات مشتریان بلافاصله invalidate
// می‌شوند.
//
// نکته: مثل invoices.ts و products.ts، فقط useCustomers (لیست)
// subscription realtime دارد — با customerKeys.all (سطح ریشه) که
// هم لیست‌ها و هم صفحات جزئیات را پوشش می‌دهد. useCustomer
// (جزئیات) عمداً subscription جدای خودش را ندارد تا از دو کانال
// هم‌زمان روی جدول customers جلوگیری شود.
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { asList } from '../lib/as-list'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'
import type {
  Customer,
  CreateCustomer,
  UpdateCustomer,
  CustomerFilters,
} from '@hisabche/validation'

// ============================================
// Query Keys
// ============================================

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters: CustomerFilters) => [...customerKeys.lists(), filters] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
}

// ============================================
// Hooks
// ============================================

export function useCustomers(
  filters: CustomerFilters = { page: 1, limit: 20, sortDirection: 'desc' },
) {
  const authReady = useAuthReady()

  // ✅ FIX: تنها subscription realtime برای جدول customers — با
  // customerKeys.all، هم لیست‌ها (هر فیلتری) و هم جزئیات مشتری
  // پوشش داده می‌شوند.
  useRealtime({ table: 'customers', queryKey: customerKeys.all as unknown as string[] })

  return useQuery({
    queryKey: customerKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<{ customers: Customer[]; total: number }>('/customers', {
        params: filters,
      })
      // A type annotation is not a runtime check. Every picker and list slices
      // `customers`, so the list is asked for, not assumed.
      return {
        ...(data && typeof data === 'object' ? data : {}),
        customers: asList<Customer>(data?.customers, '/customers'),
        total: typeof data?.total === 'number' ? data.total : 0,
      }
    },
    enabled: authReady,
    staleTime: 60_000,
    placeholderData: (previousData: any) => previousData,
  })
}

// ⚠️ توجه: این هوک عمداً subscription realtime جدای خودش را ندارد
// (توضیح در بالای فایل). اگر در صفحه‌ای مستقل و بدون useCustomers
// استفاده می‌شود، به‌روزرسانی realtime نخواهد داشت.
export function useCustomer(id: string | undefined) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: customerKeys.detail(id!),
    queryFn: async () => {
      const { data } = await apiClient.get<Customer>(`/customers/${id}`)
      return data
    },
    enabled: authReady && !!id,
    staleTime: 60_000,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateCustomer) => {
      const { data } = await apiClient.post<Customer>('/customers', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCustomer) => {
      const { data } = await apiClient.patch<Customer>(`/customers/${id}`, input)
      return data
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    },
  })
}
