"use client"

import { Button } from "../button"
import { Card, CardContent } from "../card"
import { ChevronRight, DollarSign, FileText } from "lucide-react"
import { PaymentModal } from "./PaymentModal"

interface InvoiceRecord {
  id: string
  invoiceNumber: string
  total: number
  paidAmount: number
  remaining: number
  date: string
  status: string
}

interface CustomerInfo {
  id: string
  name: string
  phone?: string
}

export interface CustomerDetailViewProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  customer: CustomerInfo | null
  openInvoices: InvoiceRecord[]
  totalDebt: number
  payOpen: boolean
  onBack: () => void
  onOpenPayment: () => void
  onClosePayment: () => void
  onPaymentSuccess: () => void
}

export function CustomerDetailView({
  t,
  fmt,
  customer,
  openInvoices,
  totalDebt,
  payOpen,
  onBack,
  onOpenPayment,
  onClosePayment,
  onPaymentSuccess,
}: CustomerDetailViewProps) {
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <FileText className="size-7 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">{t("baqidari.notFound")}</p>
          <p className="text-sm text-muted-foreground">
            {t("baqidari.notFoundDesc", "مشتری مورد نظر یافت نشد")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack}>
          {t("common.back")}
        </Button>
      </div>
    )
  }

  // تبدیل customer به فرمت مورد انتظار PaymentModal
  const paymentCustomer = {
    id: customer.id,
    fullName: customer.name,
    name: customer.name,
    phone: customer.phone || "", // تبدیل undefined به string خالی
  }

  return (
    <div className="space-y-6">
      <PaymentModal
        open={payOpen}
        onClose={onClosePayment}
        onPaid={onPaymentSuccess}
        customer={paymentCustomer}
        openInvoices={openInvoices as any}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label={t("common.back")}
          >
            <ChevronRight className="size-5" aria-hidden />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
            {customer.phone && (
              <p className="text-sm text-muted-foreground">{customer.phone}</p>
            )}
          </div>
        </div>
        {totalDebt > 0 && (
          <Button
            onClick={onOpenPayment}
            className="shimmer-btn w-full sm:w-auto"
          >
            <DollarSign className="me-2 size-4" aria-hidden />
            {t("baqidari.recordPayment")}
          </Button>
        )}
      </div>

      <Card className="glass-card bg-gradient-to-br from-rose-500/10 to-rose-500/[0.02] border-border">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t("baqidari.totalDebt")}
            </p>
            <p className="text-3xl font-bold tabular-nums text-rose-500">
              {fmt(totalDebt)} AFN
            </p>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>
              {t("baqidari.openInvoicesCount", `${openInvoices.length} فاکتور باز`)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border">
        <CardContent className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {t("baqidari.openDealsTitle")}
          </h2>
          {openInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-2xl" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
                  <FileText className="size-6 text-emerald-500" aria-hidden />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("baqidari.noOpenDeals")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {openInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/10 to-rose-500/[0.02]">
                      <FileText className="size-4 text-rose-500" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        #{inv.invoiceNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inv.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:text-end">
                    <div>
                      <p className="font-bold tabular-nums text-rose-500">
                        {fmt(inv.remaining)} AFN
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("baqidari.ofPaid", `از ${fmt(inv.total)} مبلغ ${fmt(inv.paidAmount)} پرداخت شده`)}
                      </p>
                    </div>
                    {inv.remaining > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenPayment}
                        aria-label={t("baqidari.payInvoice", `پرداخت فاکتور #${inv.invoiceNumber}`)}
                      >
                        <DollarSign className="size-4 text-emerald-500" aria-hidden />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}