// packages/ui/src/components/ui/accounting/AccountingPage.tsx
'use client'

import { lazy, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePostUnpostedInvoices, type PostUnpostedSummary } from '@hisabche/api'
import { AccountsTab } from './tabs/AccountsTab'
import { JournalTab } from './tabs/JournalTab'
import { TrialBalanceTab } from './tabs/TrialBalanceTab'
import { BalanceSheetTab } from './tabs/BalanceSheetTab'
import { IncomeStatementTab } from './tabs/IncomeStatementTab'
import { MonthEndTab } from './tabs/MonthEndTab'
import { FinancingTab } from './tabs/FinancingTab'
import { BranchScopeProvider } from '../branch/branch-scope'
import { BookOpen, FileBarChart, Landmark } from 'lucide-react'
import { PageHub } from '../page-hub'
import { useLocaleReplace } from '../../../hooks/use-locale-push'

//
// Seven tabs in a row became two, each with one switch:
//
//   دفترها     what is written — حساب‌ها · دفتر روزنامه · بستن ماه · وام و سرمایه‌گذاری
//   گزارش‌ها   what is read    — تراز آزمایشی · ترازنامه · سود و زیان
//
// ⚠️ THE SAME SEVEN SCREENS. Every section mounts the tab component that
// already owned it; the hub fetches nothing. The bar, the switch and the
// address handling are the shared `HubTabs` / `SegmentedControl` /
// `useHubTab` / `useHubSection`.
//
// ⚠️ THE OLD ADDRESSES STILL OPEN THE RIGHT SCREEN. `?tab=journal`, the
// address every link in the product was written with, is sent to its section.

// «دارایی‌های ثابت» (was /assets) is a section of «دفترها»: it mounts its own container.
const AssetsContainer = lazy(() =>
  import('../assets/containers/assets-container').then((m) => ({ default: m.AssetsContainer })),
)

const BankContainer = lazy(() =>
  import('../bank/containers/bank-container').then((m) => ({ default: m.BankContainer })),
)
const BudgetsContainer = lazy(() =>
  import('../budgets/containers/budgets-container').then((m) => ({ default: m.BudgetsContainer })),
)

export const ACCOUNTING_HUB_TABS = ['books', 'treasury', 'reports'] as const
export const ACCOUNTING_BOOK_SECTIONS = ['accounts', 'journal', 'monthEnd'] as const
/** What the business holds and owes outside the day-to-day books. */
export const ACCOUNTING_TREASURY_SECTIONS = ['bank', 'assets', 'financing'] as const
export const ACCOUNTING_REPORT_SECTIONS = [
  'trialBalance',
  'balanceSheet',
  'incomeStatement',
  'budgets',
] as const

/** Section → the page it came from (its lock in `NAV_MODULE`). */
export const ACCOUNTING_SECTION_SOURCE: Partial<Record<string, string>> = {
  bank: '/bank',
  assets: '/assets',
  budgets: '/budgets',
}

const HUB_TAB_ICON = { books: BookOpen, treasury: Landmark, reports: FileBarChart } as const
/** Where an old `?tab=` value lives now; null when it is not an old value. */
export function accountingAddressOf(oldTab: string | null): string | null {
  const place = (tab: string, sections: readonly string[], section: string) => {
    const query = [
      tab === 'books' ? '' : `tab=${tab}`,
      section === sections[0] ? '' : `view=${section}`,
    ]
      .filter(Boolean)
      .join('&')
    return query ? `/accounting?${query}` : '/accounting'
  }
  for (const [tab, sections] of [
    ['books', ACCOUNTING_BOOK_SECTIONS],
    ['treasury', ACCOUNTING_TREASURY_SECTIONS],
    ['reports', ACCOUNTING_REPORT_SECTIONS],
  ] as const) {
    const section = (sections as readonly string[]).find((candidate) => candidate === oldTab)
    if (section) return place(tab, sections, section)
  }
  return null
}

/**
 * «ثبت فاکتورهای ثبت‌نشده در دفتر».
 *
 * ⚠️ WHY THIS BUTTON EXISTS. Every report on this page is built from journal
 * entries, and invoices issued before the chart of accounts existed were
 * skipped by the automatic poster — so these tabs stayed empty while sales
 * kept being recorded. New invoices now post automatically (the missing
 * standard accounts are created on first use); this books the history. It is
 * idempotent: an invoice already in the ledger is not booked twice.
 */
