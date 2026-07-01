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

  // ─── Financial Reports ──────────────────────────────────
  async getTrialBalance(userId: string, date: string) {
    // جمع‌بندی مانده حساب‌ها تا تاریخ مشخص
    const { data, error } = await supabase
      .from('accounts')
      .select(`
        id,
        code,
        name,
        lines:journal_lines(
          debit,
          credit
        )
      `)
      .eq('user_id', userId)
      .lte('journal_entries.date', date)

    if (error) throw new DatabaseError('Failed to fetch trial balance', error)

    return data.map(account => {
      const totalDebit = account.lines.reduce((sum, l) => sum + (l.debit || 0), 0)
      const totalCredit = account.lines.reduce((sum, l) => sum + (l.credit || 0), 0)
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        debit: totalDebit,
        credit: totalCredit,
        balance: totalDebit - totalCredit,
      }
    })
  }

  async getBalanceSheet(userId: string, date: string) {
    const trialBalance = await this.getTrialBalance(userId, date)

    const assets = trialBalance.filter(a => a.balance > 0 && a.accountCode.startsWith('1'))
    const liabilities = trialBalance.filter(a => a.balance > 0 && a.accountCode.startsWith('2'))
    const equity = trialBalance.filter(a => a.balance > 0 && a.accountCode.startsWith('3'))

    return {
      assets,
      liabilities,
      equity,
      totalAssets: assets.reduce((sum, a) => sum + a.balance, 0),
      totalLiabilities: liabilities.reduce((sum, a) => sum + a.balance, 0),
      totalEquity: equity.reduce((sum, a) => sum + a.balance, 0),
    }
  }

  async getIncomeStatement(userId: string, fromDate: string, toDate: string) {
    const { data, error } = await supabase
      .from('journal_lines')
      .select(`
        *,
        account:accounts(*)
      `)
      .eq('user_id', userId)
      .gte('journal_entries.date', fromDate)
      .lte('journal_entries.date', toDate)

    if (error) throw new DatabaseError('Failed to fetch income statement', error)

    const revenue = data
      .filter(l => l.account.type === 'revenue')
      .reduce((sum, l) => sum + l.credit, 0)

    const expenses = data
      .filter(l => l.account.type === 'expense')
      .reduce((sum, l) => sum + l.debit, 0)

    return {
      revenue,
      expenses,
      totalRevenue: revenue,
      totalExpenses: expenses,
      netIncome: revenue - expenses,
    }
  }
}