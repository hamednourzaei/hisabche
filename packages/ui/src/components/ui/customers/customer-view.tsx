// packages/ui/src/components/ui/customers/customer-view.tsx
// 🎯 Control Center v7 — Production-Ready, Mobile-First, RTL, Offline-Ready
'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { cn } from '../../../lib/utils'
import { Plus, Download, User, AlertCircle } from 'lucide-react'
import { exportToCSV } from '../../../lib/export'

// Types
import type { CustomersViewProps } from './customer-view.types'
import type { CustomerWithDebt } from '../../../lib/customers/customers-types'

// Components
import { customersStats } from './customer-stats'
import { BulkActionBar, DataTable, useRowSelection, type TableColumn } from '../data-table'

// Lazy load modals (برای کاهش bundle size)
// Import عادی (بدون lazy)
import { AddCustomerModal } from './AddCustomerModal'
import { PaymentModal } from './PaymentModal'
import { CustomerWorkspaceContainer } from './containers/customer-workspace-container'

// ============================================================
// 🧰 Utilities
// ============================================================

/** تاریخ را با فرمت فارسی و RTL نمایش می‌دهد */
function formatDate(value: unknown, locale = 'fa-IR'): string {
  if (!value) return '-'
  try {
    const d = value instanceof Date ? value : new Date(value as string)
    if (isNaN(d.getTime())) return '-'
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return '-'
  }
}

/** هوک تشخیص موبایل با hydration safety */
function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false)

  // ✅ FIX: قبلاً از useState(initializer) به‌جای useEffect استفاده می‌شد —
  // یعنی listener فقط یک‌بار (بدون تضمین رسمی) اضافه می‌شد و cleanup
  // برگشتی هرگز صدا زده نمی‌شد (useState از cleanup پشتیبانی نمی‌کند)،
  // که هم نشتی حافظه ایجاد می‌کرد و هم تشخیص موبایل را غیرقابل‌اعتماد.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}

// ============================================================
// 🎯 جستجو
// ============================================================

/** منطق جستجو (خالص - بدون side effect) */
function filterCustomers(customers: CustomerWithDebt[], search: string): CustomerWithDebt[] {
  if (!search.trim()) return customers
  const term = search.toLowerCase()
  return customers.filter(
    (c) =>
      (c.fullName || c.name || '').toLowerCase().includes(term) ||
      (c.phone || '').toLowerCase().includes(term),
  )
}

// ============================================================
// 🧩 Sub-components (هر کدام < ۲۰ خط)
// ============================================================

/** هدر صفحه */
function CustomersHeader({
  t,
  isMobile,
  totalCustomers,
  debtorCount,
  onOpenAddModal,
}: {
  t: (key: string, fallback?: string) => string
  isMobile: boolean
  totalCustomers: number
  debtorCount: number
  onOpenAddModal: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1
          className={cn(
            'font-bold text-[hsl(var(--fg-primary))] text-wrap-balance',
            isMobile ? 'text-lg' : 'text-2xl sm:text-3xl',
          )}
        >
          {t('nav.buyers', 'خریدارها')}
        </h1>
        {/* شمارش مشتری/بدهکار حذف شد — همان اعداد در کارت‌های KPI بالای صفحه هستند. */}
        <p className={cn('text-[hsl(var(--fg-secondary))]', isMobile ? 'text-xs' : 'text-sm')}>
          {t('customers.subtitle', 'مدیریت بدهی‌ها و پرداخت‌ها')}
        </p>
      </div>
      <button
        onClick={onOpenAddModal}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-all duration-150"
        aria-label={t('customers.addCustomer', 'افزودن مشتری')}
      >
        <Plus className="size-4" />
        <span className={cn(isMobile && 'hidden sm:inline')}>
          {t('customers.addCustomer', 'افزودن مشتری')}
        </span>
      </button>
    </div>
  )
}

/** حالت‌های داده */
function LoadingSkeleton({
  isMobile,
  t,
}: {
  isMobile: boolean
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div className={cn('space-y-2', isMobile ? 'p-2' : 'p-4')}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-lg bg-[hsl(var(--surface-muted))] animate-pulse',
            isMobile ? 'h-20' : 'h-12',
          )}
          aria-busy="true"
          aria-label={t('common.loading', 'در حال بارگذاری')}
        />
      ))}
    </div>
  )
}

