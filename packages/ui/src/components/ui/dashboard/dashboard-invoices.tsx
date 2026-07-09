// packages/ui/src/components/ui/dashboard/dashboard-invoices.tsx
"use client"

import { Button } from "../button"
import { Skeleton } from "../skeleton"
import { Receipt, PlusCircle } from "lucide-react"

interface RecentInvoice {
  id: string
  customer: string
  total: number
  date: string
}

function InvoiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card/50 p-4">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-32 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <Skeleton className="h-4 w-24 rounded-md" />
    </div>
  )
}

function RecentInvoiceRow({
  inv,
  onClick,
}: {
  inv: RecentInvoice
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="interactive-card group flex w-full items-center justify-between rounded-xl p-4 text-start motion-safe:transition-all hover:bg-muted/50"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/15 to-cyan-500/15 text-primary">
          <Receipt className="size-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {inv.customer}
          </p>
          <p className="text-xs text-muted-foreground">{inv.date}</p>
        </div>
      </div>
      <div className="ms-3 shrink-0 font-bold tabular-nums text-foreground">
        {inv.total.toLocaleString()}{" "}
        <span className="text-xs font-normal text-muted-foreground">AFN</span>
      </div>
    </button>
  )
}

function EmptyInvoices({
  onCreate,
  t,
}: {
  onCreate: () => void
  t: (key: string, fallback?: string) => string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-purple-500/15 to-cyan-500/15">
          <Receipt className="size-7 text-primary" aria-hidden />
        </div>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">
          {t("dashboard.empty.title", "آماده‌ی اولین فروش")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("dashboard.empty.subtitle", "یک فاکتور ثبت کن تا ماجرا شروع بشه")}
        </p>
      </div>
      <Button
        onClick={onCreate}
        className="shimmer-btn mt-2 inline-flex items-center gap-2 rounded-xl"
      >
        <PlusCircle className="size-4" aria-hidden />
        {t("invoices.newinvoices", "فاکتور جدید")}
      </Button>
    </div>
  )
}

interface DashboardInvoicesProps {
  t: (key: string, fallback?: string) => string
  invLoading: boolean
  recentInvoices: RecentInvoice[]
  onNavigateInvoice: (id: string) => void
  onNavigateQuickInvoice: () => void
  onViewAllInvoices: () => void
}

export function DashboardInvoices({
  t,
  invLoading,
  recentInvoices,
  onNavigateInvoice,
  onNavigateQuickInvoice,
  onViewAllInvoices,
}: DashboardInvoicesProps) {
  return (
    <div>
      {invLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <InvoiceRowSkeleton key={i} />
          ))}
        </div>
      ) : recentInvoices.length === 0 ? (
        <EmptyInvoices onCreate={onNavigateQuickInvoice} t={t} />
      ) : (
        <div className="space-y-3">
          {recentInvoices.map((inv) => (
            <RecentInvoiceRow
              key={inv.id}
              inv={inv}
              onClick={() => onNavigateInvoice(inv.id)}
            />
          ))}
          <Button
            variant="outline"
            onClick={onViewAllInvoices}
            className="mt-2 w-full rounded-xl border-dashed"
          >
            {t("dashboard.viewAllInvoices", "مشاهده همه فاکتورها")}
          </Button>
        </div>
      )}
    </div>
  )
}