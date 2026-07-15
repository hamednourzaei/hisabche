// packages/ui/src/components/ui/customers/customer-view.tsx
// 🎯 Control Center v7 — Production-Ready, Mobile-First, RTL, Offline-Ready
"use client"

import { useState, useMemo, useCallback, lazy, Suspense, memo } from "react"
import { cn } from "@/lib/utils"
import {
  Plus,
  Search,
  Download,
  Star,
  AlertTriangle,
  DollarSign,
  User,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react"

// Types
import type { CustomersViewProps } from "./customer-view.types"
import type { CustomerWithDebt } from "../../../lib/customers/customers-types"

// Components
import { customersStats } from "./customer-stats"
import { DataGrid } from "./datagrid/datagrid"

// Lazy load modals (برای کاهش bundle size)
// Import عادی (بدون lazy)
import { AddCustomerModal } from "./AddCustomerModal"
import { PaymentModal } from "./PaymentModal"
import { CustomerWorkspaceContainer } from "./containers/customer-workspace-container"

// ============================================================
// 🧰 Utilities
// ============================================================

/** تاریخ را با فرمت فارسی و RTL نمایش می‌دهد */
function formatDate(value: unknown, locale = "fa-IR"): string {
  if (!value) return "-"
  try {
    const d = value instanceof Date ? value : new Date(value as string)
    if (isNaN(d.getTime())) return "-"
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  } catch {
    return "-"
  }
}

/** هوک تشخیص موبایل با hydration safety */
function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useState(() => {
    if (typeof window === "undefined") return
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    const handler = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  })

  return isMobile
}

// ============================================================
// 🎯 Filters & Columns (ثابت برای جلوگیری از re-render)
// ============================================================

const SMART_FILTERS = [
  { id: "all", icon: User, labelKey: "customers.filterAll", fallback: "همه" },
  {
    id: "debtors",
    icon: DollarSign,
    labelKey: "customers.filterDebtors",
    fallback: "بدهکار",
  },
  { id: "vip", icon: Star, labelKey: "customers.filterVip", fallback: "VIP" },
  {
    id: "overdue",
    icon: AlertTriangle,
    labelKey: "customers.filterOverdue",
    fallback: "عقب‌افتاده",
  },
] as const

type FilterId = (typeof SMART_FILTERS)[number]["id"]

/** منطق فیلتر (خالص - بدون side effect) */
function filterCustomers(
  customers: CustomerWithDebt[],
  search: string,
  filterId: FilterId
): CustomerWithDebt[] {
  let result = customers

  if (search.trim()) {
    const term = search.toLowerCase()
    result = result.filter(
      (c) =>
        (c.fullName || c.name || "").toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term)
    )
  }

  switch (filterId) {
    case "vip":
      return result.filter((c) =>
        (c as CustomerWithDebt & { tags?: string[] }).tags?.includes("vip")
      )
    case "debtors":
      return result.filter((c) => (c.totalDebt || 0) > 0)
    case "overdue":
      return result.filter(
        (c) => (c as CustomerWithDebt & { isOverdue?: boolean }).isOverdue === true
      )
    default:
      return result
  }
}

