// ============================================
// backend/src/services/analytics.service.ts
// ============================================

import { supabase } from '../db'
import { DateRange } from '@hisabche/validation'

export class AnalyticsService {
  // ─── Dashboard KPIs ───────────────────────────────────────
  async getDashboardKpis(userId: string) {
    const today = new Date().toISOString().split('T')[0]
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const lastMonthFirst = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString()
    const lastMonthLast = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString()

    console.log('🔍 getDashboardKpis - userId:', userId)
    console.log('🔍 getDashboardKpis - dates:', { today, firstOfMonth, lastMonthFirst, lastMonthLast })

    // Today sales
    const { data: todaySales } = await supabase
      .from('invoices')
      .select('total')
      .eq('user_id', userId)
      .gte('date', today)
      .eq('status', 'paid')

    console.log('🔍 getDashboardKpis - todaySales count:', todaySales?.length || 0)

    // Today invoices
    const { count: todayInvoices } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('date', today)

    console.log('🔍 getDashboardKpis - todayInvoices:', todayInvoices)

    // Monthly revenue
    const { data: monthlySales } = await supabase
      .from('invoices')
      .select('total')
      .eq('user_id', userId)
      .gte('date', firstOfMonth)
      .eq('status', 'paid')

    console.log('🔍 getDashboardKpis - monthlySales count:', monthlySales?.length || 0)

    // Last month revenue
    const { data: lastMonthSales } = await supabase
      .from('invoices')
      .select('total')
      .eq('user_id', userId)
      .gte('date', lastMonthFirst)
      .lte('date', lastMonthLast)
      .eq('status', 'paid')

    console.log('🔍 getDashboardKpis - lastMonthSales count:', lastMonthSales?.length || 0)

    // Pending payments
    const { data: pendingPayments } = await supabase
      .from('invoices')
      .select('total, paid_amount')
      .eq('user_id', userId)
      .neq('status', 'paid')

    console.log('🔍 getDashboardKpis - pendingPayments count:', pendingPayments?.length || 0)

    // Active customers
    const { count: activeCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true)

    console.log('🔍 getDashboardKpis - activeCustomers:', activeCustomers)

    // Low stock
    const { data: allProducts } = await supabase
      .from('products')
      .select('quantity, min_stock_level')
      .eq('user_id', userId)
      .eq('is_active', true)

    console.log('🔍 getDashboardKpis - allProducts count:', allProducts?.length || 0)

    const lowStock = allProducts
      ? allProducts.filter(p => Number(p.quantity) <= Number(p.min_stock_level)).length
      : 0

    const todayRevenue = todaySales?.reduce((sum: number, i: any) => sum + Number(i.total), 0) || 0
    const monthlyRevenue = monthlySales?.reduce((sum: number, i: any) => sum + Number(i.total), 0) || 0
    const lastMonthRevenue = lastMonthSales?.reduce((sum: number, i: any) => sum + Number(i.total), 0) || 0
    const pendingTotal = pendingPayments?.reduce((sum: number, i: any) => sum + Number(i.total) - Number(i.paid_amount), 0) || 0

    const monthlyGrowth = lastMonthRevenue > 0
      ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0

    return {
      todaySales: Math.round(todayRevenue * 100) / 100,
      todayInvoices: todayInvoices || 0,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      monthlyGrowth: Math.round(monthlyGrowth * 100) / 100,
      pendingPayments: Math.round(pendingTotal * 100) / 100,
      activeCustomers: activeCustomers || 0,
      lowStockAlerts: lowStock,
    }
  }

