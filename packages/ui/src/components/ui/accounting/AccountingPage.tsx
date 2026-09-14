// packages/ui/src/components/ui/accounting/AccountingPage.tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { usePostUnpostedInvoices, type PostUnpostedSummary } from '@hisabche/api'
import { AccountingTabs, type AccountingTabId } from './AccountingTabs'
import { AccountsTab } from './tabs/AccountsTab'
import { JournalTab } from './tabs/JournalTab'
import { TrialBalanceTab } from './tabs/TrialBalanceTab'
import { BalanceSheetTab } from './tabs/BalanceSheetTab'
import { IncomeStatementTab } from './tabs/IncomeStatementTab'
import { BranchScopeProvider } from '../branch/branch-scope'

const VALID_TABS: AccountingTabId[] = [
  'accounts',
  'journal',
  'trialBalance',
  'balanceSheet',
  'incomeStatement',
]
const DEFAULT_TAB: AccountingTabId = 'accounts'

function isValidTab(value: string | null): value is AccountingTabId {
  return value !== null && (VALID_TABS as string[]).includes(value)
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
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeTab = useMemo<AccountingTabId>(() => {
    const tabParam = searchParams.get('tab')
    return isValidTab(tabParam) ? tabParam : DEFAULT_TAB
  }, [searchParams])

  const handleTabChange = useCallback(
    (tab: AccountingTabId) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', tab)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  return (
    // K4 — the selected branch is shared by every report on this page, and
    // lives only as long as the page. Deliberately not global: a branch chosen
    // here must not silently re-scope the warehouse screen opened next.
    <BranchScopeProvider>
      <div className="flex flex-col h-full w-full max-w-3xl md:max-w-4xl lg:max-w-6xl mx-auto px-3 md:px-4 lg:px-6">
        {/* ─── Header ─────────────────────────────────────────── */}
        <div className="pb-3 md:pb-4 lg:pb-5">
          <h1 className="font-bold text-[hsl(var(--fg-primary))] text-lg md:text-xl lg:text-2xl">
            {t('nav.money')}
          </h1>
          <p className="text-sm text-[hsl(var(--fg-tertiary))] mt-0.5 md:mt-1">
            {t('nav.money_description')}
          </p>
          <PostUnpostedAction />
        </div>

        {/* ─── Tabs ───────────────────────────────────────────── */}
        <div className="pb-3 md:pb-4">
          <AccountingTabs activeTab={activeTab} onTabChange={handleTabChange} />
        </div>

        {/* ─── Body ───────────────────────────────────────────── */}
        <div className="flex-1 min-h-[400px] md:min-h-[500px] lg:min-h-[600px] rounded-xl md:rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] overflow-hidden mb-4 md:mb-6">
          {activeTab === 'accounts' && <AccountsTab />}
          {activeTab === 'journal' && <JournalTab />}
          {activeTab === 'trialBalance' && <TrialBalanceTab />}
          {activeTab === 'balanceSheet' && <BalanceSheetTab />}
          {activeTab === 'incomeStatement' && <IncomeStatementTab />}
        </div>
      </div>
    </BranchScopeProvider>
  )
}

AccountingPage.displayName = 'AccountingPage'