/** تولید ستون‌های دیتاگرید (با useMemo در کامپوننت) */
function getCustomerColumns(
  t: (key: string, fallback?: string) => string,
  fmt: (v: number) => string,
  currency: string,
  onSelect: (id: string) => void
) {
  return [
    {
      id: "name",
      header: t("customers.customer", "مشتری"),
      accessor: (row: CustomerWithDebt) => row.fullName || row.name || "",
      render: (value: string, row: CustomerWithDebt) => (
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => onSelect(row.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onSelect(row.id)
            }
          }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)]">
            <span className="text-sm font-bold text-[hsl(var(--color-primary))]">
              {value.charAt(0) || "?"}
            </span>
          </div>
          <p className="text-sm font-semibold text-[hsl(var(--fg-primary))] hover:text-[hsl(var(--color-primary))]">
            {value}
          </p>
        </div>
      ),
    },
    {
      id: "phone",
      header: t("customers.phone", "تلفن"),
      accessor: (row: CustomerWithDebt) => row.phone || "-",
      width: 130,
    },
    {
      id: "debt",
      header: t("customers.debt", "بدهی"),
      accessor: (row: CustomerWithDebt) => row.totalDebt || 0,
      type: "currency" as const,
      align: "right" as const,
      width: 120,
      render: (value: number) => (
        <span
          className={
            value > 0
              ? "font-bold tabular-nums text-[hsl(var(--color-destructive))]"
              : "tabular-nums text-[hsl(var(--color-success))]"
          }
        >
          {value > 0 ? fmt(value) : "۰"} {currency}
        </span>
      ),
    },
    {
      id: "lastPurchase",
      header: t("customers.lastPurchase", "آخرین خرید"),
      accessor: (row: CustomerWithDebt) =>
        (row as CustomerWithDebt & { lastInvoiceDate?: string }).lastInvoiceDate ||
        null,
      width: 120,
      render: (value: string) => (
        <span className="text-sm text-[hsl(var(--fg-secondary))]">
          {formatDate(value)}
        </span>
      ),
    },
    {
      id: "openCount",
      header: t("customers.openInvoices", "باز"),
      accessor: (row: CustomerWithDebt) => row.openCount || 0,
      align: "center" as const,
      width: 50,
    },
    {
      id: "status",
      header: t("customers.status", "وضعیت"),
      accessor: (row: CustomerWithDebt) =>
        (row.totalDebt || 0) > 0 ? "debtor" : "settled",
      type: "badge" as const,
      width: 90,
    },
  ]
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
            "font-bold text-[hsl(var(--fg-primary))] text-wrap-balance",
            isMobile ? "text-lg" : "text-2xl sm:text-3xl"
          )}
        >
          {t("customers.title", "باقیداری")}
        </h1>
        {isMobile ? (
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {totalCustomers} {t("customers.customers", "مشتری")} • {debtorCount}{" "}
            {t("customers.debtors", "بدهکار")}
          </p>
        ) : (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t("customers.subtitle", "مدیریت بدهی‌ها و پرداخت‌ها")}
          </p>
        )}
      </div>
      <button
        onClick={onOpenAddModal}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-all duration-150"
        aria-label={t("customers.addCustomer", "افزودن مشتری")}
      >
        <Plus className="size-4" />
        <span className={cn(isMobile && "hidden sm:inline")}>
          {t("customers.addCustomer", "افزودن مشتری")}
        </span>
      </button>
    </div>
  )
}

/** دکمه‌ی فیلتر */
function FilterButton({
  filter,
  isActive,
  onClick,
  t,
}: {
  filter: (typeof SMART_FILTERS)[number]
  isActive: boolean
  onClick: () => void
  t: (key: string, fallback?: string) => string
}) {
  const Icon = filter.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-all",
        isActive
          ? "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]"
          : "border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]"
      )}
      aria-label={t(filter.labelKey, filter.fallback)}
      aria-pressed={isActive}
    >
      <Icon className="size-3" />
      {t(filter.labelKey, filter.fallback)}
    </button>
  )
}