function EmptyState({
  t,
  isMobile,
}: {
  t: (key: string, fallback?: string) => string
  isMobile: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <User className="size-10 text-[hsl(var(--fg-tertiary))] mb-3" />
      <p className="text-sm text-[hsl(var(--fg-secondary))]">
        {t('customers.empty.title', 'هیچ مشتری‌ای یافت نشد')}
      </p>
      {!isMobile && (
        <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
          {t('customers.empty.subtitle', 'با افزودن مشتری جدید شروع کنید')}
        </p>
      )}
    </div>
  )
}

function ErrorState({
  t,
  message,
  onRetry,
}: {
  t: (key: string, fallback?: string) => string
  message: string
  onRetry: () => void
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center px-4"
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="size-10 text-[hsl(var(--color-destructive))] mb-3" />
      <p className="text-sm text-[hsl(var(--fg-secondary))] mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium bg-[hsl(var(--color-primary))] text-white hover:opacity-80 transition-opacity"
      >
        {t('common.retry', 'تلاش مجدد')}
      </button>
    </div>
  )
}

/** ستون‌های جدول مشتریان */
function useCustomerColumns(
  t: (key: string, fallback?: string) => string,
  fmt: (v: number) => string,
  currency: string,
): TableColumn<CustomerWithDebt>[] {
  return useMemo(
    () => [
      {
        id: 'customer',
        labelKey: 'customers.customer',
        labelFallback: 'مشتری',
        locked: true,
        sortValue: (c) => c.fullName || c.name || '',
        render: (c) => {
          const name = c.fullName || c.name || ''
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)]">
                <span className="text-sm font-bold text-[hsl(var(--color-primary))]">
                  {name.charAt(0) || '?'}
                </span>
              </div>
              <p className="font-semibold text-[hsl(var(--fg-primary))]">{name}</p>
            </div>
          )
        },
      },
      {
        id: 'phone',
        labelKey: 'customers.phone',
        labelFallback: 'تلفن',
        showFrom: 'sm',
        sortValue: (c) => c.phone ?? '',
        render: (c) => <span className="text-[hsl(var(--fg-secondary))]">{c.phone || '-'}</span>,
      },
      {
        id: 'debt',
        labelKey: 'customers.debt',
        labelFallback: 'بدهی',
        align: 'end',
        sortValue: (c) => c.totalDebt || 0,
        render: (c) => {
          const hasDebt = (c.totalDebt || 0) > 0
          return (
            <span
              className={cn(
                'tabular-nums',
                hasDebt
                  ? 'font-bold text-[hsl(var(--color-destructive))]'
                  : 'text-[hsl(var(--color-success))]',
              )}
            >
              {hasDebt ? fmt(c.totalDebt || 0) : '۰'} {currency}
            </span>
          )
        },
      },
      {
        id: 'lastPurchase',
        labelKey: 'customers.lastPurchase',
        labelFallback: 'آخرین خرید',
        showFrom: 'md',
        sortValue: (c) =>
          (c as CustomerWithDebt & { lastInvoiceDate?: string }).lastInvoiceDate ?? null,
        render: (c) => (
          <span className="text-[hsl(var(--fg-secondary))]">
            {formatDate((c as CustomerWithDebt & { lastInvoiceDate?: string }).lastInvoiceDate)}
          </span>
        ),
      },
      {
        id: 'openInvoices',
        labelKey: 'customers.openInvoices',
        labelFallback: 'باز',
        showFrom: 'md',
        align: 'end',
        sortValue: (c) => c.openCount || 0,
        render: (c) => (
          <span className="tabular-nums text-[hsl(var(--fg-secondary))]">{c.openCount || 0}</span>
        ),
      },
      {
        id: 'status',
        labelKey: 'customers.status',
        labelFallback: 'وضعیت',
        sortValue: (c) => ((c.totalDebt || 0) > 0 ? 1 : 0),
        render: (c) => {
          const hasDebt = (c.totalDebt || 0) > 0
          return (
            <span
              className={cn(
                'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
                hasDebt
                  ? 'bg-[hsl(var(--color-destructive)/0.12)] text-[hsl(var(--color-destructive))] border-[hsl(var(--color-destructive)/0.2)]'
                  : 'bg-[hsl(var(--color-success)/0.12)] text-[hsl(var(--color-success))] border-[hsl(var(--color-success)/0.2)]',
              )}
            >
              {hasDebt ? t('customers.debtor', 'بدهکار') : t('customers.settled', 'تسویه')}
            </span>
          )
        },
      },
    ],
    [currency, fmt, t],
  )
}

