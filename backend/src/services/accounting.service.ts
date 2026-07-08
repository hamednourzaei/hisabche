// ============================================
// backend/src/services/accounting.service.ts
// ============================================

import { supabase } from '../db'
import { 
  CreateAccount, 
  UpdateAccount, 
  CreateJournalEntry,
  JournalLine
} from '@hisabche/validation'
import { DatabaseError } from '../errors/database.error'

export class AccountingService {
  // ─── Account Management ──────────────────────────────────
  async listAccounts(userId: string) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
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
      .select()
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
      .select()
      .single()

    if (error) throw new DatabaseError('Failed to update account', error)
    return account
  }

  // ─── Journal Entries ─────────────────────────────────────
  async listJournalEntries(userId: string) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_lines(*)
      `)
      .eq('user_id', userId)
      .order('date', { ascending: false })

    if (error) throw new DatabaseError('Failed to fetch journal entries', error)
    return data || []
  }

  async createJournalEntry(userId: string, data: CreateJournalEntry) {
    // ۱. اعتبارسنجی تعادل (Total Debit = Total Credit)
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new DatabaseError('Journal entry is not balanced')
    }

    // ۲. ایجاد سند
    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .insert({
        date: data.date,
        description: data.description || '',
        reference: data.reference || '',
        user_id: userId,
      })
      .select()
      .single()

    if (entryError || !entry) {
      throw new DatabaseError('Failed to create journal entry', entryError)
    }

    // ۳. ایجاد خطوط ثبت
    const lines = data.lines.map(line => ({
      journal_id: entry.id,
      account_id: line.accountId,
      debit: line.debit,
      credit: line.credit,
      user_id: userId,
    }))

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(lines)

    if (linesError) {
      // Rollback: حذف سند
      await supabase.from('journal_entries').delete().eq('id', entry.id)
      throw new DatabaseError('Failed to create journal lines', linesError)
    }

    return this.getJournalEntry(entry.id, userId)
  }

  async getJournalEntry(id: string, userId: string) {
    const { data, error } = await supabase
      .from('journal_entries')
      .select(`
        *,
        lines:journal_lines(
          *,
          account:accounts(*)
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
  // ✅ NEW — Get Trial Balance
  // ──────────────────────────────────────────────
  async getTrialBalance(userId: string, date: string) {
    const { data: lines, error } = await supabase
      .from('journal_lines')
      .select(`
        debit,
        credit,
        account_id,
        journal_entries!inner (
          date
        )
      `)
      .eq('user_id', userId)
      .lte('journal_entries.date', date)

    if (error) {
      console.error('Trial balance error:', error)
      throw new DatabaseError('Failed to fetch trial balance', error)
    }

    if (!lines || lines.length === 0) {
      return []
    }

    const accountIds = [...new Set(lines.map(l => l.account_id))]
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, code, name, type')
      .in('id', accountIds)
      .eq('user_id', userId)

    if (accountsError) {
      console.error('Accounts fetch error:', accountsError)
      throw new DatabaseError('Failed to fetch accounts', accountsError)
    }

    const accountMap = new Map()
    for (const acc of accounts || []) {
      accountMap.set(acc.id, {
        accountId: acc.id,
        accountCode: acc.code,
        accountName: acc.name,
        accountType: acc.type,
        debit: 0,
        credit: 0,
      })
    }

    for (const line of lines) {
      const entry = accountMap.get(line.account_id)
      if (entry) {
        entry.debit += (line.debit || 0)
        entry.credit += (line.credit || 0)
      }
    }

    const result = Array.from(accountMap.values())
    return result.map(a => ({
      ...a,
      balance: a.debit - a.credit,
    }))
  }

  // ──────────────────────────────────────────────
  // ✅ FIXED — Balance Sheet
  // ──────────────────────────────────────────────
  async getBalanceSheet(userId: string, date: string) {
    const trialBalance = await this.getTrialBalance(userId, date)

    const assets = trialBalance.filter((a: any) => 
      a.accountType === 'asset' && a.balance > 0
    )
    const liabilities = trialBalance.filter((a: any) => 
      a.accountType === 'liability' && a.balance > 0
    )
    const equity = trialBalance.filter((a: any) => 
      a.accountType === 'equity' && a.balance > 0
    )
    const revenue = trialBalance.filter((a: any) => 
      a.accountType === 'revenue' && a.balance < 0
    )
    const expenses = trialBalance.filter((a: any) => 
      a.accountType === 'expense' && a.balance > 0
    )

    return {
      assets: {
        total: assets.reduce((sum: number, a: any) => sum + a.balance, 0),
        details: assets,
      },
      liabilities: {
        total: liabilities.reduce((sum: number, a: any) => sum + a.balance, 0),
        details: liabilities,
      },
      equity: {
        total: equity.reduce((sum: number, a: any) => sum + a.balance, 0),
        details: equity,
      },
      revenue: {
        total: revenue.reduce((sum: number, a: any) => sum + Math.abs(a.balance), 0),
        details: revenue,
      },
      expenses: {
        total: expenses.reduce((sum: number, a: any) => sum + a.balance, 0),
        details: expenses,
      },
    }
  }

  // ──────────────────────────────────────────────
  // ✅ FIXED — Income Statement
  // ──────────────────────────────────────────────
  async getIncomeStatement(userId: string, fromDate: string, toDate: string) {
    const trialBalance = await this.getTrialBalance(userId, toDate)

    const revenue = trialBalance
      .filter((a: any) => a.accountType === 'revenue')
      .reduce((sum: number, a: any) => sum + Math.abs(a.balance), 0)

    const expenses = trialBalance
      .filter((a: any) => a.accountType === 'expense')
      .reduce((sum: number, a: any) => sum + a.balance, 0)

    return {
      revenue,
      expenses,
      totalRevenue: revenue,
      totalExpenses: expenses,
      netIncome: revenue - expenses,
    }
  }
}