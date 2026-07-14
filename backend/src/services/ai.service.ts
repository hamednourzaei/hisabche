// ============================================
// backend/src/services/ai.service.ts — Optimized v2.0
// ============================================

import { supabase } from '../db'
import { AIQuery, AIInsight } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

export class AIService {
  // ─── Process Query ───
  async processQuery(userId: string, query: AIQuery) {
    const { question } = query
    const lowerQuestion = question.toLowerCase()

    if (lowerQuestion.includes('فروش') || lowerQuestion.includes('sale') || lowerQuestion.includes('درآمد')) {
      return this.handleSalesQuery(userId)
    }
    if (lowerQuestion.includes('موجودی') || lowerQuestion.includes('stock') || lowerQuestion.includes('کمبود')) {
      return this.handleInventoryQuery(userId)
    }
    if (lowerQuestion.includes('مشتری') || lowerQuestion.includes('customer') || lowerQuestion.includes('بدهکار')) {
      return this.handleCustomerQuery(userId)
    }
    if (lowerQuestion.includes('سود') || lowerQuestion.includes('profit') || lowerQuestion.includes('زیان')) {
      return this.handleFinancialQuery(userId)
    }

    return this.handleGeneralQuery(userId, question)
  }

  // ─── Sales Query — بهینه‌شده با Promise.all ───
  private async handleSalesQuery(userId: string) {
    const today = new Date().toISOString().split('T')[0]
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // ✅ دو کوئری همزمان
    const [todayResult, monthResult] = await Promise.all([
      supabase.from('invoices').select('total, status').eq('user_id', userId).gte('date', today),
      supabase.from('invoices').select('total').eq('user_id', userId).gte('date', firstOfMonth).eq('status', 'paid'),
    ])

    const todayInvoices = todayResult.data || []
    const monthInvoices = monthResult.data || []

    const todayTotal = todayInvoices.reduce((s: number, i: any) => s + Number(i.total), 0)
    const todayPaid = todayInvoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total), 0)
    const monthTotal = monthInvoices.reduce((s: number, i: any) => s + Number(i.total), 0)

    return {
      answer: `فروش امروز: ${todayTotal.toLocaleString()} افغانی (${todayPaid.toLocaleString()} پرداخت شده). فروش این ماه: ${monthTotal.toLocaleString()} افغانی.`,
      confidence: 0.95,
      sources: [{ type: 'invoices', description: 'فاکتورهای امروز و ماه جاری' }],
      suggestions: ['مشاهده گزارش فروش کامل', 'مقایسه با ماه گذشته', 'بهترین محصولات فروش'],
      data: { todayTotal, todayPaid, monthTotal, todayInvoicesCount: todayInvoices.length },
    }
  }

  // ─── Inventory Query ───
  private async handleInventoryQuery(userId: string) {
    // ✅ فقط ستون‌های ضروری
    const { data: products } = await supabase
      .from('products')
      .select('name, quantity, min_stock_level')
      .eq('user_id', userId)
      .eq('is_active', true)

    if (!products || products.length === 0) {
      return {
        answer: 'هیچ محصول فعالی یافت نشد.',
        confidence: 1,
        sources: [],
        suggestions: ['افزودن محصول جدید'],
        data: { totalProducts: 0 },
      }
    }

    const lowStock = products.filter((p: any) => Number(p.quantity) <= Number(p.min_stock_level))
    const outOfStock = products.filter((p: any) => Number(p.quantity) === 0)

    let answer = `تعداد کل محصولات: ${products.length}. `
    if (lowStock.length > 0) {
      const names = lowStock.map((p: any) => p.name).join('، ')
      answer += `⚠️ ${lowStock.length} محصول با موجودی کم: ${names}. `
    }
    if (outOfStock.length > 0) {
      const names = outOfStock.map((p: any) => p.name).join('، ')
      answer += `❌ ${outOfStock.length} محصول تمام شده: ${names}. `
    }
    if (lowStock.length === 0 && outOfStock.length === 0) {
      answer += '✅ همه محصولات موجودی کافی دارند.'
    }

    return {
      answer,
      confidence: 0.9,
      sources: [{ type: 'products', description: 'لیست محصولات فعال' }],
      suggestions: lowStock.length > 0 ? ['ثبت سفارش خرید', 'مشاهده گزارش موجودی'] : ['مشاهده گزارش موجودی'],
      data: { totalProducts: products.length, lowStockCount: lowStock.length, outOfStockCount: outOfStock.length },
    }
  }

  // ─── Customer Query — بهینه‌شده با Promise.all ───
  private async handleCustomerQuery(userId: string) {
    // ✅ دو کوئری همزمان
    const [customersResult, unpaidResult] = await Promise.all([
      supabase.from('customers').select('full_name, opening_balance').eq('user_id', userId).eq('is_active', true),
      supabase.from('invoices').select('total, paid_amount').eq('user_id', userId).neq('status', 'paid'),
    ])

    const customers = customersResult.data || []
    const unpaidInvoices = unpaidResult.data || []

    const totalCustomers = customers.length
    const totalUnpaid = unpaidInvoices.reduce((s: number, i: any) => s + Number(i.total) - Number(i.paid_amount), 0)

    const topDebtors = customers
      .filter((c: any) => Number(c.opening_balance) > 0)
      .sort((a: any, b: any) => Number(b.opening_balance) - Number(a.opening_balance))
      .slice(0, 5)

    let answer = `تعداد مشتریان فعال: ${totalCustomers}. `
    if (totalUnpaid > 0) {
      answer += `مجموع مطالبات پرداخت‌نشده: ${totalUnpaid.toLocaleString()} افغانی. `
    }
    if (topDebtors.length > 0) {
      const names = topDebtors.map((c: any) => `${c.full_name} (${Number(c.opening_balance).toLocaleString()})`).join('، ')
      answer += `بیشترین بدهکاران: ${names}.`
    }

    return {
      answer,
      confidence: 0.9,
      sources: [{ type: 'customers', description: 'مشتریان و فاکتورهای باز' }],
      suggestions: ['مشاهده لیست بدهکاران', 'ارسال یادآوری پرداخت'],
      data: { totalCustomers, totalUnpaid, topDebtorsCount: topDebtors.length },
    }
  }

  // ─── Financial Query ───
  private async handleFinancialQuery(userId: string) {
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // ✅ فقط debit و credit
    const { data: entries } = await supabase
      .from('ledger_entries')
      .select('debit, credit')
      .eq('user_id', userId)
      .gte('entry_date', firstOfMonth)

    const totalRevenue = entries?.reduce((s: number, e: any) => s + Number(e.credit), 0) || 0
    const totalExpenses = entries?.reduce((s: number, e: any) => s + Number(e.debit), 0) || 0
    const netProfit = totalRevenue - totalExpenses

    const statusEmoji = netProfit >= 0 ? '🟢' : '🔴'
    const statusText = netProfit >= 0 ? 'سود' : 'زیان'

    return {
      answer: `${statusEmoji} ${statusText} این ماه: ${Math.abs(netProfit).toLocaleString()} افغانی. درآمد: ${totalRevenue.toLocaleString()}، هزینه: ${totalExpenses.toLocaleString()}.`,
      confidence: 0.85,
      sources: [{ type: 'ledger_entries', description: 'ثبت‌های حسابداری ماه جاری' }],
      suggestions: ['مشاهده صورت سود و زیان', 'مشاهده ترازنامه', 'گزارش گردش نقدی'],
      data: { totalRevenue, totalExpenses, netProfit },
    }
  }

  // ─── General Query ───
  private async handleGeneralQuery(userId: string, question: string) {
    return {
      answer: `من می‌توانم درباره فروش، موجودی، مشتریان و وضعیت مالی کمک کنم. لطفاً سوال خود را دقیق‌تر بپرسید.`,
      confidence: 0.5,
      sources: [],
      suggestions: ['فروش امروز چقدر بود؟', 'چه محصولاتی موجودی کم دارند؟', 'وضعیت سود این ماه'],
      data: {},
    }
  }

  // ─── Get Insights — بهینه‌شده با Promise.all ───
  async getInsights(userId: string): Promise<AIInsight[]> {
    // ✅ سه کوئری همزمان
    const [productsResult, unpaidResult] = await Promise.all([
      supabase.from('products').select('name, quantity, min_stock_level').eq('user_id', userId).eq('is_active', true),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId).neq('status', 'paid').neq('status', 'cancelled'),
    ])

    const insights: AIInsight[] = []

    // بررسی موجودی کم
    const products = productsResult.data || []
    const lowStock = products.filter((p: any) => Number(p.quantity) <= Number(p.min_stock_level))
    if (lowStock.length > 0) {
      insights.push({
        type: 'warning',
        title: 'هشدار کمبود موجودی',
        description: `${lowStock.length} محصول به حداقل موجودی رسیده‌اند.`,
        action: '/warehouse',
        actionLabel: 'مشاهده موجودی',
        metric: lowStock.length,
        metricLabel: 'محصول',
      })
    }

    // بررسی فاکتورهای پرداخت‌نشده
    const unpaidCount = unpaidResult.count || 0
    if (unpaidCount > 0) {
      insights.push({
        type: 'info',
        title: 'فاکتورهای در انتظار پرداخت',
        description: `${unpaidCount} فاکتور هنوز پرداخت نشده‌اند.`,
        action: '/invoices',
        actionLabel: 'مشاهده فاکتورها',
        metric: unpaidCount,
        metricLabel: 'فاکتور',
      })
    }

    // Tip روز
    insights.push({
      type: 'tip',
      title: 'نکته روز',
      description: 'می‌توانید با ثبت هزینه‌ها در بخش حسابداری، گزارش سود و زیان دقیق‌تری داشته باشید.',
      action: '/accounting',
      actionLabel: 'رفتن به حسابداری',
    })

    return insights
  }
}