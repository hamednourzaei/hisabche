// packages/ui/src/components/ui/customers/customer-workspace.tsx
"use client"

import { cn } from "@/lib/utils"
import { ChevronRight, Clock, FileText, Handshake } from "lucide-react"
import { Customer360Header } from "./customer-360-header"
import { CustomerAISummary } from "./customer-ai-summary"
import { NextBestAction } from "./next-best-action"
import { CustomerInvoicesTab } from "./customer-invoices-tab"
import { CustomerInteractionsTab } from "./customer-interactions-tab"
import { CustomerOpportunitiesTab } from "./customer-opportunities-tab"
import { PaymentModal } from "./PaymentModal"

interface CustomerWorkspaceProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  customer: {
    name: string
    phone?: string
    type: 'cash' | 'credit'
    tags: string[]
    healthScore: number
    totalDebt: number
    lifetimeValue: number
    lastActivity: string
  }
  showCrmTabs: boolean
  activeTab: string
  onTabChange: (tab: string) => void
  openInvoices: any[]
  totalDebt: number
  payOpen: boolean
  onOpenPayment: () => void
  onClosePayment: () => void
  onPaymentSuccess: () => void
  interactions: any[]
  opportunities: any[]
  onQuickAction: (action: string) => void
  onBack: () => void
}

const tabs = [
  { id: 'timeline', labelKey: 'customers.tabTimeline', fallback: 'خط زمانی', icon: Clock },
  { id: 'invoices', labelKey: 'customers.tabInvoices', fallback: 'فاکتورها', icon: FileText },
  { id: 'crm', labelKey: 'customers.tabCrm', fallback: 'CRM', icon: Handshake },
]

const ghostBtn = "inline-flex items-center justify-center rounded-full p-2 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none"

export function customerWorkspace(props: CustomerWorkspaceProps) {
  const {
    t, fmt, customer, showCrmTabs, activeTab, onTabChange,
    openInvoices, totalDebt, payOpen, onOpenPayment, onClosePayment, onPaymentSuccess,
    interactions, opportunities, onQuickAction, onBack,
  } = props

  const visibleTabs = showCrmTabs ? tabs : tabs.filter(tab => tab.id !== 'crm')

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PaymentModal
        open={payOpen}
        onClose={onClosePayment}
        onPaid={onPaymentSuccess}
        customer={{ id: '', fullName: customer.name, name: customer.name, phone: customer.phone || '' }}
        openInvoices={openInvoices}
      />

      {/* Back Button */}
      <button type="button" onClick={onBack} className={ghostBtn} aria-label={t("common.back")}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>

      {/* Customer 360° Header */}
      <Customer360Header t={t} customer={customer} fmt={fmt} onQuickAction={onQuickAction} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[hsl(var(--border-default))]">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-[1px] transition-colors duration-150",
              activeTab === tab.id
                ? "border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))]"
                : "border-transparent text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]",
            )}
          >
            <tab.icon className="size-4" aria-hidden="true" />
            {t(tab.labelKey, tab.fallback)}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'timeline' && (
            <div className="glass-card p-5">
              <p className="text-sm text-[hsl(var(--fg-secondary))]">
                {t("customers.timelineComingSoon", "خط زمانی به زودی...")}
              </p>
            </div>
          )}

          {activeTab === 'invoices' && (
            <CustomerInvoicesTab
              t={t} fmt={fmt}
              openInvoices={openInvoices}
              totalDebt={totalDebt}
              onOpenPayment={onOpenPayment}
            />
          )}

          {activeTab === 'crm' && showCrmTabs && (
            <div className="space-y-4">
              <CustomerInteractionsTab t={t} fmt={fmt} interactions={interactions} />
              <CustomerOpportunitiesTab t={t} fmt={fmt} opportunities={opportunities} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:w-80 space-y-4">
          <CustomerAISummary t={t} customerId={customer.name} customerName={customer.name} />
          <NextBestAction
            t={t}
            hasOverdueInvoices={totalDebt > 0}
            daysSinceLastPurchase={0}
            lifetimeValue={customer.lifetimeValue}
            isVip={customer.tags.includes('vip')}
            onAction={(action: any) => onQuickAction(action.type)}
          />
        </div>
      </div>
    </div>
  )
}