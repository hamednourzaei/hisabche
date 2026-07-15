// packages/ui/src/components/ui/customers/customer-view.tsx — Control Center v5 Mobile-First
"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Plus, Search, Download, Star, AlertTriangle, DollarSign, User, LayoutGrid, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { customersStats } from "./customer-stats"
import { AddCustomerModal } from "./AddCustomerModal"
import { PaymentModal } from "./PaymentModal"
import { CustomerWorkspaceContainer } from "./containers/customer-workspace-container"
import { DataGrid } from "./datagrid/datagrid"
import type { ColumnDef } from "./datagrid/datagrid"
import type { CustomerWithDebt, InvoiceForDebt } from "../../../lib/customers/customers-types"

interface customersViewProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  search: string
  onSearchChange: (value: string) => void
  customersWithDebt: CustomerWithDebt[]
  totalCustomers: number
  debtorCount: number
  totalDebt: number
  overdueCount: number
  vipCount: number
  todaySales: number
  openDealsCount: number
  isLoading: boolean
  selectedCustomerId: string | null
  onSelectCustomer: (id: string) => void
  onClearSelection: () => void
  showAddModal: boolean
  onOpenAddModal: () => void
  onCloseAddModal: () => void
  showPaymentModal: boolean
  paymentCustomer: CustomerWithDebt | null
  paymentInvoices: InvoiceForDebt[]
  onOpenPayment: (customer: CustomerWithDebt) => void
  onClosePayment: () => void
  onPaymentSuccess: () => void
  onNewCreditInvoice: () => void
  currency?: string
}

const SMART_FILTERS = [
  { id: 'all', icon: User, labelKey: 'customers.filterAll', fallback: 'همه' },
  { id: 'debtors', icon: DollarSign, labelKey: 'customers.filterDebtors', fallback: 'بدهکار' },
  { id: 'vip', icon: Star, labelKey: 'customers.filterVip', fallback: 'VIP' },
  { id: 'overdue', icon: AlertTriangle, labelKey: 'customers.filterOverdue', fallback: 'عقب‌افتاده' },
]

function getCustomerColumns(t: (key: string, fallback?: string) => string, fmt: (v: number) => string, currency: string, onSelect: (id: string) => void): ColumnDef<CustomerWithDebt>[] {
  return [
    { id: 'name', header: t("customers.customer", "مشتری"), accessor: (row) => row.fullName || row.name || '',
      render: (value: string, row) => (
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelect(row.id)}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)]">
            <span className="text-sm font-bold text-[hsl(var(--color-primary))]">{value.charAt(0)}</span>
          </div>
          <p className="text-sm font-semibold text-[hsl(var(--fg-primary))] hover:text-[hsl(var(--color-primary))]">{value}</p>
        </div>
      ),
    },
    { id: 'phone', header: t("customers.phone", "تلفن"), accessor: (row) => row.phone || '-', width: 130 },
    { id: 'debt', header: t("customers.debt", "بدهی"), accessor: (row) => row.totalDebt || 0, type: 'currency', align: 'right', width: 120,
      render: (value: number) => (
        <span className={value > 0 ? "font-bold tabular-nums text-[hsl(var(--color-destructive))]" : "tabular-nums text-[hsl(var(--color-success))]"}>
          {value > 0 ? fmt(value) : '۰'} {currency}
        </span>
      ),
    },
    { id: 'lastPurchase', header: t("customers.lastPurchase", "آخرین خرید"), accessor: (row) => (row as any).lastInvoiceDate || '-', type: 'date', width: 120 },
    { id: 'openCount', header: t("customers.openInvoices", "باز"), accessor: (row) => row.openCount || 0, align: 'center', width: 50 },
    { id: 'status', header: t("customers.status", "وضعیت"), accessor: (row) => (row.totalDebt || 0) > 0 ? 'debtor' : 'settled', type: 'badge', width: 90 },
  ]
}

function CustomerCard({ customer, t, fmt, currency, onSelect }: { customer: CustomerWithDebt; t: any; fmt: any; currency: string; onSelect: (id: string) => void }) {
  const hasDebt = (customer.totalDebt || 0) > 0
  return (
    <div onClick={() => onSelect(customer.id)} className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 active:scale-[0.98] transition-transform cursor-pointer">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)]"><span className="text-sm font-bold text-[hsl(var(--color-primary))]">{(customer.fullName || customer.name || '?').charAt(0)}</span></div>
          <div><p className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{customer.fullName || customer.name}</p>{customer.phone && <p className="text-xs text-[hsl(var(--fg-tertiary))]">{customer.phone}</p>}</div>
        </div>
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", hasDebt ? "bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]" : "bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]")}>{hasDebt ? t("customers.debtor", "بدهکار") : t("customers.settled", "تسویه")}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-[hsl(var(--fg-secondary))]"><span>{customer.openCount || 0} {t("customers.openInvoices", "فاکتور باز")}</span>{hasDebt && <span className="font-bold text-[hsl(var(--color-destructive))]">{fmt(customer.totalDebt || 0)} {currency}</span>}</div>
    </div>
  )
}

