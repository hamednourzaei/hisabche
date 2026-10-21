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
import { apiClient, localRequest } from '../lib/client'
import { getOfflineQueue } from '../lib/offline-queue'
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
  /**
   * Figure groups the server did not tell this person (their fields are zero).
   * The card is left out — a zero would read as a measurement.
   */
  hidden?: Array<'sales' | 'customers' | 'stock' | 'stockValue'> | undefined
  /**
   * dashboard-fx-01: the money figures are in the books currency, each
   * invoice at its own frozen rate. Absent/false on a server or database
   * without it (the headline is then books-currency invoices only).
   */
  convertedToBooks?: boolean | undefined
  /** Invoices in another currency with no rate — left out, never added at 1. */
  unconvertedInvoices?: number | undefined
}

export interface AIInsight {
  type: 'warning' | 'info' | 'success' | 'tip'
  title: string
  description: string
  action?: string
  actionLabel?: string
  metric?: number
  metricLabel?: string
  /** What the suggestion is — written on screen from `dashboard.insight.<code>`. */
  code?: string
  values?: Record<string, number | string>
  currency?: string
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
  /**
   * Sales the device wrote and the server has not confirmed yet (D10).
   *
   * Only the local engine can answer this: the cloud route has no outbox to
   * count. Absent means «not known here» — the label is then not drawn at all,
   * which is not the same sentence as «0 waiting».
   */
  pendingInvoiceCount?: number | undefined
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

// ─── Freshness ───────────────────────────────────────────────────────────────
//
// «Almost live», like the invoice list (owner, 18 Oct 2026: 440M of sales on
// /invoices, the dashboard still on the old figure). The Realtime
// subscriptions below stay, but they are not something to rely on alone: an
// invoice issued on another device or by a colleague, or a Realtime channel
// that never connected, left these reads on a 1–2 minute stale window with no
// polling behind it. Now: stale after 5 s, re-read on focus and on every
// visit, and every 20 s while the tab is visible (never in the background).
// The server side is generation-checked (invalidateMoneyCaches), so a
// re-read after an invoice gets the new figure, not a cached one.
export const DASHBOARD_LIVE = {
  staleTime: 5_000,
  refetchOnWindowFocus: true,
  refetchOnMount: 'always',
  refetchInterval: 20_000,
  refetchIntervalInBackground: false,
} as const

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

/** The shape `GET /analytics/sales` answers with on the device. */
interface DeviceSalesResponse {
  chartData?: Array<{
    label: string
    value: number
    date?: string
    invoiceCount?: number
    customerCount?: number
  }>
  pendingInvoiceCount?: number
}

/**
 * The dashboard KPIs from the DEVICE, when there is no network.
 *
 * The local engine serves the same shape from the books it already holds
 * (packages/local-engine/src/routes/dashboard.ts), so the screen keeps showing
 * real numbers instead of a spinner. `null` means the device cannot answer —
 * the caller then takes its old path, and a failed read stays an error.
 */
export async function readDashboardKpisFromDevice(): Promise<DashboardKPIs | null> {
  if (!getOfflineQueue()?.isOffline()) return null
  return localRequest<DashboardKPIs>('GET', '/analytics/dashboard')
}

/**
 * The sales chart from the device, with the one number only it knows: how many
 * sales are still waiting in the outbox (D10).
 *
 * The local route answers with every sale the device holds, so the picker's
 * window is applied here — the chart and the range total then describe the
 * same days.
 */
export async function readDashboardSalesFromDevice(
  from: string,
  to: string,
): Promise<SalesChartData | null> {
  if (!getOfflineQueue()?.isOffline()) return null
  const local = await localRequest<DeviceSalesResponse>('GET', '/analytics/sales')
  if (!local) return null

  const points = (local.chartData ?? []).filter(
    (
      point,
    ): point is {
      label: string
      value: number
      date: string
      invoiceCount?: number
      customerCount?: number
    } => typeof point.date === 'string' && point.date >= from && point.date <= to,
  )

  const series = fillDailyGaps(points.map(mapToSalesDataPoint), from, to)
  const total = points.reduce((sum, point) => sum + point.value, 0)
  const invoices = points.reduce((sum, point) => sum + (point.invoiceCount ?? 0), 0)

  return {
    data: series,
    chartData: series,
    total,
    average: invoices > 0 ? total / invoices : 0,
    ...(typeof local.pendingInvoiceCount === 'number'
      ? { pendingInvoiceCount: local.pendingInvoiceCount }
      : {}),
  }
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

// ✅ گیت شده با authReady: قبل از hydrate شدن session، fire نمی‌شود
// ✅ FIX: به‌جای refetchInterval، سه Realtime subscription جدا —
// چون KPI های این هوک (todaySales, monthlyRevenue, pendingPayments
// از invoices؛ activeCustomers/customerGrowth از customers؛
// lowStockAlerts از products) به سه جدول متفاوت وابسته‌اند.
// هر تغییری در هرکدام، بلافاصله همان queryKey (dashboardKeys.kpis())
// را invalidate می‌کند.
/** A read of the dashboard that a page may switch off (a part the person hid). */
export interface DashboardReadOptions {
  enabled?: boolean | undefined
}

export function useDashboardKPIs(options: DashboardReadOptions = {}) {
  const authReady = useAuthReady()
  const enabled = options.enabled !== false

  // ✅ FIX: useRealtime فقط string[] قبول می‌کند، ولی
  // dashboardKeys.kpis() شامل مقادیر ثابت رشته‌ای است — همان‌طور
  // که هست کار می‌کند. اینجا فقط برای type safety صریح تبدیل شده.
  const kpisKey = dashboardKeys.kpis() as unknown as string[]
  useRealtime({ table: 'invoices', queryKey: kpisKey, enabled })
  useRealtime({ table: 'customers', queryKey: kpisKey, enabled })
  useRealtime({ table: 'products', queryKey: kpisKey, enabled })

  return useQuery({
    queryKey: dashboardKeys.kpis(),
    queryFn: async (): Promise<DashboardKPIs> => {
      // ⚠️ OFFLINE, THE DEVICE ANSWERS — with the same shape, from the books it
      // already holds. A device that cannot answer falls through to the
      // server, whose failure stays an error (never a page of zeros).
      const fromDevice = await readDashboardKpisFromDevice()
      if (fromDevice) return fromDevice
      // «Today» starts at this device's midnight, not the server's (UTC):
      // a sale at 01:00 in Tehran was counted as yesterday's (BUG-087).
      // Read inside the query — it runs only in the browser.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const { data } = await apiClient.get('/analytics/dashboard', { params: tz ? { tz } : {} })
      return data
    },
    enabled: authReady && enabled,
    ...DASHBOARD_LIVE,
    // ⚠️ React Query PAUSES an offline query by default: the device branch
    // above never ran and the dashboard froze on its last server numbers.
    networkMode: 'always',
  })
}

// ✅ گیت شده با authReady
// ✅ FIX: AI insights از ترکیب چند منبع ساخته می‌شود (فاکتورها،
// مشتریان، موجودی)، پس همان سه جدول را subscribe می‌کنیم.
export function useAIInsights(options: DashboardReadOptions = {}) {
  const authReady = useAuthReady()
  const enabled = options.enabled !== false

  const insightsKey = dashboardKeys.insights() as unknown as string[]
  useRealtime({ table: 'invoices', queryKey: insightsKey, enabled })
  useRealtime({ table: 'customers', queryKey: insightsKey, enabled })
  useRealtime({ table: 'products', queryKey: insightsKey, enabled })

  return useQuery({
    queryKey: dashboardKeys.insights(),
    queryFn: async (): Promise<AIInsight[]> => {
      const { data } = await apiClient.get('/ai/insights')
      return asList<AIInsight>(data)
    },
    enabled: authReady && enabled,
    ...DASHBOARD_LIVE,
  })
}

// ✅ گیت شده با authReady
// ✅ FIX: چارت فروش فقط به invoices وابسته است.
export function useDashboardSales(
  params?: DashboardSalesParams,
  options: DashboardReadOptions = {},
) {
  const authReady = useAuthReady()
  const enabled = options.enabled !== false

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
    enabled,
  })

