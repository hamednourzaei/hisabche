// ============================================
// Invoice Hooks — TanStack Query
// FIXED: اضافه شدن Realtime روی جدول invoices — با هر
// INSERT/UPDATE/DELETE، لیست فاکتورها بلافاصله invalidate می‌شود
// (به‌جای تکیه‌ی صرف روی invalidateQueries دستی بعد از هر mutation
// که فقط تغییرات همین کلاینت را پوشش می‌داد، نه تغییرات از دستگاه‌ها
// یا تب‌های دیگر).
//
// نکته: چون useInvoices بر اساس filters چند queryKey متفاوت می‌سازد
// (هر فیلتر/صفحه یک key جدا)، اینجا از invoiceKeys.lists() (سطح
// والد، بدون فیلتر) به useRealtime داده شده — با هر تغییر، تمام
// کوئری‌هایی که زیرمجموعه‌ی ['invoices', 'list'] هستند (یعنی همه‌ی
// فیلترها و صفحات) invalidate می‌شوند. جزئیات یک فاکتور خاص
// (invoiceKeys.detail) هم همینطور، چون همه زیرمجموعه‌ی
// invoiceKeys.all هستند.
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'
import type {
  Invoice,
  CreateInvoice,
  UpdateInvoice,
  InvoiceFilters,
} from '@hisabche/validation'

// ============================================
// Types
// ============================================
export interface InvoiceWithCustomer extends Invoice {
  customerName?: string | null;
  customer?: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string;
  } | null;
}

// ============================================
// Query Keys
// ============================================
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
}

// ============================================
// Hooks
// ============================================

// ✅ گیت شده با authReady: تا session hydrate نشود، fire نمی‌شود (رفع 401 استورم اولیه)
export function useInvoices(filters: InvoiceFilters = { page: 1, limit: 20, sortDirection: 'desc' }) {
  const authReady = useAuthReady()

  // ✅ FIX: به‌جای polling، subscribe مستقیم به جدول invoices —
  // با هر تغییر، هم تمام لیست‌های فاکتور (صرف‌نظر از فیلتر) و هم
  // صفحات جزئیات یک فاکتور خاص بلافاصله invalidate می‌شوند.
  // عمداً از invoiceKeys.all (سطح ریشه) استفاده شده، نه .lists() —
  // چون useInvoice (جزئیات فاکتور) دیگر subscription جدای خودش را
  // ندارد؛ نگه‌داشتن این یک subscription در useInvoices کافی است و
  // از ساخته‌شدن دو کانال هم‌زمان روی جدول invoices (وقتی لیست و
  // جزئیات یک فاکتور در یک صفحه هم‌زمان mount هستند) جلوگیری می‌کند.
  useRealtime({ table: 'invoices', queryKey: invoiceKeys.all as unknown as string[] })

  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<{
        invoices: InvoiceWithCustomer[];
        total: number;
        hasMore: boolean;
        nextCursor: string | null;
        limit: number;
      }>('/invoices', {
        params: filters,
      })
      return data
    },
    enabled: authReady,
    staleTime: 1000 * 60 * 2,
    placeholderData: (previousData) => previousData,
  })
}

// ⚠️ توجه: useInvoice عمداً subscription realtime جدای خودش را ندارد.
// اگر این هوک بدون useInvoices در همان صفحه استفاده شود (مثلاً یک
// صفحه‌ی جزئیات مستقل که هیچ‌جا لیست فاکتورها را mount نمی‌کند)،
// به‌روزرسانی realtime برای آن صفحه کار نخواهد کرد — چون هیچ
// subscription فعالی روی جدول invoices وجود نخواهد داشت. اگر با
// چنین صفحه‌ای مواجه شدی، همین‌جا یک useRealtime مستقل با
// queryKey: invoiceKeys.detail(id!) اضافه کن.
export function useInvoice(id: string | undefined) {
  const authReady = useAuthReady()

  return useQuery({
    queryKey: invoiceKeys.detail(id!),
    queryFn: async () => {
      const { data } = await apiClient.get<InvoiceWithCustomer>(`/invoices/${id}`)
      return data
    },
    enabled: authReady && !!id,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCreateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateInvoice) => {
      const { data } = await apiClient.post<Invoice>('/invoices', input)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() })
    },
  })
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateInvoice) => {
      const { data } = await apiClient.patch<Invoice>(`/invoices/${id}`, input)
      return data
    },
    onMutate: async (vars) => {
      const { id, ...updatedFields } = vars
      await queryClient.cancelQueries({ queryKey: invoiceKeys.detail(id) })
      const previousInvoice = queryClient.getQueryData<Invoice>(invoiceKeys.detail(id))

      if (previousInvoice) {
        queryClient.setQueryData<Invoice>(invoiceKeys.detail(id), {
          ...previousInvoice,
          ...updatedFields,
        } as Invoice)
      }

      return { previousInvoice }
    },
    onError: (_err, vars, context) => {
      if (context?.previousInvoice) {
        queryClient.setQueryData(invoiceKeys.detail(vars.id), context.previousInvoice)
      }
    },
    onSettled: (_data, _error, vars) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(vars.id) })
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() })
    },
  })
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/invoices/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() })
    },
  })
}