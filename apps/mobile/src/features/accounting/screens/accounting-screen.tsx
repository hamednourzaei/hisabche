// ============================================
// Accounting — five-tab screen matching the canonical Web accounting page.
//
// Web anatomy (packages/ui/components/ui/accounting/):
//   Header: «پول و سود» + subtitle
//   Tabs:  حساب‌ها / دفتر روزنامه / تراز آزمایشی / ترازنامه / سود و زیان
//   Body: the active tab's data table inside a bordered elevated container.
//
// Mobile renders the same header, the same 5 pills (FilterBar), and the same
// tab content as native list/card rows — one tab at a time on the phone.
// ============================================

import React, { useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useAccounts,
  useJournalEntries,
  useTrialBalance,
  useBalanceSheet,
  useIncomeStatement,
  type Account,
  type JournalEntry,
  type TrialBalance,
} from '@hisabche/api'
import { FilterBar, MobileCard, Text, useTheme, type FilterOption } from '@hisabche/mobile-ui'

import { AppScreen } from '../../../shared/components/app-screen'
import { NavScreenHeader } from '../../../shared/components/nav-screen-header'
import { useCommonT } from '../../../shared/i18n/use-common-t'
import { currencySign, formatAmount, formatDate } from '../../../shared/lib/format'
import { useCurrency } from '../../settings/preferences.store'
import { asList } from '@hisabche/api'

type TabId = 'accounts' | 'journal' | 'trialBalance' | 'balanceSheet' | 'incomeStatement'

export function AccountingScreen() {
  const { t } = useTranslation('mobile')
  const tCommon = useCommonT()
  const { spacing } = useTheme()
  const currency = useCurrency()
  const [tab, setTab] = useState<TabId>('accounts')

  const accounts = useAccounts()
  const journal = useJournalEntries()
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const monthStart = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  }, [])
  const trialBalance = useTrialBalance(today)
  const balanceSheet = useBalanceSheet(today)
  const incomeStatement = useIncomeStatement(monthStart, today)

  const TABS: readonly FilterOption<TabId>[] = [
    { value: 'accounts', label: tCommon('accounting.tabs.accounts', 'حساب‌ها') },
    { value: 'journal', label: tCommon('accounting.tabs.journal', 'دفتر روزنامه') },
    { value: 'trialBalance', label: tCommon('accounting.tabs.trialBalance', 'تراز آزمایشی') },
    { value: 'balanceSheet', label: tCommon('accounting.tabs.balanceSheet', 'ترازنامه') },
    { value: 'incomeStatement', label: tCommon('accounting.tabs.incomeStatement', 'سود و زیان') },
  ]

  const sign = currencySign(currency)

  return (
    <AppScreen>
      <NavScreenHeader id="money" />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tabs — same 5 pills as web, horizontally scrollable on a phone. */}
        <FilterBar options={TABS} value={tab} onChange={setTab} />

        {/* Body — the active tab inside a bordered elevated surface. */}
        {tab === 'accounts' ? (
          <AccountsList
            data={accounts.data ?? []}
            loading={accounts.isLoading}
            sign={sign}
            currency={currency}
          />
        ) : null}
        {tab === 'journal' ? (
          <JournalList data={journal.data ?? []} loading={journal.isLoading} />
        ) : null}
        {tab === 'trialBalance' ? (
          <TrialBalanceList
            data={trialBalance.data?.rows ?? []}
            loading={trialBalance.isLoading}
            sign={sign}
            currency={currency}
          />
        ) : null}
        {tab === 'balanceSheet' ? (
          <BalanceSheetList data={balanceSheet.data} loading={balanceSheet.isLoading} />
        ) : null}
        {tab === 'incomeStatement' ? (
          <IncomeStatementList data={incomeStatement.data} loading={incomeStatement.isLoading} />
        ) : null}
      </ScrollView>
    </AppScreen>
  )
}

// ─── حساب‌ها — code · name · type ────────────────────────────────────────────

function AccountsList({
  data,
  loading,
  sign,
  currency,
}: {
  data: Account[]
  loading: boolean
  sign: string
  currency: string
}) {
  const { spacing } = useTheme()
  return (
    <View style={{ gap: spacing.sm }}>
      {data.length === 0 && loading ? <Text tone="tertiary">{'…'}</Text> : null}
      {data.map((account) => (
        <MobileCard key={account.id} padding="md">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {account.name}
              </Text>
              <Text variant="legal" tone="tertiary">
                {`${account.code} · ${account.type}`}
              </Text>
            </View>
          </View>
        </MobileCard>
      ))}
    </View>
  )
}

