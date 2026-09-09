// ============================================
// packages/api/src/hooks/dashboard.ts
// FIXED: حذف polling و جایگزینی با Realtime واقعی.
//
// چرا: این هوک‌ها با refetchInterval (۶۰-۱۲۰ ثانیه) کار
// می‌کردند، یعنی حتی وقتی هیچ تغییری رخ نداده بود، هر کاربر
// باز هم درخواست می‌زد؛ و برعکس، وقتی یک فاکتور/مشتری/محصول
// همان لحظه تغییر می‌کرد، KPI ها تا رسیدن نوبت polling بعدی
// (حداکثر ۲ دقیقه) کهنه می‌ماندند — چیزی که طبق نیاز واقعی
// («KPI ها باید لحظه‌ای با تغییر customer/warehouse/چارت آپدیت
// شوند») قابل قبول نیست.
//
// useRealtime (که از قبل در پروژه با subscribeToChannel روی
// event: '*' — یعنی INSERT/UPDATE/DELETE — پیاده‌سازی شده بود)
// حالا مستقیماً در این فایل استفاده می‌شود. هر جدولی که روی
// یک KPI اثر دارد، جدا subscribe می‌شود و با هر تغییر، همان
// queryKey را invalidate می‌کند — بدون هیچ polling ثابتی.
// ============================================
'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/client'
import { useAuthReady } from './useAuthReady'
import { useRealtime } from './useRealtime'
import { asList } from '../lib/as-list'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface DashboardKPIs {
  todaySales: number
  todayInvoices: number
  monthlyRevenue: number
  monthlyGrowth: number
  pendingPayments: number
  pendingPaymentsCount: number
  activeCustomers: number
  customerGrowth: number
  lowStockAlerts: number
  totalSales: number
  customerDebt: number
  warehouseValue: number
}

export interface AIInsight {
  type: 'warning' | 'info' | 'success' | 'tip'
  title: string
  description: string
  action?: string
  actionLabel?: string
  metric?: number
  metricLabel?: string
}

export interface SalesDataPoint {
  label: string
  value: number
  date: string
  /**
   * Invoices and distinct customers in this bucket.
   *
   * The analytics endpoint has always returned both, but the mapper below
   * dropped them, so the chart saw no series and greyed out its «فاکتورها» and
   * «مشتریان» toggles — a feature that looked unbuilt was actually a lossy
   * two-line mapping. Optional because a cached response from before this
   * change, and the older `data` payload shape, carry neither.
   */
  invoiceCount?: number
  customerCount?: number
}

export interface SalesChartData {
  data: SalesDataPoint[]
  chartData?: SalesDataPoint[]
  total: number
  average: number
}

export interface InvoicesSummary {
  todaySales?: number
  todayCount?: number
  monthlyRevenue?: number
  totalDebt?: number
  customerCount?: number
  pendingCount?: number
}

export interface ProductsSummary {
  lowStockCount?: number
  lowStockItems?: Array<{
    id: string
    name: string
    quantity: number
    reorderPoint: number
  }>
}

// ─── Keys ────────────────────────────────────────────────────────────────────
export const dashboardKeys = {
  all: ['dashboard'] as const,
  kpis: () => [...dashboardKeys.all, 'kpis'] as const,
  insights: () => [...dashboardKeys.all, 'insights'] as const,
  sales: (params: Record<string, unknown>) => [...dashboardKeys.all, 'sales', params] as const,
}

// ─── Helper: Local Date (نه UTC) ──────────────────────────────────────────
// ✅ اصلاح: استفاده از تاریخ محلی به جای UTC
function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayDate(): string {
  return toLocalDateString(new Date())
}

function getWeekAgoDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return toLocalDateString(date)
}

function mapToSalesDataPoint(item: {
  label: string
  value: number
  date?: string
  invoiceCount?: number
  customerCount?: number
}): SalesDataPoint {
  return {
    label: item.label,
    value: item.value,
    date: item.date ?? getTodayDate(),
    // Spread-in rather than always-present: the chart distinguishes "no such
    // series" from "a series that is zero", and a hardcoded 0 would draw a
    // flat line where there is no data at all.
    ...(typeof item.invoiceCount === 'number' ? { invoiceCount: item.invoiceCount } : {}),
    ...(typeof item.customerCount === 'number' ? { customerCount: item.customerCount } : {}),
  }
}

