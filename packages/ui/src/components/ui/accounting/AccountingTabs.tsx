// packages/ui/src/components/ui/accounting/AccountingTabs.tsx
'use client'

import { memo } from 'react'
import { useTranslations } from 'next-intl'
import { Wallet, BookOpen, Scale, FileBarChart, TrendingUp } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '../tabs'

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
    // ⚠️ THE SAME TABS AS /activities (owner's request, 26 Sep 2026) — the
    // shared Tabs primitives, not a second tab bar with its own look. Icons
    // stay: they are how the five statements are told apart at a glance.
    <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as AccountingTabId)}>
      <TabsList
        aria-label={t('accounting.tabs.label')}
        className="w-full md:w-auto flex-nowrap justify-start overflow-x-auto scrollbar-hide"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5">
              <Icon className="size-4" aria-hidden="true" />
              {t(tab.labelKey)}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
})