/** نوار ابزار (جستجو + فیلترها) */
function CustomersToolbar({
  t,
  search,
  onSearchChange,
  activeFilter,
  onFilterChange,
  isMobile,
  expanded,
  onToggleExpanded,
  onExport,
}: {
  t: (key: string, fallback?: string) => string
  search: string
  onSearchChange: (value: string) => void
  activeFilter: FilterId
  onFilterChange: (id: FilterId) => void
  isMobile: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onExport: () => void
}) {
  const visibleFilters = isMobile && !expanded ? SMART_FILTERS.slice(0, 2) : SMART_FILTERS

  return (
    <div className="space-y-2">
      {/* جستجو */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))]" />
        <input
          type="text"
          placeholder={t("customers.searchPlaceholder", "جستجوی نام، شماره...")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-xl ps-9 pe-4 py-2.5 text-sm border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] transition-shadow duration-150 focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:shadow-[var(--focus-ring)]"
          aria-label={t("customers.searchPlaceholder", "جستجوی نام، شماره...")}
        />
      </div>

      {/* فیلترها */}
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {visibleFilters.map((f) => (
          <FilterButton
            key={f.id}
            filter={f}
            isActive={activeFilter === f.id}
            onClick={() => onFilterChange(f.id)}
            t={t}
          />
        ))}

        {!isMobile && (
          <>
            <span className="w-px h-5 bg-[hsl(var(--border-default))] mx-1" />
            <button
              onClick={onExport}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
              aria-label={t("common.export", "خروجی")}
            >
              <Download className="size-3" />
              {t("common.export", "خروجی")}
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
              aria-label={t("common.columns", "ستون‌ها")}
            >
              <LayoutGrid className="size-3" />
              {t("common.columns", "ستون‌ها")}
            </button>
          </>
        )}

        {isMobile && (
          <button
            onClick={onToggleExpanded}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium border whitespace-nowrap transition-all shrink-0",
              expanded
                ? "border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]"
                : "border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))]"
            )}
            aria-label={expanded ? t("common.less", "کمتر") : t("common.more", "بیشتر")}
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? t("common.less", "کمتر") : t("common.more", "بیشتر")}
          </button>
        )}
      </div>

      {/* فیلترهای توسعه‌یافته در موبایل */}
      {isMobile && expanded && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {SMART_FILTERS.slice(2).map((f) => (
            <FilterButton
              key={f.id}
              filter={f}
              isActive={activeFilter === f.id}
              onClick={() => onFilterChange(f.id)}
              t={t}
            />
          ))}
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
            aria-label={t("common.export", "خروجی")}
          >
            <Download className="size-3" />
            {t("common.export", "خروجی")}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
            aria-label={t("common.columns", "ستون‌ها")}
          >
            <LayoutGrid className="size-3" />
            {t("common.columns", "ستون‌ها")}
          </button>
        </div>
      )}
    </div>
  )
}

