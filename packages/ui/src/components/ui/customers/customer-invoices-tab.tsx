// packages/ui/src/components/ui/customers/customer-invoices-tab.tsx
"use client"

import { FileText, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

interface CustomerInvoicesTabProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  openInvoices: any[]
  totalDebt: number
  onOpenPayment: () => void
}

const cardBase = "rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-sm"
const ghostBtn = "inline-flex items-center justify-center rounded-full p-2 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none"

export function CustomerInvoicesTab({ t, fmt, openInvoices, totalDebt, onOpenPayment }: CustomerInvoicesTabProps) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      
      {/* Debt Card */}
      {totalDebt > 0 && (
        <div className={cn(cardBase, "bg-gradient-to-br from-[hsl(var(--color-destructive)/0.12)] to-[hsl(var(--color-destructive)/0.03)]")}>
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-[hsl(var(--fg-secondary))]">
                {t("customers.totalDebt", "کل بدهی")}
              </p>
              <p className="text-3xl font-bold tabular-nums text-[hsl(var(--color-destructive))]">
                {fmt(totalDebt)} AFN
              </p>
            </div>
            <div className="flex gap-3 text-xs text-[hsl(var(--fg-secondary))]">
              <span>
                {openInvoices.length} {t("customers.openInvoices", "فاکتور باز")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No Debt */}
      {totalDebt === 0 && (
        <div className={cn(cardBase, "bg-gradient-to-br from-[hsl(var(--color-success)/0.08)] to-[hsl(var(--color-success)/0.02)]")}>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--color-success)/0.12)]">
              <FileText className="size-6 text-[hsl(var(--color-success))]" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-[hsl(var(--color-success))]">
              {t("customers.noDebt", "تمامی فاکتورها پرداخت شده‌اند")}
            </p>
          </div>
        </div>
      )}

      {/* Invoices List */}
      {openInvoices.length > 0 && (
        <div className={cardBase}>
          <div className="p-5">
            <h3 className="mb-4 text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {t("customers.invoices", "فاکتورها")}
            </h3>
            <div className="space-y-3">
              {openInvoices.map((inv: any) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-destructive)/0.1)]">
                      <FileText className="size-4 text-[hsl(var(--color-destructive))]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[hsl(var(--fg-primary))]">
                        #{inv.invoiceNumber || inv.invoice_number}
                      </p>
                      <p className="text-xs text-[hsl(var(--fg-secondary))]">
                        {new Date(inv.date || inv.created_at).toLocaleDateString('fa-IR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-end">
                      <p className="font-bold tabular-nums text-[hsl(var(--color-destructive))]">
                        {fmt((inv.total || 0) - (inv.paidAmount || inv.paid_amount || 0))} AFN
                      </p>
                      <p className="text-xs text-[hsl(var(--fg-secondary))]">
                        {t("customers.ofTotal", `از ${fmt(inv.total || 0)}`)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenPayment}
                      className={ghostBtn}
                      aria-label={t("customers.pay", "پرداخت")}
                    >
                      <DollarSign className="size-4 text-[hsl(var(--color-success))]" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}