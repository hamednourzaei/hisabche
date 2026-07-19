// ============================================
// backend/src/services/accounting.service.ts — Optimized v2.3
// FIXED: TypeScript iterable error, type safety
// ============================================

import { supabase } from '../db'
import { 
  CreateAccount, 
  UpdateAccount, 
  CreateJournalEntry,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'
import { memoryCache } from '../utils/pagination'

// ✅ Column Selection Constants
const ACCOUNT_LIST_COLUMNS = 'id, code, name, type, parent_id, is_active, created_at'
const ACCOUNT_MINIMAL_COLUMNS = 'id, code, name, type'

const JOURNAL_ENTRY_LIST_COLUMNS = 'id, date, description, reference, created_at'
const JOURNAL_LINE_LIST_COLUMNS = 'id, account_id, debit, credit'

// ✅ Types
interface TrialBalanceAccount {
  accountId: string
  accountCode: string
  accountName: string
  accountType: string
  debit: number
  credit: number
  balance: number
}

export class AccountingService {
  
  // ─── Cache Keys ───────────────────────────────────────────
  private getAccountsCacheKey(userId: string) {
    return `accounts:${userId}`
  }

  private getTrialBalanceCacheKey(userId: string, date: string) {
    return `trial_balance:${userId}:${date}`
  }

  private getBalanceSheetCacheKey(userId: string, date: string) {
    return `balance_sheet:${userId}:${date}`
  }

  private getIncomeStatementCacheKey(userId: string, fromDate: string, toDate: string) {
    return `income_statement:${userId}:${fromDate}:${toDate}`
  }

  // ─── Account Management ──────────────────────────────────
  async listAccounts(userId: string) {
    const cacheKey = this.getAccountsCacheKey(userId)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('accounts')
      .select(ACCOUNT_LIST_COLUMNS)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('code')

    if (error) throw new DatabaseError('Failed to fetch accounts', error)
    
    const result = data || []
    await memoryCache.set(cacheKey, result, 300) // 5 دقیقه
    return result
  }

  async createAccount(userId: string, data: CreateAccount) {
    const { data: account, error } = await supabase
      .from('accounts')
      .insert({
        code: data.code,
        name: data.name,
        type: data.type,
        parent_id: data.parentId || null,
        is_active: data.isActive !== false,
        user_id: userId,
      })
      .select(ACCOUNT_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to create account', error)
    
    await memoryCache.invalidate(this.getAccountsCacheKey(userId))
    
    return account
  }

  async updateAccount(userId: string, id: string, data: UpdateAccount) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.code !== undefined) updates.code = data.code
    if (data.name !== undefined) updates.name = data.name
    if (data.type !== undefined) updates.type = data.type
    if (data.parentId !== undefined) updates.parent_id = data.parentId
    if (data.isActive !== undefined) updates.is_active = data.isActive

    const { data: account, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(ACCOUNT_LIST_COLUMNS)
      .single()

    if (error) throw new DatabaseError('Failed to update account', error)
    
    await memoryCache.invalidate(this.getAccountsCacheKey(userId))
    
    return account
  }

  // ─── Journal Entries ─────────────────────────────────────
  async listJournalEntries(userId: string) {
    const cacheKey = `journal_entries:${userId}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        ${JOURNAL_ENTRY_LIST_COLUMNS},
        lines:journal_lines(${JOURNAL_LINE_LIST_COLUMNS})
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(50)

    if (error) throw new DatabaseError('Failed to fetch journal entries', error)
    
    const result = data || []
    await memoryCache.set(cacheKey, result, 60) // 1 دقیقه
    return result
  }

  async createJournalEntry(userId: string, data: CreateJournalEntry) {
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new DatabaseError('Journal entry is not balanced')
    }

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        date: data.date,
        description: data.description || '',
        reference: data.reference || '',
        user_id: userId,
      })
      .select('id, date, description, reference')
      .single()

    if (entryError || !entry) {
      throw new DatabaseError('Failed to create journal entry', entryError)
    }

    const lines = data.lines.map(line => ({
      journal_id: entry.id,
      account_id: line.accountId,
      debit: line.debit,
      credit: line.credit,
      user_id: userId,
    }))

    const { error: linesError } = await supabase.from('journal_lines').insert(lines)

    if (linesError) {
      await supabase.from('journal_entries').delete().eq('id', entry.id)
      throw new DatabaseError('Failed to create journal lines', linesError)
    }

    await memoryCache.invalidate(`journal_entries:${userId}`)
    await memoryCache.invalidate(`trial_balance:${userId}`)

    return this.getJournalEntry(entry.id, userId)
  }

  async getJournalEntry(id: string, userId: string) {
    const cacheKey = `journal_entry:${userId}:${id}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        id, date, description, reference, created_at, updated_at,
        lines:journal_lines(
          id, debit, credit,
          account:accounts(${ACCOUNT_MINIMAL_COLUMNS})
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      throw new DatabaseError('Journal entry not found', error)
    }
    
    await memoryCache.set(cacheKey, data, 300) // 5 دقیقه
    return data
  }

  // ─── Financial Reports ────────────────────────────────────

  async getTrialBalance(userId: string, date: string): Promise<TrialBalanceAccount[]> {
    const cacheKey = this.getTrialBalanceCacheKey(userId, date)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached as TrialBalanceAccount[]

    const { data, error } = await supabase
      .from('journal_lines')
      .select(`
        debit, credit, account_id,
        account:accounts!inner(id, code, name, type)
      `)
      .eq('user_id', userId)
      .eq('account.user_id', userId)
      .lte('created_at', date)

    if (error) {
      console.error('Trial balance error:', error)
      throw new DatabaseError('Failed to fetch trial balance', error)
    }

    // ✅ FIX: همیشه یک آرایه برگردان
    if (!data || data.length === 0) {
      const emptyResult: TrialBalanceAccount[] = []
      await memoryCache.set(cacheKey, emptyResult, 60)
      return emptyResult
    }

    const accountMap = new Map<string, TrialBalanceAccount>()

    for (const line of data) {
      const acc = (line as any).account
      if (!acc) continue

      const key = acc.id
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountType: acc.type,
          debit: 0,
          credit: 0,
          balance: 0,
        })
      }

      const entry = accountMap.get(key)!
      entry.debit += Number(line.debit) || 0
      entry.credit += Number(line.credit) || 0
    }

    const result: TrialBalanceAccount[] = Array.from(accountMap.values()).map(a => ({
      ...a,
      balance: a.debit - a.credit,
    }))

    await memoryCache.set(cacheKey, result, 120) // 2 دقیقه
    return result
  }

  async getBalanceSheet(userId: string, date: string) {
    const cacheKey = this.getBalanceSheetCacheKey(userId, date)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ FIX: اطمینان از اینکه trialBalance یک آرایه است
    const trialBalance = await this.getTrialBalance(userId, date)
    const accounts = Array.isArray(trialBalance) ? trialBalance : []

    let assetsTotal = 0, liabilitiesTotal = 0, equityTotal = 0, revenueTotal = 0, expensesTotal = 0
    const assets: any[] = [], liabilities: any[] = [], equity: any[] = [], revenue: any[] = [], expenses: any[] = []

    for (const account of accounts) {
      switch (account.accountType) {
        case 'asset':
          if (account.balance > 0) {
            assets.push(account)
            assetsTotal += account.balance
          }
          break
        case 'liability':
          if (account.balance > 0) {
            liabilities.push(account)
            liabilitiesTotal += account.balance
          }
          break
        case 'equity':
          if (account.balance > 0) {
            equity.push(account)
            equityTotal += account.balance
          }
          break
        case 'revenue':
          if (account.balance < 0) {
            revenue.push(account)
            revenueTotal += Math.abs(account.balance)
          }
          break
        case 'expense':
          if (account.balance > 0) {
            expenses.push(account)
            expensesTotal += account.balance
          }
          break
      }
    }

    const result = {
      assets: { total: assetsTotal, details: assets },
      liabilities: { total: liabilitiesTotal, details: liabilities },
      equity: { total: equityTotal, details: equity },
      revenue: { total: revenueTotal, details: revenue },
      expenses: { total: expensesTotal, details: expenses },
    }

    await memoryCache.set(cacheKey, result, 120) // 2 دقیقه
    return result
  }

  async getIncomeStatement(userId: string, fromDate: string, toDate: string) {
    const cacheKey = this.getIncomeStatementCacheKey(userId, fromDate, toDate)
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    // ✅ FIX: اطمینان از اینکه trialBalance یک آرایه است
    const trialBalance = await this.getTrialBalance(userId, toDate)
    const accounts = Array.isArray(trialBalance) ? trialBalance : []

    let revenue = 0, expenses = 0
    for (const account of accounts) {
      if (account.accountType === 'revenue') {
        revenue += Math.abs(account.balance)
      } else if (account.accountType === 'expense') {
        expenses += account.balance
      }
    }

    const result = {
      revenue: Math.round(revenue * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      totalRevenue: Math.round(revenue * 100) / 100,
      totalExpenses: Math.round(expenses * 100) / 100,
      netIncome: Math.round((revenue - expenses) * 100) / 100,
    }

    await memoryCache.set(cacheKey, result, 120) // 2 دقیقه
    return result
  }

  // ─── Cash Flow Report ────────────────────────────────────
  async getCashFlow(userId: string, startDate: string, endDate: string) {
    const cacheKey = `cash_flow:${userId}:${startDate}:${endDate}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('type, amount, description, date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) throw new DatabaseError('Failed to fetch cash flow', error)

    const operating = { inflow: 0, outflow: 0, items: [] as any[] }
    const investing = { inflow: 0, outflow: 0, items: [] as any[] }
    const financing = { inflow: 0, outflow: 0, items: [] as any[] }

    for (const tx of transactions || []) {
      const amount = Number(tx.amount)
      const type = tx.type
      const item = { description: tx.description || type, amount, date: tx.date }

      if (['sale', 'receipt'].includes(type)) {
        operating.inflow += amount
        operating.items.push({ ...item, type: 'inflow' })
      } else if (['purchase', 'payment'].includes(type)) {
        operating.outflow += amount
        operating.items.push({ ...item, type: 'outflow' })
      }
    }

    const netChange = operating.inflow - operating.outflow +
                      investing.inflow - investing.outflow +
                      financing.inflow - financing.outflow

    const result = {
      operating: {
        inflow: Math.round(operating.inflow * 100) / 100,
        outflow: Math.round(operating.outflow * 100) / 100,
        net: Math.round((operating.inflow - operating.outflow) * 100) / 100,
        items: operating.items,
      },
      investing: {
        inflow: Math.round(investing.inflow * 100) / 100,
        outflow: Math.round(investing.outflow * 100) / 100,
        net: Math.round((investing.inflow - investing.outflow) * 100) / 100,
        items: investing.items,
      },
      financing: {
        inflow: Math.round(financing.inflow * 100) / 100,
        outflow: Math.round(financing.outflow * 100) / 100,
        net: Math.round((financing.inflow - financing.outflow) * 100) / 100,
        items: financing.items,
      },
      netChange: Math.round(netChange * 100) / 100,
      period: { startDate, endDate },
    }

    await memoryCache.set(cacheKey, result, 300) // 5 دقیقه
    return result
  }

  // ─── Customer Debt Report ──────────────────────────────────
  async getCustomerDebtReport(userId: string) {
    const cacheKey = `customer_debt:${userId}`
    
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached

    const [customersResult, invoicesResult] = await Promise.all([
      supabase
        .from('customers')
        .select('id, full_name, opening_balance')
        .eq('user_id', userId)
        .eq('is_active', true),
      supabase
        .from('invoices')
        .select('customer_id, total, paid_amount')
        .eq('user_id', userId)
        .neq('status', 'paid')
    ])

    const customers = customersResult.data || []
    const invoices = invoicesResult.data || []

    const debtMap: Record<string, { name: string; balance: number; totalInvoices: number }> = {}
    
    for (const c of customers) {
      debtMap[c.id] = {
        name: c.full_name,
        balance: Number(c.opening_balance) || 0,
        totalInvoices: 0,
      }
    }

    for (const inv of invoices) {
      const customerId = inv.customer_id
      if (customerId && debtMap[customerId]) {
        debtMap[customerId].balance += Number(inv.total) - Number(inv.paid_amount)
        debtMap[customerId].totalInvoices++
      }
    }

    const debtors = Object.values(debtMap)
      .filter(d => d.balance > 0)
      .sort((a, b) => b.balance - a.balance)

    const creditors = Object.values(debtMap)
      .filter(d => d.balance < 0)
      .sort((a, b) => a.balance - b.balance)

    const result = {
      debtors,
      creditors,
      totalDebt: Math.round(debtors.reduce((s, d) => s + d.balance, 0) * 100) / 100,
      totalCredit: Math.round(Math.abs(creditors.reduce((s, d) => s + d.balance, 0)) * 100) / 100,
    }

    await memoryCache.set(cacheKey, result, 120) // 2 دقیقه
    return result
  }

  // ─── Invalidate Cache ─────────────────────────────────────
  async invalidateCache(userId: string) {
    await memoryCache.invalidate(this.getAccountsCacheKey(userId))
    await memoryCache.invalidate(`journal_entries:${userId}`)
    await memoryCache.invalidate(`trial_balance:${userId}`)
    await memoryCache.invalidate(`balance_sheet:${userId}`)
    await memoryCache.invalidate(`income_statement:${userId}`)
    await memoryCache.invalidate(`cash_flow:${userId}`)
    await memoryCache.invalidate(`customer_debt:${userId}`)
  }
}

export default AccountingService