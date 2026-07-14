// ============================================
// backend/src/services/analytics.service.ts — Optimized v2.0 + Cache + Reduced Response
// ============================================

import { supabase } from '../db'
import { DateRange } from '@hisabche/validation'
import { CacheKeys, withCacheKey } from '../utils/cache'
import { memoryCache } from '../utils/pagination'

export class AnalyticsService {
  // ─── Dashboard KPIs — با Cache ───
  async getDashboardKpis(userId: string) {
    const cacheKey = CacheKeys.dashboard(userId)
    
    return withCacheKey(cacheKey, 60_000, async () => {
      const today = new Date().toISOString().split('T')[0]
      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const lastMonthFirst = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()
      const lastMonthLast = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString()

      const [
        todaySalesResult, todayInvoicesResult, monthlySalesResult,
        lastMonthSalesResult, pendingPaymentsResult,
        activeCustomersResult, allProductsResult,
      ] = await Promise.all([
        supabase.from('invoices').select('total').eq('user_id', userId).gte('date', today).eq('status', 'paid'),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('date', today),
        supabase.from('invoices').select('total').eq('user_id', userId).gte('date', firstOfMonth),
        supabase.from('invoices').select('total').eq('user_id', userId).gte('date', lastMonthFirst).lte('date', lastMonthLast),
        supabase.from('invoices').select('total, paid_amount').eq('user_id', userId).neq('status', 'paid'),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true),
        supabase.from('products').select('quantity, min_stock_level').eq('user_id', userId).eq('is_active', true),
      ])

      const todaySales = todaySalesResult.data || []
      const monthlySales = monthlySalesResult.data || []
      const lastMonthSales = lastMonthSalesResult.data || []
      const pendingPayments = pendingPaymentsResult.data || []
      const allProducts = allProductsResult.data || []

      const lowStock = allProducts.filter((p: any) => Number(p.quantity) <= Number(p.min_stock_level)).length
      const todayRevenue = todaySales.reduce((sum: number, i: any) => sum + Number(i.total), 0)
      const monthlyRevenue = monthlySales.reduce((sum: number, i: any) => sum + Number(i.total), 0)
      const lastMonthRevenue = lastMonthSales.reduce((sum: number, i: any) => sum + Number(i.total), 0)
      const pendingTotal = pendingPayments.reduce((sum: number, i: any) => sum + Number(i.total) - Number(i.paid_amount), 0)
      const monthlyGrowth = lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0

      return {
        todaySales: Math.round(todayRevenue * 100) / 100,
        todayInvoices: todayInvoicesResult.count || 0,
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
        monthlyGrowth: Math.round(monthlyGrowth * 100) / 100,
        pendingPayments: Math.round(pendingTotal * 100) / 100,
        activeCustomers: activeCustomersResult.count || 0,
        lowStockAlerts: lowStock,
      }
    })
  }

  // ─── Sales Summary — با Cache + Reduced Response Size ───
  async getSalesSummary(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange
    if (!userId || !startDate || !endDate) return this.emptySalesSummary()

    const cacheKey = CacheKeys.salesSummary(userId, startDate, endDate)

    return withCacheKey(cacheKey, 120_000, async () => {
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select('id, total, paid_amount, status, currency, date, customer_id')
        .eq('user_id', userId).gte('date', startDate).lte('date', endDate)
        .order('date', { ascending: false })

      if (error || !invoices || invoices.length === 0) return this.emptySalesSummary()

      const totalRevenue = invoices.reduce((sum: number, i: any) => sum + Number(i.total), 0)
      const totalPaid = invoices.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + Number(i.total), 0)
      const totalUnpaid = totalRevenue - totalPaid

      const invoiceIds = invoices.map((i: any) => i.id)
      const customerIds = [...new Set(invoices.map((i: any) => i.customer_id).filter(Boolean))]

      const [itemsResult, customersResult] = await Promise.all([
        invoiceIds.length > 0
          ? supabase.from('invoice_items').select('product_id, product_name, total_price').in('invoice_id', invoiceIds).order('total_price', { ascending: false }).limit(10)
          : Promise.resolve({ data: [] }),
        customerIds.length > 0
          ? supabase.from('customers').select('id, full_name').in('id', customerIds as string[])
          : Promise.resolve({ data: [] }),
      ])

      const topProducts = itemsResult.data || []
      const customers = customersResult.data || []
      const customerNames: Record<string, string> = {}
      for (const c of customers) customerNames[c.id] = c.full_name

      const byCurrency: Record<string, number> = {}
      const byPeriodMap: Record<string, { revenue: number; count: number }> = {}
      const customerMap: Record<string, { id: string; name: string; revenue: number; count: number }> = {}

      for (const inv of invoices) {
        const currency = (inv as any).currency || 'AFN'
        byCurrency[currency] = (byCurrency[currency] || 0) + Number((inv as any).total)
        const month = ((inv as any).date as string).slice(0, 7)
        if (!byPeriodMap[month]) byPeriodMap[month] = { revenue: 0, count: 0 }
        byPeriodMap[month].revenue += Number((inv as any).total)
        byPeriodMap[month].count++
        const cid = (inv as any).customer_id
        if (cid) {
          if (!customerMap[cid]) customerMap[cid] = { id: cid, name: customerNames[cid] || '', revenue: 0, count: 0 }
          customerMap[cid].revenue += Number((inv as any).total)
          customerMap[cid].count++
        }
      }

      // ✅ FIX: فقط ۱۴ روز آخر برای کاهش response size (۳۰ → ۱۴)
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      
      const chartData = invoices
        .filter((inv: any) => new Date(inv.date) >= fourteenDaysAgo)
        .reduce((acc: any[], inv: any) => {
          const date = (inv.date as string).split('T')[0]
          const existing = acc.find(d => d.label === date)
          if (existing) { existing.value += Number(inv.total) }
          else { acc.push({ label: date, value: Number(inv.total), date }) }
          return acc
        }, [])

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100, totalInvoices: invoices.length,
        averageInvoiceValue: Math.round((totalRevenue / invoices.length) * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100, totalUnpaid: Math.round(totalUnpaid * 100) / 100,
        byCurrency,
        byPeriod: Object.entries(byPeriodMap).map(([period, val]) => ({ period, revenue: Math.round(val.revenue * 100) / 100, count: val.count })),
        topProducts: topProducts.map((p: any) => ({ productId: p.product_id, productName: p.product_name || '', quantity: Number(p.quantity || 0), revenue: Math.round(Number(p.total_price || 0) * 100) / 100 })),
        topCustomers: Object.values(customerMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map(c => ({ customerId: c.id, customerName: c.name, revenue: Math.round(c.revenue * 100) / 100, invoiceCount: c.count })),
        chartData,
      }
    })
  }

  async getInventorySummary(userId: string) {
    return withCacheKey(CacheKeys.products(userId), 120_000, async () => {
      const { data: products } = await supabase
        .from('products').select('id, name, quantity, buy_price, min_stock_level, category')
        .eq('user_id', userId).eq('is_active', true)
      if (!products || products.length === 0) return this.emptyInventorySummary()
      const totalStockValue = products.reduce((sum: number, p: any) => sum + Number(p.quantity) * Number(p.buy_price), 0)
      const lowStockProducts = products.filter((p: any) => Number(p.quantity) <= Number(p.min_stock_level)).length
      const outOfStockProducts = products.filter((p: any) => Number(p.quantity) === 0).length
      const byCategoryMap: Record<string, { count: number; totalValue: number }> = {}
      for (const p of products) {
        const cat = (p as any).category || 'general'
        if (!byCategoryMap[cat]) byCategoryMap[cat] = { count: 0, totalValue: 0 }
        byCategoryMap[cat].count++; byCategoryMap[cat].totalValue += Number((p as any).quantity) * Number((p as any).buy_price)
      }
      const { data: topMovements } = await supabase
        .from('stock_movements').select('product_id, type, quantity, created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(10)
      return {
        totalProducts: products.length, totalStockValue: Math.round(totalStockValue * 100) / 100,
        lowStockProducts, outOfStockProducts,
        byCategory: Object.entries(byCategoryMap).map(([category, val]) => ({ category, count: val.count, totalValue: Math.round(val.totalValue * 100) / 100 })),
        topMovements: (topMovements || []).map((m: any) => ({ productId: m.product_id, productName: '', movementType: m.type, quantity: Number(m.quantity), date: m.created_at as string })),
      }
    })
  }

  async getFinancialSummary(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange
    if (!userId || !startDate || !endDate) return this.emptyFinancialSummary()
    const { data: entries } = await supabase
      .from('ledger_entries_view')
      .select('debit, credit, account_id, entry_date')
      .eq('user_id', userId).gte('entry_date', startDate).lte('entry_date', endDate)
    if (!entries || entries.length === 0) return this.emptyFinancialSummary()
    const totalRevenue = entries.reduce((sum: number, e: any) => sum + Number(e.credit), 0)
    const totalExpenses = entries.reduce((sum: number, e: any) => sum + Number(e.debit), 0)
    const netProfit = totalRevenue - totalExpenses
    const byMonthMap: Record<string, { inflow: number; outflow: number }> = {}
    for (const e of entries) {
      const month = ((e as any).entry_date as string).slice(0, 7)
      if (!byMonthMap[month]) byMonthMap[month] = { inflow: 0, outflow: 0 }
      byMonthMap[month].inflow += Number((e as any).credit); byMonthMap[month].outflow += Number((e as any).debit)
    }
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100, totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100, accountsReceivable: 0, accountsPayable: 0,
      cashFlow: Object.entries(byMonthMap).map(([period, val]) => ({ period, inflow: Math.round(val.inflow * 100) / 100, outflow: Math.round(val.outflow * 100) / 100, net: Math.round((val.inflow - val.outflow) * 100) / 100 })),
      byAccountType: {},
    }
  }

  invalidateCache(userId: string) {
    memoryCache.invalidate(`dashboard:${userId}`)
    memoryCache.invalidate(`sales:${userId}`)
    memoryCache.invalidate(`products:${userId}`)
    memoryCache.invalidate(`insights:${userId}`)
  }

  private emptySalesSummary() { return { totalRevenue: 0, totalInvoices: 0, averageInvoiceValue: 0, totalPaid: 0, totalUnpaid: 0, byCurrency: {}, byPeriod: [], topProducts: [], topCustomers: [], chartData: [] } }
  private emptyInventorySummary() { return { totalProducts: 0, totalStockValue: 0, lowStockProducts: 0, outOfStockProducts: 0, byCategory: [], topMovements: [] } }
  private emptyFinancialSummary() { return { totalRevenue: 0, totalExpenses: 0, netProfit: 0, accountsReceivable: 0, accountsPayable: 0, cashFlow: [], byAccountType: {} } }
}