function PostUnpostedAction() {
  const t = useTranslations()
  const postAll = usePostUnpostedInvoices()
  const [progress, setProgress] = useState<PostUnpostedSummary | null>(null)
  const summary = postAll.data ?? progress
  const errorText = postAll.isError
    ? String((postAll.error as { message?: string } | null)?.message ?? '')
    : ''
  const withoutCost = summary?.skipped.filter((s) => s.status === 'posted_without_cost').length ?? 0
  const failed = summary?.skipped.filter((s) => s.status !== 'posted_without_cost') ?? []

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setProgress(null)
          postAll.mutate(setProgress)
        }}
        disabled={postAll.isPending}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.2)] disabled:opacity-60"
      >
        {postAll.isPending ? t('accounting.postingUnposted') : t('accounting.postUnposted')}
      </button>
      {summary ? (
        <span role="status" className="text-xs text-[hsl(var(--fg-secondary))]">
          {t('accounting.postUnpostedChecked')}{' '}
          <span className="tabular-nums">{summary.checked}</span>
          {' · '}
          {t('accounting.postUnpostedResult')}{' '}
          <span className="tabular-nums">{summary.posted}</span>
          {summary.alreadyPosted ? (
            <>
              {' · '}
              {t('accounting.postUnpostedAlready')}{' '}
              <span className="tabular-nums">{summary.alreadyPosted}</span>
            </>
          ) : null}
          {withoutCost > 0 ? (
            <>
              {' · '}
              {t('accounting.postUnpostedWithoutCost')}{' '}
              <span className="tabular-nums">{withoutCost}</span>
            </>
          ) : null}
          {failed.length > 0 ? (
            <>
              {' · '}
              {t('accounting.postUnpostedSkipped')}{' '}
              <span className="tabular-nums">{failed.length}</span>
              {': '}
              {failed[0]?.detail}
            </>
          ) : null}
        </span>
      ) : null}
      {postAll.isError ? (
        <span role="alert" className="text-xs text-[hsl(var(--color-destructive))]">
          {t('accounting.postUnpostedError')}
          {errorText ? ` (${errorText})` : ''}
        </span>
      ) : null}
    </div>
  )
}

export function AccountingPage() {
  return <AccountingHub />
}

function AccountingHub() {
  const t = useTranslations()

  const searchParams = useSearchParams()
  const localeReplace = useLocaleReplace()
  const moved = accountingAddressOf(searchParams.get('tab'))
  useEffect(() => {
    if (moved) localeReplace(moved)
  }, [moved, localeReplace])

  const screen: Record<string, () => React.ReactNode> = {
    accounts: () => <AccountsTab />,
    journal: () => <JournalTab />,
    monthEnd: () => <MonthEndTab />,
    bank: () => <BankContainer />,
    assets: () => <AssetsContainer />,
    financing: () => <FinancingTab />,
    trialBalance: () => <TrialBalanceTab />,
    balanceSheet: () => <BalanceSheetTab />,
    incomeStatement: () => <IncomeStatementTab />,
    budgets: () => <BudgetsContainer />,
  }
  const sectionsOf = (ids: readonly string[]) =>
    ids.map((id) => ({
      id,
      label: t(`accounting.tabs.${id}` as Parameters<typeof t>[0]),
      source: ACCOUNTING_SECTION_SOURCE[id],
      // Every screen sits in the same card the tabs always had.
      render: () => (
        <div className="min-h-[400px] overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-0 md:rounded-2xl">
          {screen[id]?.()}
        </div>
      ),
    }))

  return (
    <BranchScopeProvider>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-3 px-3 md:max-w-4xl md:gap-4 md:px-4 lg:max-w-6xl lg:px-6">
        <div>
          <h1 className="text-lg font-bold text-[hsl(var(--fg-primary))] md:text-xl lg:text-2xl">
            {t('nav.money')}
          </h1>
          <p className="mt-0.5 text-sm text-[hsl(var(--fg-tertiary))] md:mt-1">
            {t('nav.money_description')}
          </p>
          <PostUnpostedAction />
        </div>

        <PageHub
          lookId="accounting"
          label={t('accountingHub.label')}
          sectionsLabel={t('accountingHub.booksLabel')}
          loadingLabel={t('common.loading')}
          tabs={[
            {
              id: 'books',
              label: t('accountingHub.tabs.books'),
              icon: HUB_TAB_ICON.books,
              sections: sectionsOf(ACCOUNTING_BOOK_SECTIONS),
            },
            {
              id: 'treasury',
              label: t('accountingHub.tabs.treasury'),
              icon: HUB_TAB_ICON.treasury,
              sections: sectionsOf(ACCOUNTING_TREASURY_SECTIONS),
            },
            {
              id: 'reports',
              label: t('accountingHub.tabs.reports'),
              icon: HUB_TAB_ICON.reports,
              sections: sectionsOf(ACCOUNTING_REPORT_SECTIONS),
            },
          ]}
        />
      </div>
    </BranchScopeProvider>
  )
}
AccountingPage.displayName = 'AccountingPage'