// ─── دفتر روزنامه — each entry's date, reference, description, lines ────────

function JournalList({ data, loading }: { data: JournalEntry[]; loading: boolean }) {
  const { spacing } = useTheme()
  return (
    <View style={{ gap: spacing.sm }}>
      {data.map((entry) => (
        <MobileCard key={entry.id} padding="md">
          <View style={{ gap: spacing.xs }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {formatDate(entry.date)}
            </Text>
            <Text variant="caption" tone="secondary">
              {entry.description}
            </Text>
            {asList<{ id: string; debit?: number; credit?: number }>(entry.lines).map((line) => (
              <Text key={line.id} variant="legal" tone="tertiary">
                {`${line.debit ? `بدهکار ${line.debit}` : ''}${line.debit && line.credit ? ' · ' : ''}${line.credit ? `بستانکار ${line.credit}` : ''}`}
              </Text>
            ))}
          </View>
        </MobileCard>
      ))}
    </View>
  )
}

// ─── تراز آزمایشی — account code · name · balance ───────────────────────────

function TrialBalanceList({
  data,
  loading,
  sign,
  currency,
}: {
  data: TrialBalance[]
  loading: boolean
  sign: string
  currency: string
}) {
  const { spacing, colors } = useTheme()
  return (
    <View style={{ gap: spacing.sm }}>
      {data.map((row) => (
        <MobileCard key={row.accountId} padding="md">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {row.accountName}
              </Text>
              <Text variant="legal" tone="tertiary">
                {row.accountCode}
              </Text>
            </View>
            <Text variant="bodyStrong" style={{ color: colors.primary }}>
              {`${formatAmount(row.balance)} ${sign}`}
            </Text>
          </View>
        </MobileCard>
      ))}
    </View>
  )
}

// ─── ترازنامه — assets / liabilities / equity sections ──────────────────────

function BalanceSheetList({
  data,
  loading,
}: {
  data: Awaited<ReturnType<typeof useBalanceSheet>>['data']
  loading: boolean
}) {
  const { spacing, colors } = useTheme()
  const { t } = useTranslation('mobile')
  // These three were labelled income / expense / balance, which is not what a
  // balance sheet has in it. They are the sheet's own three sections, and the
  // period result is shown separately because it sits inside equity.
  const sections = [
    { label: t('accounting.assets', 'دارایی‌ها'), value: data?.totalAssets },
    { label: t('accounting.liabilities', 'بدهی‌ها'), value: data?.totalLiabilities },
    { label: t('accounting.equity', 'حقوق صاحبان سهام'), value: data?.totalEquity },
    {
      label: t('accounting.currentYearEarnings', 'سود (زیان) دوره'),
      value: data?.currentYearEarnings,
    },
  ]
  return (
    <View style={{ gap: spacing.sm }}>
      {sections.map((section) => (
        <MobileCard key={section.label} padding="md">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="bodyStrong">{section.label}</Text>
            <Text variant="bodyStrong" style={{ color: colors.primary }}>
              {formatAmount(section.value ?? 0)}
            </Text>
          </View>
        </MobileCard>
      ))}
    </View>
  )
}

// ─── سود و زیان — revenue · expenses · net income ───────────────────────────

function IncomeStatementList({
  data,
  loading,
}: {
  data: Awaited<ReturnType<typeof useIncomeStatement>>['data']
  loading: boolean
}) {
  const { spacing, colors } = useTheme()
  const { t } = useTranslation('mobile')
  const rows = [
    { label: t('accounting.income'), value: data?.totalRevenue },
    { label: t('accounting.expense'), value: data?.totalExpenses },
    { label: t('accounting.netIncome', 'سود خالص'), value: data?.netIncome },
  ]
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row) => (
        <MobileCard key={row.label} padding="md">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="bodyStrong">{row.label}</Text>
            <Text variant="bodyStrong" style={{ color: colors.primary }}>
              {formatAmount(row.value ?? 0)}
            </Text>
          </View>
        </MobileCard>
      ))}
    </View>
  )
}