  // ─── Sales Summary ────────────────────────────────────────
  async getSalesSummary(userId: string, dateRange: DateRange) {
    console.log('========================================')
    console.log('🔍🔍🔍 getSalesSummary CALLED 🔍🔍🔍')
    console.log('========================================')
    console.log('📌 userId:', userId)
    console.log('📌 userId type:', typeof userId)
    console.log('📌 userId length:', userId?.length)
    console.log('📌 dateRange:', JSON.stringify(dateRange, null, 2))
    console.log('📌 startDate:', dateRange.startDate)
    console.log('📌 endDate:', dateRange.endDate)
    console.log('========================================')

    const { startDate, endDate } = dateRange

    // ✅ 1. چک کن userId خالی نباشه
    if (!userId) {
      console.error('❌ userId is empty or undefined!')
      return this.emptySalesSummary()
    }

    // ✅ 2. چک کن dateRange درست باشه
    if (!startDate || !endDate) {
      console.error('❌ startDate or endDate is empty!')
      return this.emptySalesSummary()
    }

    console.log('🔍 Executing Supabase query...')
    console.log('🔍 Query: invoices')
    console.log('🔍 Filters: user_id=', userId)
    console.log('🔍 date >=', startDate)
    console.log('🔍 date <=', endDate)

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('id, total, paid_amount, status, currency, date, customer_id')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    console.log('🔍 Supabase query result:')
    console.log('  - invoices count:', invoices?.length || 0)
    console.log('  - error:', error ? JSON.stringify(error) : '✅ none')

    if (error) {
      console.error('❌❌❌ Supabase ERROR in getSalesSummary:', JSON.stringify(error, null, 2))
      return this.emptySalesSummary()
    }

    if (!invoices || invoices.length === 0) {
      console.log('⚠️⚠️⚠️ NO invoices found for user:', userId)
      console.log('⚠️ Check if user has invoices in Supabase')
      return this.emptySalesSummary()
    }

    console.log('✅ Found', invoices.length, 'invoices!')
    console.log('📋 First invoice:', JSON.stringify(invoices[0], null, 2))
    console.log('📋 All invoice IDs:', invoices.map((i: any) => i.id).join(', '))

    // ... ادامه کد
    const totalRevenue = invoices.reduce((sum: number, i: any) => sum + Number(i.total), 0)
    const totalPaid = invoices.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + Number(i.total), 0)
    const totalUnpaid = totalRevenue - totalPaid

    console.log('📊 Calculated:')
    console.log('  - totalRevenue:', totalRevenue)
    console.log('  - totalPaid:', totalPaid)
    console.log('  - totalUnpaid:', totalUnpaid)
    console.log('  - invoices count:', invoices.length)

    const byCurrency: Record<string, number> = {}
    for (const inv of invoices) {
      const currency = (inv as any).currency || 'AFN'
      byCurrency[currency] = (byCurrency[currency] || 0) + Number((inv as any).total)
    }

    const byPeriodMap: Record<string, { revenue: number; count: number }> = {}
    for (const inv of invoices) {
      const month = ((inv as any).date as string).slice(0, 7)
      if (!byPeriodMap[month]) byPeriodMap[month] = { revenue: 0, count: 0 }
      byPeriodMap[month].revenue += Number((inv as any).total)
      byPeriodMap[month].count++
    }

    // Top products
    const invoiceIds = invoices.map((i: any) => i.id)
    let topProducts: any[] = []
    if (invoiceIds.length > 0) {
      console.log('🔍 Fetching top products for invoice IDs:', invoiceIds.length)
      const { data: items } = await supabase
        .from('invoice_items')
        .select('product_id, product_name, quantity, total_price')
        .eq('user_id', userId)
        .in('invoice_id', invoiceIds)
        .order('total_price', { ascending: false })
        .limit(10)
      topProducts = items || []
      console.log('🔍 topProducts count:', topProducts.length)
    }

    // Top customers
    const customerIds = invoices.map((i: any) => i.customer_id).filter(Boolean)
    let customerNames: Record<string, string> = {}
    if (customerIds.length > 0) {
      console.log('🔍 Fetching customer names for IDs:', customerIds.length)
      const { data: customers } = await supabase
        .from('customers')
        .select('id, full_name')
        .in('id', customerIds)
      if (customers) {
        customerNames = customers.reduce((acc: Record<string, string>, c: any) => {
          acc[c.id] = c.full_name
          return acc
        }, {})
      }
    }

    const customerMap: Record<string, { id: string; name: string; revenue: number; count: number }> = {}
    for (const inv of invoices) {
      const cid = (inv as any).customer_id
      if (cid) {
        if (!customerMap[cid]) {
          customerMap[cid] = { id: cid, name: customerNames[cid] || '', revenue: 0, count: 0 }
        }
        customerMap[cid].revenue += Number((inv as any).total)
        customerMap[cid].count++
      }
    }

    // ✅ Build chart data for frontend (daily sales)
    const chartData = invoices.reduce((acc: any[], inv: any) => {
      const date = (inv.date as string).split('T')[0]
      const existing = acc.find(d => d.label === date)
      if (existing) {
        existing.value += Number(inv.total)
      } else {
        acc.push({ label: date, value: Number(inv.total), date })
      }
      return acc
    }, [])

    console.log('📊 chartData length:', chartData.length)
    console.log('✅ getSalesSummary SUCCESS! Returning data...')
    console.log('========================================')

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalInvoices: invoices.length,
      averageInvoiceValue: Math.round((totalRevenue / invoices.length) * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalUnpaid: Math.round(totalUnpaid * 100) / 100,
      byCurrency,
      byPeriod: Object.entries(byPeriodMap).map(([period, val]) => ({
        period,
        revenue: Math.round(val.revenue * 100) / 100,
        count: val.count,
      })),
      topProducts: topProducts.map((p: any) => ({
        productId: p.product_id,
        productName: p.product_name || '',
        quantity: Number(p.quantity || 0),
        revenue: Math.round(Number(p.total_price || 0) * 100) / 100,
      })),
      topCustomers: Object.values(customerMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(c => ({
          customerId: c.id,
          customerName: c.name,
          revenue: Math.round(c.revenue * 100) / 100,
          invoiceCount: c.count,
        })),
      chartData,
    }
  }

