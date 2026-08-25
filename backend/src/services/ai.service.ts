// ============================================
// backend/src/services/ai.service.ts — Optimized v2.1
// FIXED: Count: estimated, Better query handling, Error fallback
// ============================================

import { supabase } from '../db'
import { AIQuery, AIInsight } from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { CacheKeys, withCacheKey } from '../utils/cache'
import type { TenancyContext } from './tenancy.service'

// ✅ Type for response
interface AIResponse {
  answer: string
  confidence: number
  sources: { type: string; description: string }[]
  suggestions: string[]
  data: Record<string, any>
}

export class AIService {
  // ─── Process Query ──────────────────────────────────────
  /**
   * The AI answers questions ABOUT the shared book, so every figure it quotes
   * must come from the authorized workspace. An unscoped handler here is a
   * particularly bad leak: it does not return rows, it returns a sentence
   * summarising another business's revenue.
   *
   * `ledger_entries` is not yet a workspace-scoped table, so the financial
   * and expense handlers still key on user_id and are marked below.
   */
  async processQuery(ctx: TenancyContext, query: AIQuery): Promise<AIResponse> {
    const { workspaceId, userId } = ctx
    const { question } = query
    const lowerQuestion = question.toLowerCase()

    try {
      // ✅ بهتر: تشخیص با کلمات کلیدی
      if (this.hasKeywords(lowerQuestion, ['فروش', 'sale', 'درآمد', 'revenue', 'فروخته'])) {
        return await this.handleSalesQuery(workspaceId)
      }
      if (
        this.hasKeywords(lowerQuestion, ['موجودی', 'stock', 'کمبود', 'انبار', 'warehouse', 'محصول'])
      ) {
        return await this.handleInventoryQuery(workspaceId)
      }
      if (this.hasKeywords(lowerQuestion, ['مشتری', 'customer', 'بدهکار', 'debtor', 'حساب'])) {
        return await this.handleCustomerQuery(workspaceId)
      }
      if (this.hasKeywords(lowerQuestion, ['سود', 'profit', 'زیان', 'loss', 'مالی', 'financial'])) {
        return await this.handleFinancialQuery(userId)
      }
      if (this.hasKeywords(lowerQuestion, ['هزینه', 'cost', 'expense', 'خرج'])) {
        return await this.handleExpenseQuery(userId)
      }

      return this.handleGeneralQuery(userId, question)
    } catch (error) {
      console.error('AI query error:', error)
      return {
        answer: 'متاسفانه در پردازش سوال شما خطایی رخ داد. لطفاً دوباره تلاش کنید.',
        confidence: 0,
        sources: [],
        suggestions: ['سوال خود را ساده‌تر بپرسید', 'از منوی راهنما استفاده کنید'],
        data: { error: true },
      }
    }
  }

