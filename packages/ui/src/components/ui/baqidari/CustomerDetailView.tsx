"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useCustomers, useInvoices } from "@hisabche/api"
import { Button, Card, CardContent } from "@hisabche/ui"
import { ChevronRight, DollarSign } from "lucide-react"
import { PaymentModal } from "./PaymentModal"

interface InvoiceRecord { id: string; invoiceNumber?: string; total: number; paidAmount: number; date: string; status: string; customerId: string }
interface CustomerRecord { id: string; fullName?: string; name?: string; phone?: string }

const fmt = (v: number): string => v.toLocaleString("fa-AF")
const rem = (inv: InvoiceRecord): number => Math.max(0, inv.total - inv.paidAmount)
const fmtDate = (d: string): string => { try { return new Date(d).toLocaleDateString("fa-AF") } catch { return d } }
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

export function CustomerDetailView({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const [payOpen, setPayOpen] = useState(false)

  const { data: customersData } = useCustomers({ page: 1, limit: 50, sortDirection: "desc" })
  const { data: invoicesData, refetch } = useInvoices({ page: 1, limit: 200, sortDirection: "desc" })

  const customer = useMemo(() => {
    const list = (customersData?.customers ?? []) as unknown as CustomerRecord[]
    return list.find((c) => c.id === customerId) ?? null
  }, [customersData, customerId])

  const openInvoices = useMemo(() => {
    const list = (invoicesData?.invoices ?? []) as unknown as InvoiceRecord[]
    return list.filter((inv) => inv.customerId === customerId && (inv.status === "pending" || inv.status === "partial"))
  }, [invoicesData, customerId])

  const totalDebt = openInvoices.reduce((s, inv) => s + rem(inv), 0)

  if (!customer) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-[var(--hisab-muted-fg)]">{t("baqidari.notFound")}</p>
        <Button variant="outline" size="sm" onClick={onBack}>{t("common.back")}</Button>
      </div>
    )
  }

  const name = customer.fullName || customer.name || t("common.noName")

  return (
    <div className="space-y-6">
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} onPaid={refetch}
        openInvoices={openInvoices} customer={customer} />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label={t("common.back")}>
          <ChevronRight className="size-5" aria-hidden />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          {customer.phone && <p className="text-sm text-[var(--hisab-muted-fg)]">{customer.phone}</p>}
        </div>
      </div>

      <Card className="interactive-card">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs text-[var(--hisab-muted-fg)]">{t("baqidari.totalDebt")}</p>
            <p className="text-3xl font-bold tabular-nums text-[var(--hisab-destructive)]">{fmt(totalDebt)} AFN</p>
          </div>
          <Button onClick={() => setPayOpen(true)} icon={<DollarSign className="size-4" />} disabled={totalDebt <= 0}>
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
                    <p className="font-medium">#{inv.invoiceNumber ?? ""}</p>
                    <p className="text-xs text-[var(--hisab-muted-fg)]">{fmtDate(inv.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-[var(--hisab-destructive)]">{fmt(rem(inv))} AFN</p>
                    <p className="text-xs text-[var(--hisab-muted-fg)]">{t("baqidari.ofPaid", { total: fmt(inv.total), paid: fmt(inv.paidAmount) })}</p>
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