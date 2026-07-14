// packages/ui/src/components/ui/customers/containers/customer-workspace-container.tsx
"use client"

import { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useCustomer, useInvoices, useInteractions, useOpportunities } from "@hisabche/api"
import { customerWorkspace } from "../customer-workspace"
import { fmt } from "../../../../lib/customers/customers-format"
import type { CustomerWithDebt } from "../../../../lib/customers/customers-types"

interface CustomerWorkspaceContainerProps {
  customerId: string
  customerBase: CustomerWithDebt | null
  onBack: () => void
}

export function CustomerWorkspaceContainer({ customerId, customerBase, onBack }: CustomerWorkspaceContainerProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>("timeline")
  const [payOpen, setPayOpen] = useState(false)

  const { data: customer } = useCustomer(customerId)
  const showCrmTabs = customer?.type === 'credit'

  const { data: invoicesData } = useInvoices({ customerId, limit: 50, page: 1, sortDirection: 'desc' } as any)
  const { data: interactions } = useInteractions(showCrmTabs ? customerId : undefined)
  const { data: opportunities } = useOpportunities(showCrmTabs ? customerId : undefined)

  const mergedCustomer = useMemo(() => {
    const c = customer as any
    const b = customerBase as any
    return {
      name: c?.fullName || b?.fullName || b?.name || '',
      phone: c?.phone || b?.phone || '',
      type: (c?.type || b?.type || 'cash') as 'cash' | 'credit',
      tags: b?.tags || [],
      healthScore: 92,
      totalDebt: b?.debt || 0,
      lifetimeValue: b?.totalPurchases || 0,
      lastActivity: b?.lastInvoiceDate || '',
    }
  }, [customer, customerBase])

  const openInvoices = useMemo(() => {
    const invoices = (invoicesData as any)?.invoices || []
    return invoices.filter((inv: any) => inv.status !== 'paid')
  }, [invoicesData])

  const totalDebt = useMemo(() => {
    return openInvoices.reduce((sum: number, inv: any) => {
      return sum + ((inv.total || 0) - (inv.paidAmount || inv.paid_amount || 0))
    }, 0)
  }, [openInvoices])

  const safeT = useCallback((key: string, fallback?: string) => {
    const v = t(key)
    return v !== key ? v : (fallback ?? key)
  }, [t])

  const handleQuickAction = useCallback((action: string) => {
    if (action === 'payment') setPayOpen(true)
  }, [])

  return customerWorkspace({
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
    interactions: (interactions || []) as any[],
    opportunities: (opportunities || []) as any[],
    onQuickAction: handleQuickAction,
    onBack,
  })
}