export function customersView(props: customersViewProps) {
  const { t, fmt, search, onSearchChange, customersWithDebt, totalCustomers, debtorCount, totalDebt, overdueCount, vipCount, todaySales, openDealsCount,
    isLoading, selectedCustomerId, onSelectCustomer, onClearSelection, showAddModal, onOpenAddModal, onCloseAddModal,
    showPaymentModal, paymentCustomer, paymentInvoices, onOpenPayment, onClosePayment, onPaymentSuccess, onNewCreditInvoice, currency = "AFN" } = props

  const [activeFilter, setActiveFilter] = useState("all")
  const [isMobile, setIsMobile] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const filtered = useMemo(() => {
    let result = customersWithDebt
    if (search.trim()) { const term = search.toLowerCase(); result = result.filter(c => (c.fullName || c.name || '').toLowerCase().includes(term) || (c.phone || '').toLowerCase().includes(term)) }
    switch (activeFilter) { case 'vip': return result.filter(c => (c as any).tags?.includes('vip')); case 'debtors': return result.filter(c => (c.totalDebt || 0) > 0); case 'overdue': return result.filter(c => (c as any).isOverdue); default: return result }
  }, [customersWithDebt, search, activeFilter])

  // ✅ Export all customers to CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['نام', 'تلفن', 'بدهی', 'فاکتور باز', 'آخرین خرید', 'وضعیت']
    const rows = filtered.map((c: any) => [
      c.fullName || c.name || '',
      c.phone || '',
      c.totalDebt || 0,
      c.openCount || 0,
      c.lastInvoiceDate ? new Date(c.lastInvoiceDate).toLocaleDateString('fa-IR') : '-',
      (c.totalDebt || 0) > 0 ? 'بدهکار' : 'تسویه'
    ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customers-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  if (selectedCustomerId) return <CustomerWorkspaceContainer customerId={selectedCustomerId} customerBase={customersWithDebt.find(c => c.id === selectedCustomerId) || null} onBack={onClearSelection} />

  return (
    <div className="space-y-3 sm:space-y-4">
      <AddCustomerModal open={showAddModal} onClose={onCloseAddModal} onCreated={() => {}} />
      <PaymentModal open={showPaymentModal} onClose={onClosePayment} onPaid={onPaymentSuccess} customer={paymentCustomer} openInvoices={paymentInvoices} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={cn("font-bold text-[hsl(var(--fg-primary))]", isMobile ? "text-lg" : "text-2xl sm:text-3xl")}>{t("customers.title", "باقیداری")}</h1>
          {isMobile && <p className="text-xs text-[hsl(var(--fg-tertiary))]">{totalCustomers} {t("customers.customers", "مشتری")} • {debtorCount} {t("customers.debtors", "بدهکار")}</p>}
          {!isMobile && <p className="text-sm text-[hsl(var(--fg-secondary))]">{t("customers.subtitle", "مدیریت بدهی‌ها و پرداخت‌ها")}</p>}
        </div>
        <button onClick={onOpenAddModal} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-all duration-150">
          <Plus className="size-4" />
          <span className={cn(isMobile && "hidden sm:inline")}>{t("customers.addCustomer", "افزودن مشتری")}</span>
        </button>
      </div>

      {/* Search + Toolbar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))]" />
          <input type="text" placeholder={t("customers.searchPlaceholder", "جستجوی نام، شماره...")} value={search} onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl ps-9 pe-4 py-2.5 text-sm border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)]" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(isMobile && !expanded ? SMART_FILTERS.slice(0, 2) : SMART_FILTERS).map(f => (
            <button key={f.id} onClick={() => setActiveFilter(f.id)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-all",
              activeFilter === f.id ? "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]" : "border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]")}>
              <f.icon className="size-3" />{t(f.labelKey, f.fallback)}
            </button>
          ))}
          {!isMobile && <span className="w-px h-5 bg-[hsl(var(--border-default))] mx-1" />}
          {!isMobile && <>
            <button onClick={handleExportCSV} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"><Download className="size-3" />{t("common.export", "خروجی")}</button>
            <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"><LayoutGrid className="size-3" />{t("common.columns", "ستون‌ها")}</button>
          </>}
          {isMobile && <button onClick={() => setExpanded(!expanded)} className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-all shrink-0",
            expanded ? "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]" : "border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]")}>
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}{expanded ? t("common.less", "کمتر") : t("common.more", "بیشتر")}
          </button>}
        </div>
        {isMobile && expanded && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {SMART_FILTERS.slice(2).map(f => (
              <button key={f.id} onClick={() => setActiveFilter(f.id)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-all",
                activeFilter === f.id ? "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]" : "border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]")}>
                <f.icon className="size-3" />{t(f.labelKey, f.fallback)}
              </button>
            ))}
            <button onClick={handleExportCSV} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"><Download className="size-3" />{t("common.export", "خروجی")}</button>
            <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"><LayoutGrid className="size-3" />{t("common.columns", "ستون‌ها")}</button>
          </div>
        )}
      </div>

      {/* KPI */}
      <div className={cn(isMobile ? "flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" : "")}>
        {customersStats({ t, fmt, totalCustomers, totalDebt, overdueCount, vipCount, todaySales, currency, isMobile })}
      </div>

      {/* Content */}
      {isLoading ? <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className={cn("rounded-lg bg-[hsl(var(--surface-muted))] skeleton-shimmer", isMobile ? "h-20" : "h-12")} />)}</div>
      : isMobile ? <div className="space-y-2">{filtered.length === 0 ? <div className="flex flex-col items-center justify-center py-12 text-center"><User className="size-10 text-[hsl(var(--fg-tertiary))] mb-3" /><p className="text-sm text-[hsl(var(--fg-secondary))]">{t("customers.empty.title", "هیچ مشتری‌ای یافت نشد")}</p></div> : filtered.map(c => <CustomerCard key={c.id} customer={c} t={t} fmt={fmt} currency={currency} onSelect={onSelectCustomer} />)}</div>
      : <DataGrid t={t} columns={getCustomerColumns(t, fmt, currency, onSelectCustomer)} data={filtered} emptyMessage={t("customers.empty.title", "هیچ مشتری‌ای یافت نشد")} />}
    </div>
  )
}