"use client"

import { Button, Card, CardContent } from "@hisabche/ui"
import { ChevronRight, DollarSign } from "lucide-react"
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
  t, fmt, customer, openInvoices, totalDebt, payOpen,
  onBack, onOpenPayment, onClosePayment, onPaymentSuccess,
}: CustomerDetailViewProps) {
  if (!customer) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-[var(--hisab-muted-fg)]">{t("baqidari.notFound")}</p>
        <Button variant="outline" size="sm" onClick={onBack}>{t("common.back")}</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PaymentModal open={payOpen} onClose={onClosePayment} onPaid={onPaymentSuccess}
  openInvoices={openInvoices as any} customer={customer as any} />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label={t("common.back")}>
          <ChevronRight className="size-5" aria-hidden />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          {customer.phone && <p className="text-sm text-[var(--hisab-muted-fg)]">{customer.phone}</p>}
        </div>
      </div>

      <Card className="interactive-card">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs text-[var(--hisab-muted-fg)]">{t("baqidari.totalDebt")}</p>
            <p className="text-3xl font-bold tabular-nums text-[var(--hisab-destructive)]">{fmt(totalDebt)} AFN</p>
          </div>
          <Button onClick={onOpenPayment} icon={<DollarSign className="size-4" />} disabled={totalDebt <= 0}>
            {t("baqidari.recordPayment")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-4 text-lg font-semibold">{t("baqidari.openDealsTitle")}</h2>
          {openInvoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--hisab-muted-fg)]">{t("baqidari.noOpenDeals")}</p>
          ) : (
            <div className="space-y-3">
              {openInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-xl border border-[var(--hisab-border)] p-4">
                  <div>
                    <p className="font-medium">#{inv.invoiceNumber}</p>
                    <p className="text-xs text-[var(--hisab-muted-fg)]">{inv.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-[var(--hisab-destructive)]">{fmt(inv.remaining)} AFN</p>
                    <p className="text-xs text-[var(--hisab-muted-fg)]">
  {t("baqidari.ofPaid", `از ${fmt(inv.total)} مبلغ ${fmt(inv.paidAmount)} پرداخت شده`)}
</p>
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