  // ─── Inventory Summary ────────────────────────────────────
  async getInventorySummary(userId: string) {
    console.log('🔍 getInventorySummary - userId:', userId)
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)

    console.log('🔍 getInventorySummary - products count:', products?.length || 0)

    if (!products || products.length === 0) {
      return this.emptyInventorySummary()
    }

    const totalStockValue = products.reduce((sum: number, p: any) => sum + Number(p.quantity) * Number(p.buy_price), 0)
    const lowStockProducts = products.filter((p: any) => Number(p.quantity) <= Number(p.min_stock_level)).length
    const outOfStockProducts = products.filter((p: any) => Number(p.quantity) === 0).length

    const byCategoryMap: Record<string, { count: number; totalValue: number }> = {}
    for (const p of products) {
      const cat = (p as any).category || 'general'
      if (!byCategoryMap[cat]) byCategoryMap[cat] = { count: 0, totalValue: 0 }
      byCategoryMap[cat].count++
      byCategoryMap[cat].totalValue += Number((p as any).quantity) * Number((p as any).buy_price)
    }

    const { data: topMovements } = await supabase
      .from('stock_movements')
      .select('product_id, type, quantity, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    return {
      totalProducts: products.length,
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      lowStockProducts,
      outOfStockProducts,
      byCategory: Object.entries(byCategoryMap).map(([category, val]) => ({
        category,
        count: val.count,
        totalValue: Math.round(val.totalValue * 100) / 100,
      })),
      topMovements: (topMovements || []).map((m: any) => ({
        productId: m.product_id,
        productName: '',
        movementType: m.type,
        quantity: Number(m.quantity),
        date: m.created_at as string,
      })),
    }
  }

  // ─── Financial Summary ────────────────────────────────────
  async getFinancialSummary(userId: string, dateRange: DateRange) {
    console.log('🔍 getFinancialSummary - userId:', userId)
    console.log('🔍 getFinancialSummary - dateRange:', dateRange)

    const { startDate, endDate } = dateRange

    if (!userId || !startDate || !endDate) {
      console.error('❌ getFinancialSummary - missing params!')
      return this.emptyFinancialSummary()
    }

    const { data: entries } = await supabase
      .from('ledger_entries')
      .select('debit, credit, account_id, entry_date')
      .eq('user_id', userId)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)

    console.log('🔍 getFinancialSummary - entries count:', entries?.length || 0)

    if (!entries || entries.length === 0) {
      return this.emptyFinancialSummary()
    }

    const totalRevenue = entries.reduce((sum: number, e: any) => sum + Number(e.credit), 0)
    const totalExpenses = entries.reduce((sum: number, e: any) => sum + Number(e.debit), 0)
    const netProfit = totalRevenue - totalExpenses

    const byMonthMap: Record<string, { inflow: number; outflow: number }> = {}
    for (const e of entries) {
      const month = ((e as any).entry_date as string).slice(0, 7)
      if (!byMonthMap[month]) byMonthMap[month] = { inflow: 0, outflow: 0 }
      byMonthMap[month].inflow += Number((e as any).credit)
      byMonthMap[month].outflow += Number((e as any).debit)
    }

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      accountsReceivable: 0,
      accountsPayable: 0,
      cashFlow: Object.entries(byMonthMap).map(([period, val]) => ({
        period,
        inflow: Math.round(val.inflow * 100) / 100,
        outflow: Math.round(val.outflow * 100) / 100,
        net: Math.round((val.inflow - val.outflow) * 100) / 100,
      })),
      byAccountType: {},
    }
  }

  // ─── Helpers ──────────────────────────────────────────────
  private emptySalesSummary() {
    return {
      totalRevenue: 0,
      totalInvoices: 0,
      averageInvoiceValue: 0,
      totalPaid: 0,
      totalUnpaid: 0,
      byCurrency: {},
      byPeriod: [],
      topProducts: [],
      topCustomers: [],
      chartData: [],
    }
  }

  private emptyInventorySummary() {
    return {
      totalProducts: 0,
      totalStockValue: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      byCategory: [],
      topMovements: [],
    }
  }

  private emptyFinancialSummary() {
    return {
      totalRevenue: 0,
      totalExpenses: 0,
      netProfit: 0,
      accountsReceivable: 0,
      accountsPayable: 0,
      cashFlow: [],
      byAccountType: {},
    }
  }
}