  return useQuery({
    queryKey: dashboardKeys.sales(queryParams),
    queryFn: async (): Promise<SalesChartData> => {
      // ⚠️ OFFLINE: THE DEVICE'S OWN SALES — the only place the number of
      // sales still waiting to be confirmed is known (D10).
      const fromDevice = await readDashboardSalesFromDevice(
        String(queryParams.startDate),
        String(queryParams.endDate),
      )
      if (fromDevice) return fromDevice

      const response = await apiClient.get('/analytics/sales', {
        params: queryParams,
      })

      // ✅ حالت ۱: response.data.chartData (فرمت جدید Backend)
      if (response.data?.chartData && Array.isArray(response.data.chartData)) {
        const data: SalesDataPoint[] = response.data.chartData.map(mapToSalesDataPoint)
        const total =
          response.data.totalRevenue ?? data.reduce((sum: number, d) => sum + d.value, 0)
        const average = data.length > 0 ? total / data.length : 0
        const series = fillDailyGaps(
          data,
          String(queryParams.startDate),
          String(queryParams.endDate),
        )
        return { data: series, chartData: series, total, average }
      }

      // ✅ حالت ۲: response.data.data (فرمت قبلی)
      if (response.data?.data && Array.isArray(response.data.data)) {
        const data: SalesDataPoint[] = response.data.data.map(mapToSalesDataPoint)
        const total = response.data.total ?? data.reduce((sum: number, d) => sum + d.value, 0)
        const average = response.data.average ?? (data.length > 0 ? total / data.length : 0)
        const series = fillDailyGaps(
          data,
          String(queryParams.startDate),
          String(queryParams.endDate),
        )
        return { data: series, chartData: series, total, average }
      }

      // ✅ حالت ۳: response.data خودش آرایه است
      if (Array.isArray(response.data)) {
        const data: SalesDataPoint[] = response.data.map(mapToSalesDataPoint)
        const total = data.reduce((sum: number, d) => sum + d.value, 0)
        const average = data.length > 0 ? total / data.length : 0
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
    enabled: authReady && enabled,
    ...DASHBOARD_LIVE,
    // ⚠️ React Query PAUSES an offline query by default: the device branch
    // above never ran and the dashboard froze on its last server numbers.
    networkMode: 'always',
  })
}
