// packages/ui/src/components/ui/invoices/invoices-view.tsx
"use client"

import { Button } from "../button"
import { Input } from "../input"
import { EmptyState } from "../empty-state"
import { InvoicesSkeleton } from "./invoices-skeleton"
import { Plus, Search } from "lucide-react"
import { InvoiceCard } from "./invoices-card"
import type { Invoice } from "../../../lib/invoices/invoices-types"

interface InvoicesViewProps {
  t: (key: string, fallback?: string) => string
  invoices: Invoice[]
  isLoading: boolean
  total: number
  filters: { page: number; limit: number }
  onSearchChange: (value: string) => void
  onClearFilters: () => void
  onPageChange: (page: number) => void
  onNavigateInvoice: (id: string) => void
  onNewInvoice: () => void
  onDeleteInvoice: (id: string) => void
  statusVariant: (status: string) => "success" | "warning" | "destructive" | "secondary"
}

export function InvoicesView({
  t,
  invoices,
  isLoading,
  total,
  filters,
  onSearchChange,
  onClearFilters,
  onPageChange,
  onNavigateInvoice,
  onNewInvoice,
  onDeleteInvoice,
  statusVariant,
}: InvoicesViewProps) {
  if (isLoading) {
    return <InvoicesSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl text-foreground">
            {t("faktoor.title", "فاکتورها")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("faktoor.description", "مدیریت و مشاهده فاکتورها")}
          </p>
        </div>
        <Button onClick={onNewInvoice} className="shimmer-btn gap-2">
          <Plus className="size-4" aria-hidden />
          {t("faktoor.newFaktoor", "فاکتور جدید")}
        </Button>
      </div>

      {/* Search + Clear */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="max-w-sm">
          <Input
            placeholder={t("action.search", "جستجو")}
            leftIcon={<Search className="size-4" aria-hidden />}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          {t("action.clear", "پاک کردن")}
        </Button>
      </div>

      {/* Invoice cards */}
      {invoices.length === 0 ? (
        <EmptyState
          icon="invoice"
          title={t("faktoor.noFaktoors", "هیچ فاکتوری یافت نشد")}
          description={t("faktoor.noFaktoorsDesc", "هنوز هیچ فاکتوری ثبت نشده است.")}
          action={{ label: t("faktoor.newFaktoor", "فاکتور جدید"), onClick: onNewInvoice }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {invoices.map((inv) => (
            <InvoiceCard
              key={inv.id}
              inv={inv}
              onNavigate={onNavigateInvoice}
              onDelete={onDeleteInvoice}
              statusVariant={statusVariant}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 10 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page === 1}
            onClick={() => onPageChange(filters.page - 1)}
          >
            {t("action.previous", "قبلی")}
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            {filters.page} / {Math.ceil(total / 10)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page * 10 >= total}
            onClick={() => onPageChange(filters.page + 1)}
          >
            {t("action.next", "بعدی")}
          </Button>
        </div>
      )}
    </div>
  )
}