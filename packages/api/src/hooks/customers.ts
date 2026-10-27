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
import apiClient, { type ApiError, getAppEdition, localRequest } from '../lib/client'
import { getOfflineQueue } from '../lib/offline-queue'
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

export interface CustomersReadOptions {
  /**
   * Read the device's rows FIRST, even when the network is up.
   *
   * ⚠️ This is the Always-Local milestone: one screen proving it can answer
   * from the device database alone. The device is kept fresh by the sync
   * engine (and by its realtime stream), so the answer is at most one sync
   * behind. A device that knows nothing yet falls back to the network — an
   * empty device is "I do not know", not "this business has no customers".
   */
  preferDevice?: boolean
}

export interface CustomersPage {
  customers: Customer[]
  total: number
  /**
   * The device does not hold this list — it was never pulled for this
   * workspace. The screen must say so, not show an empty business.
   */
  notAvailableOffline?: boolean
}

/**
 * The filters the device database cannot honour.
 *
 * `role`, `type` and `hasBalance` are DERIVED on the server (from the
 * invoices a party appears on). The device holds no such derivation, so a
 * device answer to those filters would be a different list from the server's
 * — and a wrong list that looks right is worse than no list at all.
 */
function deviceCannotHonour(filters: CustomerFilters): boolean {
  return (
    filters.role !== undefined || filters.type !== undefined || filters.hasBalance !== undefined
  )
}

/** One device row → one customer, the same way the product list does it. */
function customerFromRow(r: Record<string, unknown>): Customer {
  return {
    id: String(r.id),
    fullName: String(r.full_name ?? ''),
    phone: (r.phone as string | null) ?? undefined,
    email: (r.email as string | null) ?? undefined,
    address: (r.address as string | null) ?? undefined,
    notes: (r.notes as string | null) ?? undefined,
    openingBalance: Number(r.opening_balance ?? 0),
    isActive: r.is_active !== 0,
    type: r.type === 'credit' ? 'credit' : 'cash',
    declaredRole: (r.declared_role as Customer['declaredRole']) ?? undefined,
    createdAt: String(r.created_at ?? '') || undefined,
    updatedAt: String(r.updated_at ?? '') || undefined,
  } as unknown as Customer
}

/**
 * The customer list: from the device when it can, from the server when it
 * cannot.
 *
 * ⚠️ ONE PATH. The device branch, the network fallback and the offline
 * fallback are the branches the product list already uses
 * (packages/api/src/hooks/products.ts) — not a second list that behaves
 * differently from the first.
 *
 * ⚠️ A customer created ON THIS DEVICE and not yet synced is a row of the
 * device table like any other (`dirty = 1`), so it is in this list. Leaving
 * it out would show the shopkeeper an empty customer list right after they
 * created the customer.
 */
export async function fetchCustomers(
  filters: CustomerFilters,
  options: CustomersReadOptions = {},
  signal: AbortSignal,
): Promise<CustomersPage> {
  const device = getOfflineQueue()
  const canUseDevice = !!device?.readRows && !deviceCannotHonour(filters)

  // ⚠️ THE ENGINE FIRST, THE GATED TABLE READ ONLY WHEN THERE IS NO ENGINE.
  // `db:query` is refused by the desktop's main process without a stored
  // sign-in (`IPC_REJECTED:db:query`) — the same failure that emptied the
  // product picker (26 Oct 2026). The engine scopes by workspace and needs no
  // such session; the gate on `db:query` stays where it is.
  const fromEngine = async (): Promise<CustomersPage | null> => {
    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue
      params[key] = String(value)
    }
    const page = await localRequest<CustomersPage>('GET', '/customers', undefined, params)
    if (!page) return null
    const customers = asList<Customer>(page.customers, '/customers')
    const total = typeof page.total === 'number' ? page.total : customers.length
    return {
      ...page,
      customers,
      total,
      notAvailableOffline:
        total === 0 &&
        getAppEdition() !== 'offline' &&
        device?.hasSynced !== undefined &&
        device.hasSynced('customer') === false,
    }
  }

  const fromRows = async (): Promise<CustomersPage> => {
    const limit = filters.limit ?? 20
    const page = filters.page ?? 1
    const { rows, total, synced } = await device!.readRows!('customer', filters.search ?? '', {
      // The same filters the API applies: a deleted row is not a customer, and
      // `is_active` is a filter only when the caller asked for one
      // (backend/src/services/customer.service.ts:250).
      where: {
        deleted_at: null,
        ...(filters.isActive === undefined ? {} : { is_active: filters.isActive ? 1 : 0 }),
      },
      // The API's own default order.
      orderBy: filters.sortBy ?? 'created_at',
      direction: filters.sortDirection ?? 'desc',
      limit,
      offset: (page - 1) * limit,
    })
    return {
      customers: rows.map(customerFromRow),
      total,
      // The device knows nothing about this table yet.
      notAvailableOffline: synced === false,
    }
  }

  const fromDevice = async (): Promise<CustomersPage> => (await fromEngine()) ?? fromRows()

  if (canUseDevice && device.isOffline()) return fromDevice()

  if (canUseDevice && options.preferDevice) {
    const answer = await fromDevice()
    if (answer.total > 0) return answer
  }

  try {
    const { data } = await apiClient.get<{ customers: Customer[]; total: number }>('/customers', {
      params: filters,
      signal,
    })
    // A type annotation is not a runtime check. Every picker and list slices
    // `customers`, so the list is asked for, not assumed.
    return {
      ...(data && typeof data === 'object' ? data : {}),
      customers: asList<Customer>(data?.customers, '/customers'),
      total: typeof data?.total === 'number' ? data.total : 0,
    }
  } catch (error) {
    // The request never got an answer: the device still has the list.
    if (canUseDevice && (error as Partial<ApiError>)?.code === 'NETWORK_ERROR') return fromDevice()
    throw error
  }
}

export function useCustomers(
  filters: CustomerFilters = { page: 1, limit: 20, sortDirection: 'desc' },
  options: CustomersReadOptions = {},
) {
  const authReady = useAuthReady()

  // ✅ FIX: تنها subscription realtime برای جدول customers — با
  // customerKeys.all، هم لیست‌ها (هر فیلتری) و هم جزئیات مشتری
  // پوشش داده می‌شوند.
  useRealtime({ table: 'customers', queryKey: customerKeys.all as unknown as string[] })

  return useQuery({
    queryKey: customerKeys.list(filters),
    // `signal`: when the search term changes or the picker closes, React Query
    // aborts the request still in flight instead of letting it finish unused.
    queryFn: async ({ signal }) => fetchCustomers(filters, options, signal),
    enabled: authReady,
    staleTime: 60_000,
    placeholderData: (previousData: any) => previousData,
    // ⚠️ React Query PAUSES an offline query by default, so the device branch
    // would never be reached at all — the same trap the product list had
    // (packages/api/src/hooks/products.ts).
    networkMode: 'always',
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

export function useDeleteCustomer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/customers/${id}`)
      return id
    },
    onSuccess: () => {
      // Only the lists: removing the detail entry made the still-mounted file page
      // re-fetch a customer that no longer exists (a 404) before it navigated away.
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