/** کارت مشتری در موبایل (با memo) */
const CustomerCard = memo(function CustomerCard({
  customer,
  t,
  fmt,
  currency,
  onSelect,
}: {
  customer: CustomerWithDebt
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  currency: string
  onSelect: (id: string) => void
}) {
  const hasDebt = (customer.totalDebt || 0) > 0
  const name = customer.fullName || customer.name || "?"

  return (
    <div
      onClick={() => onSelect(customer.id)}
      className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 active:scale-[0.98] transition-transform cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`${t("customers.customer", "مشتری")} ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(customer.id)
        }
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)]">
            <span className="text-sm font-bold text-[hsl(var(--color-primary))]">
              {name.charAt(0)}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{name}</p>
            {customer.phone && (
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">{customer.phone}</p>
            )}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
            hasDebt
              ? "bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))]"
              : "bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]"
          )}
        >
          {hasDebt ? t("customers.debtor", "بدهکار") : t("customers.settled", "تسویه")}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-[hsl(var(--fg-secondary))]">
        <span>
          {customer.openCount || 0} {t("customers.openInvoices", "فاکتور باز")}
        </span>
        {hasDebt && (
          <span className="font-bold text-[hsl(var(--color-destructive))]">
            {fmt(customer.totalDebt || 0)} {currency}
          </span>
        )}
      </div>
    </div>
  )
})

/** حالت‌های داده */
function LoadingSkeleton({
  isMobile,
  t,
}: {
  isMobile: boolean
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div className={cn("space-y-2", isMobile ? "p-2" : "p-4")}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-lg bg-[hsl(var(--surface-muted))] animate-pulse",
            isMobile ? "h-20" : "h-12"
          )}
          aria-busy="true"
          aria-label={t("common.loading", "در حال بارگذاری")}
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
        {t("customers.empty.title", "هیچ مشتری‌ای یافت نشد")}
      </p>
      {!isMobile && (
        <p className="text-xs text-[hsl(var(--fg-tertiary))] mt-1">
          {t("customers.empty.subtitle", "با افزودن مشتری جدید شروع کنید")}
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
        {t("common.retry", "تلاش مجدد")}
      </button>
    </div>
  )
}

/** محتوای اصلی (با مدیریت ۵ حالت) */
function CustomersContent({
  t,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  filtered,
  isMobile,
  currency,
  fmt,
  onSelectCustomer,
  getColumns,
}: {
  t: (key: string, fallback?: string) => string
  isLoading: boolean
  isError: boolean
  errorMessage: string
  onRetry: () => void
  filtered: CustomerWithDebt[]
  isMobile: boolean
  currency: string
  fmt: (v: number) => string
  onSelectCustomer: (id: string) => void
  getColumns: typeof getCustomerColumns
}) {
  const columns = useMemo(
    () => getColumns(t, fmt, currency, onSelectCustomer),
    [t, fmt, currency, onSelectCustomer, getColumns]
  )

  return (
    <div
      className={cn(
        "rounded-2xl border border-[hsl(var(--border-default))]",
        "bg-[hsl(var(--surface-elevated))]",
        "shadow-[var(--shadow-premium)]",
        "overflow-hidden"
      )}
    >
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.4)]">
          <span className="text-xs font-medium text-[hsl(var(--fg-secondary))]">
            {filtered.length} {t("customers.customers", "مشتری")}
          </span>
        </div>
      )}

      <div className={cn(!isMobile && "p-0", isMobile && "p-2")}>
        {/* ۵ حالت داده */}
        {isLoading && <LoadingSkeleton isMobile={isMobile} t={t} />}
        {isError && !isLoading && (
          <ErrorState t={t} message={errorMessage} onRetry={onRetry} />
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState t={t} isMobile={isMobile} />
        )}
        {!isLoading && !isError && filtered.length > 0 && (
          <>
            {isMobile ? (
              <div className="space-y-2">
                {filtered.map((c) => (
                  <CustomerCard
                    key={c.id}
                    customer={c}
                    t={t}
                    fmt={fmt}
                    currency={currency}
                    onSelect={onSelectCustomer}
                  />
                ))}
              </div>
            ) : (
              <DataGrid t={t} columns={columns} data={filtered} />
            )}
          </>
        )}
      </div>
    </div>
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
    openDealsCount,
    isLoading,
    isError = false,
    errorMessage = "",
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
    currency = "AFN",
  } = props

  const [activeFilter, setActiveFilter] = useState<FilterId>("all")
  const [expanded, setExpanded] = useState(false)
  const isMobile = useIsMobile()

  // فیلتر کردن با useMemo
  const filtered = useMemo(
    () => filterCustomers(customersWithDebt, search, activeFilter),
    [customersWithDebt, search, activeFilter]
  )

  // خروجی CSV
  const handleExportCSV = useCallback(() => {
    const headers = [`نام`, `تلفن`, `بدهی (${currency})`, `فاکتور باز`, `آخرین خرید`, `وضعیت`]
    const rows = filtered.map((c) => [
      c.fullName || c.name || "",
      c.phone || "",
      String(c.totalDebt || 0),
      String(c.openCount || 0),
      formatDate((c as CustomerWithDebt & { lastInvoiceDate?: string }).lastInvoiceDate),
      (c.totalDebt || 0) > 0 ? "بدهکار" : "تسویه",
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, currency])

  // اگر کاربر workspace را انتخاب کرده
  if (selectedCustomerId) {
    return (
      <Suspense fallback={<LoadingSkeleton isMobile={isMobile} t={t} />}>
        <CustomerWorkspaceContainer
          customerId={selectedCustomerId}
          customerBase={
            customersWithDebt.find((c) => c.id === selectedCustomerId) || null
          }
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
        <AddCustomerModal
          open={showAddModal}
          onClose={onCloseAddModal}
          onCreated={() => {}}
        />
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

      {/* نوار ابزار */}
      <CustomersToolbar
        t={t}
        search={search}
        onSearchChange={onSearchChange}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        isMobile={isMobile}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((prev) => !prev)}
        onExport={handleExportCSV}
      />

      {/* KPI */}
      <div className={isMobile ? "flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" : ""}>
        {customersStats({
          t,
          fmt,
          totalCustomers,
          totalDebt,
          overdueCount,
          vipCount,
          todaySales,
          currency,
          isMobile,
        })}
      </div>

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
        getColumns={getCustomerColumns}
      />
    </div>
  )
}