/** محتوای اصلی (با مدیریت ۴ حالت) */
function CustomersContent({
  t,
  fmt,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  filtered,
  isMobile,
  currency,
  onSelectCustomer,
  onExport,
  onExportSelected,
  search,
  onSearchChange,
}: {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  isLoading: boolean
  isError: boolean
  errorMessage: string
  onRetry: () => void
  filtered: CustomerWithDebt[]
  isMobile: boolean
  currency: string
  onSelectCustomer: (id: string) => void
  onExport: () => void
  /** Exports only the selected rows, reusing the same writer as the full export. */
  onExportSelected: (customers: readonly CustomerWithDebt[]) => void
  search: string
  onSearchChange: (value: string) => void
}) {
  const columns = useCustomerColumns(t, fmt, currency)

  // Customers have no client-side delete mutation and the backend refuses to
  // remove anyone with transactions, so the supported bulk action here is
  // export — not a destructive one invented to fill the toolbar.
  const selection = useRowSelection()
  const customerIds = useMemo(() => filtered.map((c) => c.id), [filtered])

  useEffect(() => {
    selection.prune(customerIds)
  }, [customerIds, selection])

  const handleExportSelected = useCallback(() => {
    const chosen = filtered.filter((c) => selection.selectedIds.has(c.id))
    onExportSelected(chosen)
    selection.clear()
  }, [filtered, onExportSelected, selection])

  if (isLoading) return <LoadingSkeleton isMobile={isMobile} t={t} />
  if (isError) return <ErrorState t={t} message={errorMessage} onRetry={onRetry} />

  return (
    <DataTable
      tableId="customers"
      t={t}
      rows={filtered}
      columns={columns}
      rowKey={(c) => c.id}
      onRowClick={(c) => onSelectCustomer(c.id)}
      searchValue={search}
      onSearchChange={onSearchChange}
      minWidthClass="min-w-[420px] sm:min-w-[640px]"
      emptyState={<EmptyState t={t} isMobile={isMobile} />}
      selectedIds={selection.selectedIds}
      onToggleRow={selection.toggleRow}
      onToggleAll={selection.toggleAll}
      bulkBar={
        <BulkActionBar
          t={t}
          selectedCount={selection.selectedCount}
          onClear={selection.clear}
          actions={[
            {
              id: 'export',
              label: t('common.export', 'خروجی'),
              icon: <Download className="size-3.5" aria-hidden="true" />,
              onRun: handleExportSelected,
            },
          ]}
        />
      }
      actions={
        // Export sits with the search and column icons rather than floating
        // above the table on its own row.
        <button
          type="button"
          onClick={onExport}
          title={t('common.export', 'خروجی')}
          aria-label={t('common.export', 'خروجی')}
          className="inline-flex size-9 items-center justify-center rounded-xl border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] transition-colors duration-150 hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]"
        >
          <Download className="size-4" aria-hidden="true" />
        </button>
      }
    />
  )
}

// ============================================================
// 🎯 کامپوننت اصلی (ورودی برنامه)
// ============================================================

