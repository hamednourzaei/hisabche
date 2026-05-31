"use client"

import { Button, Badge, Card, CardContent, EmptyState, Input } from "@hisabche/ui"
import { Plus, Search, Trash2, Eye, FileText } from "lucide-react"

interface Invoice {
  id: string
  invoiceNumber: string
  date: string
  status: string
  total: number
  currency: string
}

export interface InvoicesPageProps {
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
  statusVariant: (
    status: string
  ) => "success" | "warning" | "destructive" | "secondary"
}

export function InvoicesPage({
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
}: InvoicesPageProps) {
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {t("faktoor.title")}
          </h1>
          <p className="text-sm text-[var(--hisab-muted-fg)]">
            {t("faktoor.description", "مدیریت و مشاهده فاکتورها")}
          </p>
        </div>
        <Button
          onClick={onNewInvoice}
          icon={<Plus className="size-4" aria-hidden />}
          className="shimmer-btn"
        >
          {t("faktoor.newFaktoor")}
        </Button>
      </div>

      {/* ── Search + Clear ── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder={t("action.search")}
          leftIcon={<Search className="size-4" aria-hidden />}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          {t("action.clear")}
        </Button>
      </div>

      {/* ── Invoice cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-shimmer h-44 rounded-2xl" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon="invoice"
          title={t("faktoor.noFaktoors")}
          description={t(
            "faktoor.noFaktoorsDesc",
            "هنوز هیچ فاکتوری ثبت نشده است."
          )}
          action={{
            label: t("faktoor.newFaktoor"),
            onClick: onNewInvoice,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              onClick={() => onNavigateInvoice(inv.id)}
              className="cursor-pointer"
            >
              <Card className="interactive-card h-full">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 text-start">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--hisab-primary)]/10">
                        <FileText
                          className="size-5 text-[var(--hisab-primary)]"
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          #{inv.invoiceNumber}
                        </p>
                        <p className="text-xs text-[var(--hisab-muted-fg)]">
                          {inv.date}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={statusVariant(inv.status)}
                      size="sm"
                    >
                      {t(`faktoor.${inv.status}`)}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-xs text-[var(--hisab-muted-fg)]">
                      {t("faktoor.total")}
                    </p>
                    <p className="text-2xl font-bold tabular-nums">
                      {inv.total.toLocaleString()} {inv.currency}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onNavigateInvoice(inv.id)
                      }}
                      aria-label={t("action.view")}
                    >
                      <Eye className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="ghost-btn ghost-danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteInvoice(inv.id)
                      }}
                      aria-label={t("action.delete")}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {total > 10 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page === 1}
            onClick={() => onPageChange(filters.page - 1)}
          >
            {t("action.previous")}
          </Button>
          <span className="text-sm tabular-nums text-[var(--hisab-muted-fg)]">
            {filters.page} / {Math.ceil(total / 10)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page * 10 >= total}
            onClick={() => onPageChange(filters.page + 1)}
          >
            {t("action.next")}
          </Button>
        </div>
      )}
    </div>
  )
}