interface DashboardSalesParams {
  days?: number
  from?: string
  to?: string
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

// ✅ گیت شده با authReady: قبل از hydrate شدن session، fire نمی‌شود
// ✅ FIX: به‌جای refetchInterval، سه Realtime subscription جدا —
// چون KPI های این هوک (todaySales, monthlyRevenue, pendingPayments
// از invoices؛ activeCustomers/customerGrowth از customers؛
// lowStockAlerts از products) به سه جدول متفاوت وابسته‌اند.
// هر تغییری در هرکدام، بلافاصله همان queryKey (dashboardKeys.kpis())
// را invalidate می‌کند.
export function useDashboardKPIs() {
  const authReady = useAuthReady()

  // ✅ FIX: useRealtime فقط string[] قبول می‌کند، ولی
  // dashboardKeys.kpis() شامل مقادیر ثابت رشته‌ای است — همان‌طور
  // که هست کار می‌کند. اینجا فقط برای type safety صریح تبدیل شده.
  useRealtime({ table: 'invoices', queryKey: dashboardKeys.kpis() as unknown as string[] })
  useRealtime({ table: 'customers', queryKey: dashboardKeys.kpis() as unknown as string[] })
  useRealtime({ table: 'products', queryKey: dashboardKeys.kpis() as unknown as string[] })

  return useQuery({
    queryKey: dashboardKeys.kpis(),
    queryFn: async (): Promise<DashboardKPIs> => {
      const { data } = await apiClient.get('/analytics/dashboard')
      return data
    },
    enabled: authReady,
    staleTime: 60_000,
    // ✅ FIX: بدون refetchInterval — Realtime جایگزین polling شده.
    // staleTime بالاتر رفته چون دیگر polling دوره‌ای پشتوانه نیست؛
    // این فقط سقف زمانی «بدون هیچ رویداد Realtime» است، نه فاصله‌ی
    // معمول رفرش.
  })
}

// ✅ گیت شده با authReady
// ✅ FIX: AI insights از ترکیب چند منبع ساخته می‌شود (فاکتورها،
// مشتریان، موجودی)، پس همان سه جدول را subscribe می‌کنیم.
export function useAIInsights() {
  const authReady = useAuthReady()

  useRealtime({ table: 'invoices', queryKey: dashboardKeys.insights() as unknown as string[] })
  useRealtime({ table: 'customers', queryKey: dashboardKeys.insights() as unknown as string[] })
  useRealtime({ table: 'products', queryKey: dashboardKeys.insights() as unknown as string[] })

  return useQuery({
    queryKey: dashboardKeys.insights(),
    queryFn: async (): Promise<AIInsight[]> => {
      const { data } = await apiClient.get('/ai/insights')
      return asList<AIInsight>(data)
    },
    enabled: authReady,
    staleTime: 120_000,
    // ✅ FIX: بدون refetchInterval — به Realtime تکیه می‌شود.
  })
}

// ✅ گیت شده با authReady
// ✅ FIX: چارت فروش فقط به invoices وابسته است.
export function useDashboardSales(params?: DashboardSalesParams) {
  const authReady = useAuthReady()

  // ✅ اصلاح: استفاده از تاریخ محلی
  const today = getTodayDate()
  const weekAgo = getWeekAgoDate()

  const queryParams: Record<string, string | number> = {
    days: params?.days ?? 30,
    startDate: params?.from ?? weekAgo,
    endDate: params?.to ?? today,
  }

  // ✅ اصلاح: اگر from یا to ارسال شده، از همان استفاده کن (دوباره تبدیل نکن)
  if (params?.from) {
    queryParams.startDate = params.from
  }
  if (params?.to) {
    queryParams.endDate = params.to
  }

  useRealtime({
    table: 'invoices',
    queryKey: dashboardKeys.sales(queryParams) as unknown as string[],
  })

  return useQuery({
    queryKey: dashboardKeys.sales(queryParams),
    queryFn: async (): Promise<SalesChartData> => {
      const response = await apiClient.get('/analytics/sales', {
        params: queryParams,
      })

      let data: SalesDataPoint[] = []
      let total = 0
      let average = 0

      // ✅ حالت ۱: response.data.chartData (فرمت جدید Backend)
      if (response.data?.chartData && Array.isArray(response.data.chartData)) {
        data = response.data.chartData.map(mapToSalesDataPoint)
        total = response.data.totalRevenue ?? data.reduce((sum: number, d) => sum + d.value, 0)
        average = data.length > 0 ? total / data.length : 0
        return { data, chartData: data, total, average }
      }

      // ✅ حالت ۲: response.data.data (فرمت قبلی)
      if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data.map(mapToSalesDataPoint)
        total = response.data.total ?? data.reduce((sum: number, d) => sum + d.value, 0)
        average = response.data.average ?? (data.length > 0 ? total / data.length : 0)
        return { data, chartData: data, total, average }
      }

      // ✅ حالت ۳: response.data خودش آرایه است
      if (Array.isArray(response.data)) {
        data = response.data.map(mapToSalesDataPoint)
        total = data.reduce((sum: number, d) => sum + d.value, 0)
        average = data.length > 0 ? total / data.length : 0
        return { data, chartData: data, total, average }
      }

      // ❌ حالت ۴: هیچ داده‌ای پیدا نشد
      const todayDate = getTodayDate()
      const fallbackData = [{ label: 'امروز', value: 0, date: todayDate }]
      return { data: fallbackData, chartData: fallbackData, total: 0, average: 0 }
    },
    enabled: authReady,
    staleTime: 120_000,
    // ✅ FIX: بدون refetchInterval — به Realtime تکیه می‌شود.
  })
}
