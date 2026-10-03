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

/** Longest range that is filled day by day; beyond it the points are returned as they came. */
const MAX_FILLED_DAYS = 1100

/**
 * One point per calendar day from `startDate` to `endDate`, zero where the
 * server had nothing.
 *
 * The analytics endpoint returns only the days that HAD sales. The chart drew
 * those as isolated dots or joined them straight across the empty days, so a
 * quiet week read as one steady line — and a single sale was a lone dot with
 * no line at all. A day without a sale is a real zero, and the line should
 * sit on it and rise when a sale arrives.
 *
 * The invoice/customer series are filled with 0 only if the server sent them:
 * a missing series stays missing (see `mapToSalesDataPoint`).
 */
export function fillDailyGaps(
  points: SalesDataPoint[],
  startDate: string,
  endDate: string,
): SalesDataPoint[] {
  const parse = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN
  }
  const from = parse(startDate)
  const to = parse(endDate)
  const DAY = 86_400_000
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return points
  if ((to - from) / DAY > MAX_FILLED_DAYS) return points

  const byDay = new Map(points.map((p) => [p.date.slice(0, 10), p]))
  const hasInvoices = points.some((p) => typeof p.invoiceCount === 'number')
  const hasCustomers = points.some((p) => typeof p.customerCount === 'number')

  const filled: SalesDataPoint[] = []
  for (let t = from; t <= to; t += DAY) {
    // Calendar arithmetic on a YYYY-MM-DD string: built from the UTC fields of
    // a UTC-midnight instant, so no timezone can move the day.
    const d = new Date(t)
    const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    filled.push(
      byDay.get(day) ?? {
        label: day,
        value: 0,
        date: day,
        ...(hasInvoices ? { invoiceCount: 0 } : {}),
        ...(hasCustomers ? { customerCount: 0 } : {}),
      },
    )
  }
  // A point outside the requested range is still the server's answer — keep it.
  for (const p of points) if (!filled.includes(p)) filled.push(p)
  return filled.sort((a, b) => a.date.localeCompare(b.date))
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
      // «Today» starts at this device's midnight, not the server's (UTC):
      // a sale at 01:00 in Tehran was counted as yesterday's (BUG-087).
      // Read inside the query — it runs only in the browser.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const { data } = await apiClient.get('/analytics/dashboard', { params: tz ? { tz } : {} })
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
        const series = fillDailyGaps(
          data,
          String(queryParams.startDate),
          String(queryParams.endDate),
        )
        return { data: series, chartData: series, total, average }
      }

      // ✅ حالت ۲: response.data.data (فرمت قبلی)
      if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data.map(mapToSalesDataPoint)
        total = response.data.total ?? data.reduce((sum: number, d) => sum + d.value, 0)
        average = response.data.average ?? (data.length > 0 ? total / data.length : 0)
        const series = fillDailyGaps(
          data,
          String(queryParams.startDate),
          String(queryParams.endDate),
        )
        return { data: series, chartData: series, total, average }
      }

      // ✅ حالت ۳: response.data خودش آرایه است
      if (Array.isArray(response.data)) {
        data = response.data.map(mapToSalesDataPoint)
        total = data.reduce((sum: number, d) => sum + d.value, 0)
        average = data.length > 0 ? total / data.length : 0
        const series = fillDailyGaps(
          data,
          String(queryParams.startDate),
          String(queryParams.endDate),
        )
        return { data: series, chartData: series, total, average }
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