export function customersView(props: CustomersViewProps) {
  const {
    t,
    fmt,
    search,
    onSearchChange,
    customersWithDebt,
    totalCustomers,
    debtorCount,
    totalDebt,
    overdueCount,
    vipCount,
    todaySales,
    totalSales,
    topCustomerName,
    topCustomerAmount,
    openDealsCount,
    isLoading,
    isError = false,
    errorMessage = '',
    onRetry = () => {},
    selectedCustomerId,
    onSelectCustomer,
    onClearSelection,
    showAddModal,
    onOpenAddModal,
    onCloseAddModal,
    showPaymentModal,
    paymentCustomer,
    paymentInvoices,
    onOpenPayment,
    onClosePayment,
    onPaymentSuccess,
    onNewCreditInvoice,
    currency = 'AFN',
    customersDelta = null,
    salesDelta = null,
    debtDelta = null,
    topCustomerDelta = null,
  } = props

  const isMobile = useIsMobile()

  // فیلتر کردن با useMemo
  const filtered = useMemo(
    () => filterCustomers(customersWithDebt, search),
    [customersWithDebt, search],
  )

  // خروجی CSV — از همان `exportToCSV` مشترکی که فاکتورها و کارمندان استفاده
  // می‌کنند. قبلاً اینجا یک CSV دستی با هدرهای فارسیِ هاردکد ساخته می‌شد که نه
  // i18n داشت و نه مقادیر را escape می‌کرد؛ یک نام حاوی کاما ستون‌ها را جابه‌جا
  // می‌کرد.
  const buildExportRows = useCallback(
    (list: readonly CustomerWithDebt[]) =>
      list.map((c) => ({
        name: c.fullName || c.name || '',
        phone: c.phone || '',
        debt: c.totalDebt || 0,
        openInvoices: c.openCount || 0,
        lastPurchase: formatDate(
          (c as CustomerWithDebt & { lastInvoiceDate?: string }).lastInvoiceDate,
        ),
        status:
          (c.totalDebt || 0) > 0
            ? t('customers.export.statusDebtor', 'بدهکار')
            : t('customers.export.statusSettled', 'تسویه'),
      })),
    [t],
  )

  const exportColumns = useMemo(
    () => [
      { key: 'name' as const, label: t('customers.export.name', 'نام') },
      { key: 'phone' as const, label: t('customers.export.phone', 'تلفن') },
      { key: 'debt' as const, label: `${t('customers.export.debt', 'بدهی')} (${currency})` },
      { key: 'openInvoices' as const, label: t('customers.export.openInvoices', 'فاکتور باز') },
      { key: 'lastPurchase' as const, label: t('customers.export.lastPurchase', 'آخرین خرید') },
      { key: 'status' as const, label: t('customers.export.status', 'وضعیت') },
    ],
    [t, currency],
  )

  const exportCustomers = useCallback(
    (list: readonly CustomerWithDebt[]) => {
      exportToCSV(
        buildExportRows(list),
        exportColumns,
        `customers-${new Date().toISOString().slice(0, 10)}`,
      )
    },
    [buildExportRows, exportColumns],
  )

  const handleExportCSV = useCallback(() => exportCustomers(filtered), [exportCustomers, filtered])

  // اگر کاربر workspace را انتخاب کرده
  if (selectedCustomerId) {
    return (
      <Suspense fallback={<LoadingSkeleton isMobile={isMobile} t={t} />}>
        <CustomerWorkspaceContainer
          customerId={selectedCustomerId}
          customerBase={customersWithDebt.find((c) => c.id === selectedCustomerId) || null}
          onBack={onClearSelection}
        />
      </Suspense>
    )
  }

  // ============================================================
  // 🎨 رندر اصلی
  // ============================================================
  return (
    <div className="space-y-3 sm:space-y-4">
      {/* مودال‌ها با Lazy Load */}
      <Suspense fallback={null}>
        <AddCustomerModal open={showAddModal} onClose={onCloseAddModal} onCreated={() => {}} />
        <PaymentModal
          open={showPaymentModal}
          onClose={onClosePayment}
          onPaid={onPaymentSuccess}
          customer={paymentCustomer}
          openInvoices={paymentInvoices}
        />
      </Suspense>

      {/* هدر */}
      <CustomersHeader
        t={t}
        isMobile={isMobile}
        totalCustomers={totalCustomers}
        debtorCount={debtorCount}
        onOpenAddModal={onOpenAddModal}
      />

      {/* KPI — بنتو گرید */}
      {customersStats({
        t,
        fmt,
        totalCustomers,
        totalSales,
        totalDebt,
        topCustomerName,
        topCustomerAmount,
        currency,
        customersDelta,
        salesDelta,
        debtDelta,
        topCustomerDelta,
      })}

      {/* محتوای اصلی */}
      <CustomersContent
        t={t}
        isLoading={isLoading}
        isError={isError}
        errorMessage={errorMessage}
        onRetry={onRetry}
        filtered={filtered}
        isMobile={isMobile}
        currency={currency}
        fmt={fmt}
        onSelectCustomer={onSelectCustomer}
        onExport={handleExportCSV}
        onExportSelected={exportCustomers}
        search={search}
        onSearchChange={onSearchChange}
      />
    </div>
  )
}
