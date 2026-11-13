// packages/ui/src/components/ui/customers/containers/customer-workspace-container.tsx
'use client'

import { useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useCustomer, useInvoices, useInteractions, useOpportunities } from '@hisabche/api'
import { CustomerWorkspace } from '../customer-workspace'
import { fmt } from '../../../../lib/customers/customers-format'
import type { CustomerWithDebt } from '../../../../lib/customers/customers-types'

interface CustomerWorkspaceContainerProps {
  customerId: string
  customerBase: CustomerWithDebt | null
  onBack: () => void
}

export function CustomerWorkspaceContainer({
  customerId,
  customerBase,
  onBack,
}: CustomerWorkspaceContainerProps) {
  const t = useTranslations()
  const [activeTab, setActiveTab] = useState<string>('invoices')
  const [payOpen, setPayOpen] = useState(false)

  const { data: customer } = useCustomer(customerId)
  const showCrmTabs = customer?.type === 'credit'

  const { data: invoicesData } = useInvoices({
    customerId,
    limit: 200,
    page: 1,
    sortDirection: 'desc',
  })
  const { data: interactions } = useInteractions(showCrmTabs ? customerId : undefined)
  const { data: opportunities } = useOpportunities(showCrmTabs ? customerId : undefined)

  const mergedCustomer = useMemo(() => {
    const type: 'cash' | 'credit' =
      (customer?.type ?? customerBase?.type) === 'credit' ? 'credit' : 'cash'
    return {
      name: customer?.fullName || customerBase?.fullName || customerBase?.name || '',
      phone: customer?.phone || customerBase?.phone || '',
      type,
      // 13 Nov 2026: these read fields CustomerWithDebt does not have (`debt`, `tags`,
      // `totalPurchases`, `lastInvoiceDate`) through `any`, so the header always said «debt 0»,
      // and «health 92%» was a constant. The debt is the real one; nothing measures health or
      // lifetime value yet, so they are null and not shown (G1).
      tags: [],
      healthScore: null,
      totalDebt: customerBase?.totalDebt ?? 0,
      lifetimeValue: null,
      lastActivity: '',
    }
  }, [customer, customerBase])

  const openInvoices = useMemo(() => {
    const invoices = invoicesData?.invoices ?? []
    return invoices.filter((inv) => inv.status !== 'paid')
  }, [invoicesData])

  const totalDebt = useMemo(() => {
    return openInvoices.reduce((sum, inv) => {
      return sum + ((inv.total || 0) - (inv.paidAmount || 0))
    }, 0)
  }, [openInvoices])

  const safeT = useCallback(
    (key: string, fallback?: string) => {
      const v = t(key)
      return v !== key ? v : (fallback ?? key)
    },
    [t],
  )

  const handleQuickAction = useCallback((action: string) => {
    if (action === 'payment') setPayOpen(true)
  }, [])

  return (
    <CustomerWorkspace
      {...{
        t: safeT,
        fmt,
        customer: mergedCustomer,
        showCrmTabs,
        activeTab,
        onTabChange: setActiveTab,
        openInvoices,
        totalDebt,
        payOpen,
        onOpenPayment: () => setPayOpen(true),
        onClosePayment: () => setPayOpen(false),
        onPaymentSuccess: () => setPayOpen(false),
        interactions: interactions ?? [],
        opportunities: opportunities ?? [],
        onQuickAction: handleQuickAction,
        onBack,
        customerId,
      }}
    />
  )
}
