// packages/ui/src/components/ui/accounting/AccountingTabs.tsx
'use client'

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import { Wallet, BookOpen, Scale, FileBarChart, TrendingUp } from 'lucide-react'
import { cn } from '../../../lib/utils'

export type AccountingTabId =
  'accounts' | 'journal' | 'trialBalance' | 'balanceSheet' | 'incomeStatement'

interface TabConfig {
  id: AccountingTabId
  icon: typeof Wallet
  labelKey: string
  labelFallback: string
}

const TABS: TabConfig[] = [
  { id: 'accounts', icon: Wallet, labelKey: 'accounting.tabs.accounts', labelFallback: 'حساب‌ها' },
  {
    id: 'journal',
    icon: BookOpen,
    labelKey: 'accounting.tabs.journal',
    labelFallback: 'دفتر روزنامه',
  },
  {
    id: 'trialBalance',
    icon: Scale,
    labelKey: 'accounting.tabs.trialBalance',
    labelFallback: 'تراز آزمایشی',
  },
  {
    id: 'balanceSheet',
    icon: FileBarChart,
    labelKey: 'accounting.tabs.balanceSheet',
    labelFallback: 'ترازنامه',
  },
  {
    id: 'incomeStatement',
    icon: TrendingUp,
    labelKey: 'accounting.tabs.incomeStatement',
    labelFallback: 'سود و زیان',
  },
]

interface AccountingTabsProps {
  activeTab: AccountingTabId
  onTabChange: (tab: AccountingTabId) => void
}

export const AccountingTabs = memo(function AccountingTabs({
  activeTab,
  onTabChange,
}: AccountingTabsProps) {
  const t = useTranslations()

  return (
    // Underline, not filled pills.
    //
    // Five solid primary-coloured chips with drop shadows put the loudest
    // element on the screen on the NAVIGATION, which is the part a person looks
    // at once and then ignores. The figures underneath are what the screen is
    // for. An underline marks the current tab without competing with them —
    // and it is the same tab treatment the warehouse and people screens use, so
    // a tab looks like a tab everywhere in the product.
    //
    // Sizes are one value, not three breakpoints on every property: the
    // previous `text-[11px] md:text-xs lg:text-sm` plus four more triples said
    // nothing except that nobody had chosen.
    <div
      className="scrollbar-hide flex items-center gap-1 overflow-x-auto border-b border-[hsl(var(--border-default))]"
      role="tablist"
      aria-label={t('accounting.tabs.label')}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              // -mb-px so the tab's own border sits ON the container's, rather
              // than a pixel below it.
              '-mb-px min-h-[44px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
              isActive
                ? 'border-[hsl(var(--color-primary))] font-semibold text-[hsl(var(--fg-primary))]'
                : 'border-transparent text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
            )}
          >
            <Icon
              className={cn(
                'size-4',
                isActive ? 'text-[hsl(var(--color-primary))]' : 'text-[hsl(var(--fg-tertiary))]',
              )}
              aria-hidden="true"
            />
            <span>{t(tab.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
})
