"use client"

import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useCustomers, useInvoices } from "@hisabche/api"
import { CustomerDetailView } from "../CustomerDetailView"

const fmt = (v: number): string => v.toLocaleString("fa-AF")
const rem = (inv: { total: number; paidAmount: number }): number => Math.max(0, inv.total - inv.paidAmount)
const fmtDate = (d: string): string => { try { return new Date(d).toLocaleDateString("fa-AF") } catch { return d } }

interface ApiInvoiceRecord { id: string; invoiceNumber?: string; total: number; paidAmount: number; date: string; status: string; customerId: string }
interface CustomerRecord { id: string; fullName?: string; name?: string; phone?: string }

export function CustomerDetailContainer({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const [payOpen, setPayOpen] = useState(false)

  const { data: customersData } = useCustomers({ page: 1, limit: 50, sortDirection: "desc" })
  const { data: invoicesData, refetch } = useInvoices({ page: 1, limit: 200, sortDirection: "desc" })

  const customer = useMemo(() => {
    const list = (customersData?.customers ?? []) as unknown as CustomerRecord[]
    const found = list.find((c) => c.id === customerId)
    if (!found) return null
    return {
      id: found.id,
      name: found.fullName || found.name || t("common.noName"),
      phone: found.phone || "",
    }
  }, [customersData, customerId, t])

  const openInvoices = useMemo(() => {
    const list = (invoicesData?.invoices ?? []) as unknown as ApiInvoiceRecord[]
    return list
      .filter((inv) => inv.customerId === customerId && (inv.status === "pending" || inv.status === "partial"))
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber ?? "",
        total: inv.total,
        paidAmount: inv.paidAmount,
        remaining: rem(inv),
        date: fmtDate(inv.date),
        status: inv.status,
      }))
  }, [invoicesData, customerId])

  const totalDebt = openInvoices.reduce((s, inv) => s + inv.remaining, 0)

  const safeT = (key: string, fallback?: string) => { const v = t(key); return v && v !== key ? v : (fallback ?? key) }

  return (
    <CustomerDetailView
      t={safeT}
      fmt={fmt}
      customer={customer as any}
      openInvoices={openInvoices as any}
      totalDebt={totalDebt}
      payOpen={payOpen}
      onBack={onBack}
      onOpenPayment={() => setPayOpen(true)}
      onClosePayment={() => setPayOpen(false)}
      onPaymentSuccess={refetch}
    />
  )
}