  // ─── Helper: Check keywords ──────────────────────────────
  private hasKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword))
  }

  // ─── Sales Query ──────────────────────────────────────────
  private async handleSalesQuery(workspaceId: string): Promise<AIResponse> {
    const today = new Date().toISOString().split('T')[0]
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const firstOfLastMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() - 1,
      1,
    ).toISOString()

    // ✅ سه کوئری موازی
    const [todayResult, monthResult, lastMonthResult] = await Promise.all([
      supabase
        .from('invoices')
        .select('total, status')
        .eq('workspace_id', workspaceId)
        .gte('date', today),
      supabase
        .from('invoices')
        .select('total')
        .eq('workspace_id', workspaceId)
        .gte('date', firstOfMonth)
        .eq('status', 'paid'),
      supabase
        .from('invoices')
        .select('total')
        .eq('workspace_id', workspaceId)
        .gte('date', firstOfLastMonth)
        .lt('date', firstOfMonth)
        .eq('status', 'paid'),
    ])

    const todayInvoices = todayResult.data || []
    const monthInvoices = monthResult.data || []
    const lastMonthInvoices = lastMonthResult.data || []

    const todayTotal = todayInvoices.reduce((s: number, i: any) => s + Number(i.total), 0)
    const todayPaid = todayInvoices
      .filter((i: any) => i.status === 'paid')
      .reduce((s: number, i: any) => s + Number(i.total), 0)
    const monthTotal = monthInvoices.reduce((s: number, i: any) => s + Number(i.total), 0)
    const lastMonthTotal = lastMonthInvoices.reduce((s: number, i: any) => s + Number(i.total), 0)

    // ✅ محاسبه رشد
    const growth = lastMonthTotal > 0 ? ((monthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0
    const growthText =
      growth > 0
        ? `⬆️ ${growth.toFixed(1)}% رشد`
        : growth < 0
          ? `⬇️ ${Math.abs(growth).toFixed(1)}% کاهش`
          : 'بدون تغییر'

    let answer = `فروش امروز: ${todayTotal.toLocaleString()} افغانی (${todayPaid.toLocaleString()} پرداخت شده). `
    answer += `فروش این ماه: ${monthTotal.toLocaleString()} افغانی. `
    answer += `نسبت به ماه قبل: ${growthText}.`

    return {
      answer,
      confidence: 0.95,
      sources: [{ type: 'invoices', description: 'فاکتورهای امروز و ماه جاری' }],
      suggestions: ['مشاهده گزارش فروش کامل', 'مقایسه با ماه گذشته', 'بهترین محصولات فروش'],
      data: { todayTotal, todayPaid, monthTotal, lastMonthTotal, growth },
    }
  }

  // ─── Inventory Query ──────────────────────────────────────
  private async handleInventoryQuery(workspaceId: string): Promise<AIResponse> {
    // ✅ فقط ستون‌های ضروری
    const { data: products, error } = await supabase
      .from('products')
      .select('name, quantity, min_stock_level, category') // ✅ اضافه کردن category
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)

    if (error || !products || products.length === 0) {
      return {
        answer: 'هیچ محصول فعالی یافت نشد.',
        confidence: 1,
        sources: [],
        suggestions: ['افزودن محصول جدید', 'وارد کردن موجودی'],
        data: { totalProducts: 0 },
      }
    }

    const lowStock = products.filter((p: any) => Number(p.quantity) <= Number(p.min_stock_level))
    const outOfStock = products.filter((p: any) => Number(p.quantity) === 0)
    const totalQuantity = products.reduce((s: number, p: any) => s + Number(p.quantity), 0)

    let answer = `تعداد کل محصولات: ${products.length}. `
    answer += `مجموع موجودی: ${totalQuantity.toLocaleString()} عدد. `

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
      suggestions:
        lowStock.length > 0
          ? ['ثبت سفارش خرید', 'مشاهده گزارش موجودی']
          : ['مشاهده گزارش موجودی', 'بررسی محصولات جدید'],
      data: {
        totalProducts: products.length,
        totalQuantity,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
      },
    }
  }

  // ─── Customer Query ──────────────────────────────────────
  private async handleCustomerQuery(workspaceId: string): Promise<AIResponse> {
    // ✅ دو کوئری همزمان
    const [customersResult, unpaidResult] = await Promise.all([
      supabase
        .from('customers')
        .select('id, full_name, opening_balance, phone')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true),
      supabase
        .from('invoices')
        .select('customer_id, total, paid_amount')
        .eq('workspace_id', workspaceId)
        .neq('status', 'paid'),
    ])

    const customers = customersResult.data || []
    const unpaidInvoices = unpaidResult.data || []

    const totalCustomers = customers.length

    // ✅ محاسبه دقیق بدهی هر مشتری
    const debtMap: Record<string, number> = {}
    for (const inv of unpaidInvoices) {
      const customerId = inv.customer_id
      if (customerId) {
        debtMap[customerId] =
          (debtMap[customerId] || 0) + Number(inv.total) - Number(inv.paid_amount)
      }
    }

    const totalUnpaid = Object.values(debtMap).reduce((s, v) => s + v, 0)

    const topDebtors = customers
      .map((c: any) => ({
        ...c,
        totalDebt: debtMap[c.id] || 0,
        openingBalance: Number(c.opening_balance) || 0,
      }))
      .filter((c: any) => c.totalDebt > 0 || c.openingBalance > 0)
      .sort((a: any, b: any) => b.totalDebt + b.openingBalance - (a.totalDebt + a.openingBalance))
      .slice(0, 5)

    let answer = `تعداد مشتریان فعال: ${totalCustomers}. `
    if (totalUnpaid > 0) {
      answer += `مجموع مطالبات پرداخت‌نشده: ${totalUnpaid.toLocaleString()} افغانی. `
    }
    if (topDebtors.length > 0) {
      const names = topDebtors
        .map((c: any) => `${c.full_name} (${(c.totalDebt + c.openingBalance).toLocaleString()})`)
        .join('، ')
      answer += `بیشترین بدهکاران: ${names}.`
    } else {
      answer += '✅ هیچ مشتری بدهکاری وجود ندارد.'
    }

    return {
      answer,
      confidence: 0.9,
      sources: [{ type: 'customers', description: 'مشتریان و فاکتورهای باز' }],
      suggestions: ['مشاهده لیست بدهکاران', 'ارسال یادآوری پرداخت', 'گزارش مشتریان'],
      data: { totalCustomers, totalUnpaid, topDebtorsCount: topDebtors.length },
    }
  }

  // ─── Financial Query ──────────────────────────────────────
  private async handleFinancialQuery(userId: string): Promise<AIResponse> {
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const today = new Date().toISOString().split('T')[0]

    // ✅ دو کوئری موازی: ماه جاری و امروز
    const [monthResult, todayResult] = await Promise.all([
      supabase
        .from('ledger_entries')
        .select('debit, credit, entry_date')
        .eq('user_id', userId) // ledger_entries is not workspace-scoped yet
        .gte('entry_date', firstOfMonth),
      supabase
        .from('ledger_entries')
        .select('debit, credit')
        .eq('user_id', userId) // ledger_entries is not workspace-scoped yet
        .gte('entry_date', today),
    ])

    const monthEntries = monthResult.data || []
    const todayEntries = todayResult.data || []

    const totalRevenue = monthEntries.reduce((s: number, e: any) => s + Number(e.credit), 0)
    const totalExpenses = monthEntries.reduce((s: number, e: any) => s + Number(e.debit), 0)
    const netProfit = totalRevenue - totalExpenses

    const todayRevenue = todayEntries.reduce((s: number, e: any) => s + Number(e.credit), 0)
    const todayExpenses = todayEntries.reduce((s: number, e: any) => s + Number(e.debit), 0)

    const statusEmoji = netProfit >= 0 ? '🟢' : '🔴'
    const statusText = netProfit >= 0 ? 'سود' : 'زیان'

    let answer = `${statusEmoji} ${statusText} این ماه: ${Math.abs(netProfit).toLocaleString()} افغانی. `
    answer += `درآمد: ${totalRevenue.toLocaleString()}، هزینه: ${totalExpenses.toLocaleString()}. `
    answer += `درآمد امروز: ${todayRevenue.toLocaleString()}، هزینه امروز: ${todayExpenses.toLocaleString()}.`

    return {
      answer,
      confidence: 0.85,
      sources: [{ type: 'ledger_entries', description: 'ثبت‌های حسابداری ماه جاری' }],
      suggestions: [
        'مشاهده صورت سود و زیان',
        'مشاهده ترازنامه',
        'گزارش گردش نقدی',
        'مشاهده هزینه‌ها',
      ],
      data: { totalRevenue, totalExpenses, netProfit, todayRevenue, todayExpenses },
    }
  }

  // ─── Expense Query ──────────────────────────────────────
  private async handleExpenseQuery(userId: string): Promise<AIResponse> {
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const { data: expenses } = await supabase
      .from('ledger_entries')
      .select('debit, description, entry_date')
      .eq('user_id', userId) // ledger_entries is not workspace-scoped yet
      .gte('entry_date', firstOfMonth)
      .order('debit', { ascending: false })
      .limit(10)

    const totalExpenses = expenses?.reduce((s: number, e: any) => s + Number(e.debit), 0) || 0

    let answer = `مجموع هزینه‌های این ماه: ${totalExpenses.toLocaleString()} افغانی. `
    if (expenses && expenses.length > 0) {
      const topExpenses = expenses
        .slice(0, 5)
        .map((e: any) => `${e.description || 'بدون توضیح'}: ${Number(e.debit).toLocaleString()}`)
        .join('، ')
      answer += `بزرگترین هزینه‌ها: ${topExpenses}.`
    }

    return {
      answer,
      confidence: 0.85,
      sources: [{ type: 'ledger_entries', description: 'هزینه‌های ماه جاری' }],
      suggestions: ['مشاهده همه هزینه‌ها', 'دسته‌بندی هزینه‌ها', 'گزارش هزینه'],
      data: { totalExpenses, topExpenses: expenses?.slice(0, 5) || [] },
    }
  }

  // ─── General Query ──────────────────────────────────────
  private handleGeneralQuery(userId: string, question: string): AIResponse {
    return {
      answer: `من می‌توانم درباره فروش، موجودی، مشتریان، هزینه‌ها و وضعیت مالی کمک کنم. لطفاً سوال خود را دقیق‌تر بپرسید.

سوالات پیشنهادی:
• فروش امروز چقدر بود؟
• چه محصولاتی موجودی کم دارند؟
• وضعیت سود این ماه چگونه است؟
• بدهکاران اصلی چه کسانی هستند؟
• هزینه‌های این ماه چقدر است؟`,
      confidence: 0.5,
      sources: [],
      suggestions: [
        'فروش امروز چقدر بود؟',
        'چه محصولاتی موجودی کم دارند؟',
        'وضعیت سود این ماه',
        'مشتریان بدهکار',
        'هزینه‌های این ماه',
      ],
      data: {},
    }
  }

  // ─── Get Insights ──────────────────────────────────────
  async getInsights(ctx: TenancyContext): Promise<AIInsight[]> {
    const { workspaceId } = ctx
    return withCacheKey(CacheKeys.insights(workspaceId), 120_000, async () => {
      // ✅ count: "estimated" به جای "exact"
      const [productsResult, unpaidResult, weekResult] = await Promise.all([
        supabase
          .from('products')
          .select('name, quantity, min_stock_level, buy_price')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true),
        // ✅ FIX: قبلاً هر فاکتوری که status آن دقیقاً 'paid' نبود «پرداخت‌نشده»
        // شمرده می‌شد؛ ولی وضعیت واقعی فاکتورهای پرداخت‌شده 'completed' است،
        // برای همین همه‌ی فاکتورها به‌اشتباه در انتظار پرداخت گزارش می‌شدند.
        // ملاک درست، مبلغ باقی‌مانده است نه رشته‌ی status.
        supabase
          .from('invoices')
          .select('total, paid_amount, status')
          .eq('workspace_id', workspaceId)
          .neq('status', 'cancelled'),
        supabase
          .from('invoices')
          .select('total')
          .eq('workspace_id', workspaceId)
          // ✅ FIX: فیلتر status === 'paid' حذف شد — وضعیت واقعی فاکتورهای
          // پرداخت‌شده 'completed' است، پس این کوئری همیشه خالی برمی‌گشت و
          // پیشنهاد «فروش هفته گذشته» هرگز نمایش داده نمی‌شد.
          .neq('status', 'cancelled')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ])

      const insights: AIInsight[] = []

      // ✅ هشدار کمبود موجودی
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

      // ✅ فاکتورهای پرداخت‌نشده
      const unpaidCount = (unpaidResult.data || []).filter(
        (inv: any) => (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0) > 0,
      ).length
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

      // ✅ فروش هفته گذشته
      const weekSales = (weekResult.data || []).reduce(
        (s: number, i: any) => s + Number(i.total),
        0,
      )
      if (weekSales > 0) {
        insights.push({
          type: 'tip',
          title: 'فروش هفته گذشته',
          description: `فروش هفته گذشته: ${weekSales.toLocaleString()} افغانی.`,
          action: '/dashboard',
          actionLabel: 'مشاهده داشبورد',
          metric: weekSales,
          metricLabel: 'افغانی',
        })
      }

      // ✅ قواعد بیشتر — همگی از همان داده‌ی از قبل واکشی‌شده ساخته می‌شوند،
      // پس هیچ کوئری اضافه‌ای به دیتابیس اضافه نمی‌کنند.
      const invoiceRows: any[] = unpaidResult.data || []

      // مجموع مبلغ معوق (نه فقط تعداد فاکتور)
      const outstanding = invoiceRows.reduce(
        (sum: number, inv: any) =>
          sum + Math.max(0, (Number(inv.total) || 0) - (Number(inv.paid_amount) || 0)),
        0,
      )
      if (outstanding > 0) {
        insights.push({
          type: 'warning',
          title: 'مبلغ معوق مشتریان',
          description: `${outstanding.toLocaleString()} افغانی هنوز از مشتریان دریافت نشده است.`,
          action: '/customers',
          actionLabel: 'پیگیری بدهکاران',
          metric: outstanding,
          metricLabel: 'افغانی',
        })
      }

      // محصولات تمام‌شده — متفاوت از هشدار «موجودی کم»
      const outOfStock = products.filter((p: any) => Number(p.quantity) <= 0)
      if (outOfStock.length > 0) {
        const names = outOfStock
          .slice(0, 3)
          .map((p: any) => p.name)
          .join('، ')
        insights.push({
          type: 'warning',
          title: 'محصولات تمام‌شده',
          description: `${outOfStock.length} محصول موجودی صفر دارند: ${names}.`,
          action: '/warehouse',
          actionLabel: 'ثبت خرید',
          metric: outOfStock.length,
          metricLabel: 'محصول',
        })
      }

      // سرمایه‌ی خوابیده در انبار
      const stockValue = products.reduce(
        (sum: number, p: any) => sum + Number(p.quantity || 0) * Number(p.buy_price || 0),
        0,
      )
      if (stockValue > 0) {
        insights.push({
          type: 'info',
          title: 'ارزش موجودی انبار',
          description: `${stockValue.toLocaleString()} افغانی سرمایه در انبار شماست.`,
          action: '/warehouse',
          actionLabel: 'مشاهده انبار',
          metric: stockValue,
          metricLabel: 'افغانی',
        })
      }

      // میانگین مبلغ فاکتور
      if (invoiceRows.length > 0) {
        const avg =
          invoiceRows.reduce((sum: number, i: any) => sum + (Number(i.total) || 0), 0) /
          invoiceRows.length
        insights.push({
          type: 'tip',
          title: 'میانگین مبلغ فاکتور',
          description: `هر فاکتور به‌طور میانگین ${Math.round(avg).toLocaleString()} افغانی است.`,
          action: '/invoices',
          actionLabel: 'مشاهده فاکتورها',
          metric: Math.round(avg),
          metricLabel: 'افغانی',
        })
      }

      // ✅ نکته روز (همیشه آخرین باشد)
      insights.push({
        type: 'tip',
        title: '💡 نکته روز',
        description:
          'می‌توانید با ثبت هزینه‌ها در بخش حسابداری، گزارش سود و زیان دقیق‌تری داشته باشید.',
        action: '/accounting',
        actionLabel: 'رفتن به حسابداری',
      })

      return insights
    })
  }
}

export default AIService
