// ============================================
// backend/src/services/accounting.service.ts — Optimized v2.0
// ============================================

import { supabase } from '../db'
import { 
  CreateAccount, 
  UpdateAccount, 
  CreateJournalEntry,
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

// ✅ Column Selection Constants
const ACCOUNT_LIST_COLUMNS = 'id, code, name, type, parent_id, is_active, created_at'
const ACCOUNT_MINIMAL_COLUMNS = 'id, code, name, type'

const JOURNAL_ENTRY_LIST_COLUMNS = 'id, date, description, reference, created_at'
const JOURNAL_LINE_LIST_COLUMNS = 'id, account_id, debit, credit'

export class AccountingService {
  // ─── Account Management ──────────────────────────────────
  async listAccounts(userId: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select(ACCOUNT_LIST_COLUMNS) // ✅ فقط ۷ ستون
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('code')

    if (error) throw new DatabaseError('Failed to fetch accounts', error)
    return data || []
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
      .select(ACCOUNT_LIST_COLUMNS) // ✅
      .single()

    if (error) throw new DatabaseError('Failed to create account', error)
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
      .select(ACCOUNT_LIST_COLUMNS) // ✅
      .single()

    if (error) throw new DatabaseError('Failed to update account', error)
    return account
  }

  // ─── Journal Entries ─────────────────────────────────────
  async listJournalEntries(userId: string) {
    // ✅ فقط ستون‌های ضروری
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        ${JOURNAL_ENTRY_LIST_COLUMNS},
        lines:journal_lines(${JOURNAL_LINE_LIST_COLUMNS})
      `)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(50) // ✅ limit برای لیست

    if (error) throw new DatabaseError('Failed to fetch journal entries', error)
    return data || []
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

    return this.getJournalEntry(entry.id, userId)
  }

  async getJournalEntry(id: string, userId: string) {
    // ✅ فقط ستون‌های ضروری با رابطه حساب
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
    return data
  }

  // ──────────────────────────────────────────────
  // Financial Reports — بهینه‌شده
  // ──────────────────────────────────────────────

  async getTrialBalance(userId: string, date: string) {
    // ✅ یک کوئری با JOIN به جای دو کوئری جداگانه
    const { data, error } = await supabase
      .from('journal_lines')
      .select(`
        debit, credit, account_id,
        account:accounts!inner(id, code, name, type)
      `)
      .eq('user_id', userId)
      .eq('account.user_id', userId)

    if (error) {
      console.error('Trial balance error:', error)
      throw new DatabaseError('Failed to fetch trial balance', error)
    }

    if (!data || data.length === 0) return []

    // گروه‌بندی با Map
    const accountMap = new Map<string, {
      accountId: string
      accountCode: string
      accountName: string
      accountType: string
      debit: number
      credit: number
    }>()

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
        })
      }

      const entry = accountMap.get(key)!
      entry.debit += Number(line.debit) || 0
      entry.credit += Number(line.credit) || 0
    }

    return Array.from(accountMap.values()).map(a => ({
      ...a,
      balance: a.debit - a.credit,
    }))
  }

  async getBalanceSheet(userId: string, date: string) {
    const trialBalance = await this.getTrialBalance(userId, date)

    // ✅ یکبار iterate به جای ۵ بار filter + reduce
    let assetsTotal = 0, liabilitiesTotal = 0, equityTotal = 0, revenueTotal = 0, expensesTotal = 0
    const assets: any[] = [], liabilities: any[] = [], equity: any[] = [], revenue: any[] = [], expenses: any[] = []

    for (const account of trialBalance) {
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

    return {
      assets: { total: assetsTotal, details: assets },
      liabilities: { total: liabilitiesTotal, details: liabilities },
      equity: { total: equityTotal, details: equity },
      revenue: { total: revenueTotal, details: revenue },
      expenses: { total: expensesTotal, details: expenses },
    }
  }

  async getIncomeStatement(userId: string, fromDate: string, toDate: string) {
    const trialBalance = await this.getTrialBalance(userId, toDate)

    let revenue = 0, expenses = 0
    for (const account of trialBalance) {
      if (account.accountType === 'revenue') {
        revenue += Math.abs(account.balance)
      } else if (account.accountType === 'expense') {
        expenses += account.balance
      }
    }

    return {
      revenue,
      expenses,
      totalRevenue: revenue,
      totalExpenses: expenses,
      netIncome: revenue - expenses,
    }
  }
}