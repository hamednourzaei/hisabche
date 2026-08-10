// packages/ui/src/components/ui/customers/customer-workspace.tsx
'use client'

import { useState, useCallback } from 'react'
import { cn } from '../../../lib/utils'
import { ChevronRight, Clock, FileText, Handshake, DollarSign } from 'lucide-react'
import { Customer360Header } from './customer-360-header'
import { CustomerAISummary } from './customer-ai-summary'
import { NextBestAction } from './next-best-action'
import { DataGrid } from './datagrid/datagrid'
import { Drawer } from './datagrid/drawer'
import { getInvoiceColumns, type InvoiceRow } from './datagrid/columns/invoice-columns'
import { getInteractionColumns, type InteractionRow } from './datagrid/columns/interaction-columns'
import { getOpportunityColumns, type OpportunityRow } from './datagrid/columns/opportunity-columns'
import { getTimelineColumns, type TimelineRow } from './datagrid/columns/timeline-columns'
import { PaymentModal } from './PaymentModal'

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
  { id: 'invoices', labelKey: 'customers.tabInvoices', fallback: 'فاکتورها', icon: FileText },
  { id: 'crm', labelKey: 'customers.tabCrm', fallback: 'CRM', icon: Handshake },
  { id: 'timeline', labelKey: 'customers.tabTimeline', fallback: 'خط زمانی', icon: Clock },
]

const ghostBtn =
  'inline-flex items-center justify-center rounded-full p-2 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none'

export function customerWorkspace(props: CustomerWorkspaceProps) {
  const {
    t,
    fmt,
    customer,
    showCrmTabs,
    activeTab,
    onTabChange,
    openInvoices,
    totalDebt,
    payOpen,
    onOpenPayment,
    onClosePayment,
    onPaymentSuccess,
    interactions,
    opportunities,
    onQuickAction,
    onBack,
  } = props

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTitle, setDrawerTitle] = useState('')
  const [drawerContent, setDrawerContent] = useState<React.ReactNode>(null)

  const visibleTabs = showCrmTabs ? tabs : tabs.filter((tab) => tab.id !== 'crm')

  const openDrawer = useCallback((title: string, content: React.ReactNode) => {
    setDrawerTitle(title)
    setDrawerContent(content)
    setDrawerOpen(true)
  }, [])

  // Map data to rows
  const invoiceRows: InvoiceRow[] = openInvoices.map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber || inv.invoice_number,
    date: inv.date || inv.created_at,
    total: inv.total || 0,
    paidAmount: inv.paidAmount || inv.paid_amount || 0,
    remaining: (inv.total || 0) - (inv.paidAmount || inv.paid_amount || 0),
    status: inv.status,
  }))

  const interactionRows: InteractionRow[] = interactions.map((i: any) => ({
    id: i.id,
    type: i.type,
    subject: i.subject || i.type,
    content: i.content,
    date: i.interactionDate || i.interaction_date || i.created_at,
  }))

  const opportunityRows: OpportunityRow[] = opportunities.map((o: any) => ({
    id: o.id,
    title: o.title,
    stage: o.stage,
    value: o.value || 0,
    probability: o.probability || 0,
    expectedCloseDate: o.expectedCloseDate || o.expected_close_date,
  }))

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PaymentModal
        open={payOpen}
        onClose={onClosePayment}
        onPaid={onPaymentSuccess}
        customer={{
          id: '',
          fullName: customer.name,
          name: customer.name,
          phone: customer.phone || '',
        }}
        openInvoices={openInvoices}
      />

      <Drawer t={t} open={drawerOpen} onClose={() => setDrawerOpen(false)} title={drawerTitle}>
        {drawerContent}
      </Drawer>

      {/* Back Button */}
      <button type="button" onClick={onBack} className={ghostBtn} aria-label={t('common.back')}>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>

      {/* Customer 360° Header */}
      <Customer360Header t={t} customer={customer} fmt={fmt} onQuickAction={onQuickAction} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-[hsl(var(--color-destructive))]">
            {fmt(totalDebt)}
          </p>
          <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
            {t('customers.totalDebt', 'کل بدهی')}
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{openInvoices.length}</p>
          <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
            {t('customers.openInvoices', 'فاکتور باز')}
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{interactions.length}</p>
          <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
            {t('customers.interactions', 'تعاملات')}
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-[hsl(var(--fg-primary))]">
            {fmt(customer.lifetimeValue)}
          </p>
          <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
            {t('customers.lifetimeValue', 'ارزش کل')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[hsl(var(--border-default))]">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-[1px] transition-colors duration-150',
              activeTab === tab.id
                ? 'border-[hsl(var(--color-primary))] text-[hsl(var(--color-primary))]'
                : 'border-transparent text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
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
          {activeTab === 'invoices' && (
            <DataGrid
              t={t}
              columns={getInvoiceColumns(t)}
              data={invoiceRows}

              onRowClick={(row) =>
                openDrawer(
                  `#${row.invoiceNumber}`,
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>{t('invoices.total', 'مبلغ کل')}</span>
                      <span className="font-bold">{fmt(row.total)} AFN</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('invoices.paid', 'پرداخت شده')}</span>
                      <span>{fmt(row.paidAmount)} AFN</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('invoices.remaining', 'مانده')}</span>
                      <span className="font-bold text-[hsl(var(--color-destructive))]">
                        {fmt(row.remaining)} AFN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('invoices.status', 'وضعیت')}</span>
                      <span>{row.status}</span>
                    </div>
                  </div>,
                )
              }
              emptyMessage={t('customers.noInvoices', 'فاکتوری یافت نشد')}
            />
          )}

          {activeTab === 'crm' && showCrmTabs && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-[hsl(var(--fg-secondary))] mb-2">
                  {t('customers.interactions', 'تعاملات')}
                </h3>
                <DataGrid
                  t={t}
                  columns={getInteractionColumns(t)}
                  data={interactionRows}

                  emptyMessage={t('customers.noInteractions', 'تعاملی یافت نشد')}
                />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[hsl(var(--fg-secondary))] mb-2">
                  {t('customers.opportunities', 'فرصت‌های فروش')}
                </h3>
                <DataGrid
                  t={t}
                  columns={getOpportunityColumns(t)}
                  data={opportunityRows}

                  onRowClick={(row) =>
                    openDrawer(
                      row.title,
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>{t('crm.stage', 'مرحله')}</span>
                          <span>{row.stage}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('crm.value', 'مبلغ')}</span>
                          <span className="font-bold">{fmt(row.value)} AFN</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{t('crm.probability', 'احتمال')}</span>
                          <span>{row.probability}%</span>
                        </div>
                      </div>,
                    )
                  }
                  emptyMessage={t('customers.noOpportunities', 'فرصتی یافت نشد')}
                />
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="glass-card p-5">
              <p className="text-sm text-[hsl(var(--fg-secondary))]">
                {t('customers.timelineComingSoon', 'خط زمانی به زودی...')}
              </p>
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
