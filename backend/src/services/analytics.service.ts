// ============================================
// backend/src/services/analytics.service.ts
// Hisabche v2.3 — FIXED TypeScript Errors
// ============================================

import { supabase } from '../db';
import { DateRange } from '@hisabche/validation';
import { CacheKeys, withCacheKey } from '../utils/cache';
import { memoryCache } from '../utils/pagination';

export class AnalyticsService {
  // ─── Dashboard KPIs — OPTIMIZED ───
  async getDashboardKpis(userId: string) {
    const cacheKey = CacheKeys.dashboard(userId);

    return withCacheKey(cacheKey, 60_000, async () => {
      const today = new Date().toISOString().split('T')[0];
      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const lastMonthFirst = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString();
      const lastMonthLast = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString();

      // ✅ اصلاح: یک کوئری با همه داده‌ها به جای ۷ کوئری
      const { data: allInvoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('total, status, date, paid_amount, customer_id')
        .eq('user_id', userId);

      if (invoicesError) {
        return this.emptyDashboardKpis();
      }

      let todaySales = 0;
      let todayInvoices = 0;
      let monthlyRevenue = 0;
      let lastMonthRevenue = 0;
      let pendingTotal = 0;

      for (const invoice of allInvoices || []) {
        const date = invoice.date?.split('T')[0] || '';
        const total = Number(invoice.total) || 0;
        const paidAmount = Number(invoice.paid_amount) || 0;

        // امروز
        if (date === today) {
          todayInvoices++;
          if (invoice.status === 'paid') {
            todaySales += total;
          }
        }

        // این ماه
        if (date >= firstOfMonth) {
          monthlyRevenue += total;
        }

        // ماه قبل
        if (date >= lastMonthFirst && date <= lastMonthLast) {
          lastMonthRevenue += total;
        }

        // معوقات
        if (invoice.status !== 'paid') {
          pendingTotal += (total - paidAmount);
        }
      }

      // ✅ اصلاح: یک کوئری برای customers
      const { count: activeCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      // ✅ اصلاح: یک کوئری برای products
      const { data: products } = await supabase
        .from('products')
        .select('quantity, min_stock_level')
        .eq('user_id', userId)
        .eq('is_active', true);

      const lowStock = (products || [])
        .filter(p => Number(p.quantity) <= Number(p.min_stock_level))
        .length;

      const monthlyGrowth = lastMonthRevenue > 0
        ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

      return {
        todaySales: Math.round(todaySales * 100) / 100,
        todayInvoices: todayInvoices,
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
        monthlyGrowth: Math.round(monthlyGrowth * 100) / 100,
        pendingPayments: Math.round(pendingTotal * 100) / 100,
        activeCustomers: activeCustomers || 0,
        lowStockAlerts: lowStock,
      };
    });
  }

  // ─── Sales Summary — OPTIMIZED & FIXED ───
  async getSalesSummary(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;
    if (!userId || !startDate || !endDate) return this.emptySalesSummary();

    const cacheKey = CacheKeys.salesSummary(userId, startDate, endDate);

    return withCacheKey(cacheKey, 120_000, async () => {
      // ✅ اصلاح: استفاده از customers به عنوان آرایه
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          total,
          paid_amount,
          status,
          currency,
          date,
          customer_id,
          customers!left (
            id,
            full_name
          )
        `)
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error || !invoices || invoices.length === 0) {
        return this.emptySalesSummary();
      }

      let totalRevenue = 0;
      let totalPaid = 0;
      const byCurrency: Record<string, number> = {};
      const byPeriodMap: Record<string, { revenue: number; count: number }> = {};
      const customerMap: Record<string, { id: string; name: string; revenue: number; count: number }> = {};

      for (const inv of invoices) {
        const total = Number(inv.total) || 0;
        const currency = inv.currency || 'AFN';
        const month = inv.date?.slice(0, 7) || '';

        totalRevenue += total;
        if (inv.status === 'paid') totalPaid += total;

        byCurrency[currency] = (byCurrency[currency] || 0) + total;

        if (!byPeriodMap[month]) {
          byPeriodMap[month] = { revenue: 0, count: 0 };
        }
        byPeriodMap[month].revenue += total;
        byPeriodMap[month].count++;

        const customerId = inv.customer_id;
        if (customerId) {
          // ✅ FIX: customers is an array, access first element
          const customersArray = inv.customers as any[] | null;
          const customerName = customersArray?.[0]?.full_name || '';

          if (!customerMap[customerId]) {
            customerMap[customerId] = {
              id: customerId,
              name: customerName,
              revenue: 0,
              count: 0,
            };
          }
          customerMap[customerId].revenue += total;
          customerMap[customerId].count++;
        }
      }

      // ✅ اصلاح: یک کوئری برای top products
      const invoiceIds = invoices.map(i => i.id);
      const { data: items } = await supabase
        .from('invoice_items')
        .select('product_id, product_name, total_price')
        .in('invoice_id', invoiceIds)
        .order('total_price', { ascending: false })
        .limit(10);

      // فقط ۱۴ روز اخیر برای Chart
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const chartData = invoices
        .filter(inv => new Date(inv.date) >= fourteenDaysAgo)
        .reduce((acc: any[], inv) => {
          const date = inv.date?.split('T')[0] || '';
          const existing = acc.find(d => d.label === date);
          if (existing) {
            existing.value += Number(inv.total) || 0;
          } else {
            acc.push({ label: date, value: Number(inv.total) || 0, date });
          }
          return acc;
        }, []);

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalInvoices: invoices.length,
        averageInvoiceValue: Math.round((totalRevenue / invoices.length) * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalUnpaid: Math.round((totalRevenue - totalPaid) * 100) / 100,
        byCurrency,
        byPeriod: Object.entries(byPeriodMap).map(([period, val]) => ({
          period,
          revenue: Math.round(val.revenue * 100) / 100,
          count: val.count,
        })),
        topProducts: (items || []).map(p => ({
          productId: p.product_id,
          productName: p.product_name || '',
          quantity: 0,
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
      };
    });
  }

  // ─── Inventory Summary ───
  async getInventorySummary(userId: string) {
    return withCacheKey(CacheKeys.products(userId), 120_000, async () => {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, quantity, buy_price, min_stock_level, category')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!products || products.length === 0) {
        return this.emptyInventorySummary();
      }

      const totalStockValue = products.reduce(
        (sum: number, p: any) => sum + Number(p.quantity) * Number(p.buy_price),
        0
      );

      const lowStockProducts = products.filter(
        (p: any) => Number(p.quantity) <= Number(p.min_stock_level)
      ).length;

      const outOfStockProducts = products.filter(
        (p: any) => Number(p.quantity) === 0
      ).length;

      const byCategoryMap: Record<string, { count: number; totalValue: number }> = {};
      for (const p of products) {
        const cat = (p as any).category || 'general';
        if (!byCategoryMap[cat]) {
          byCategoryMap[cat] = { count: 0, totalValue: 0 };
        }
        byCategoryMap[cat].count++;
        byCategoryMap[cat].totalValue += Number((p as any).quantity) * Number((p as any).buy_price);
      }

      const { data: topMovements } = await supabase
        .from('stock_movements')
        .select('product_id, type, quantity, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

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
      };
    });
  }

  // ─── Financial Summary ───
  async getFinancialSummary(userId: string, dateRange: DateRange) {
    const { startDate, endDate } = dateRange;
    if (!userId || !startDate || !endDate) return this.emptyFinancialSummary();

    const { data: entries } = await supabase
      .from('ledger_entries_view')
      .select('debit, credit, account_id, entry_date')
      .eq('user_id', userId)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (!entries || entries.length === 0) return this.emptyFinancialSummary();

    const totalRevenue = entries.reduce((sum: number, e: any) => sum + Number(e.credit), 0);
    const totalExpenses = entries.reduce((sum: number, e: any) => sum + Number(e.debit), 0);
    const netProfit = totalRevenue - totalExpenses;

    const byMonthMap: Record<string, { inflow: number; outflow: number }> = {};
    for (const e of entries) {
      const month = ((e as any).entry_date as string).slice(0, 7);
      if (!byMonthMap[month]) {
        byMonthMap[month] = { inflow: 0, outflow: 0 };
      }
      byMonthMap[month].inflow += Number((e as any).credit);
      byMonthMap[month].outflow += Number((e as any).debit);
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
    };
  }

  // ─── Invalidate Cache ───
  invalidateCache(userId: string) {
    memoryCache.invalidate(`dashboard:${userId}`);
    memoryCache.invalidate(`sales:${userId}`);
    memoryCache.invalidate(`products:${userId}`);
    memoryCache.invalidate(`insights:${userId}`);
  }

  // ─── Empty Objects ───
  private emptyDashboardKpis() {
    return {
      todaySales: 0,
      todayInvoices: 0,
      monthlyRevenue: 0,
      monthlyGrowth: 0,
      pendingPayments: 0,
      activeCustomers: 0,
      lowStockAlerts: 0,
    };
  }

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
    };
  }

  private emptyInventorySummary() {
    return {
      totalProducts: 0,
      totalStockValue: 0,
      lowStockProducts: 0,
      outOfStockProducts: 0,
      byCategory: [],
      topMovements: [],
    };
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
    };
  }
}

export default AnalyticsService;