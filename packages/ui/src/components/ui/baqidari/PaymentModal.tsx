"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { useCreateTransaction } from "@hisabche/api"
import { Button, Input } from "@hisabche/ui"
import { DollarSign } from "lucide-react"
import { Modal } from "../Modal"

interface InvoiceRecord { id: string; invoiceNumber?: string; total: number; paidAmount: number; date: string; status: string; customerId: string }
interface CustomerWithDebt { id: string; fullName?: string; name?: string; phone?: string }

const toNum = (v: string): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: number): string => v.toLocaleString("fa-AF")
const remaining = (inv: InvoiceRecord): number => Math.max(0, inv.total - inv.paidAmount)

const paymentSchema = z.object({
  amount: z.number().positive(),
  invoiceId: z.string().min(1),
  customerId: z.string().min(1),
})

interface Props {
  open: boolean; onClose: () => void; onPaid?: () => void
  customer: CustomerWithDebt | null
  openInvoices: InvoiceRecord[]
}

export function PaymentModal({ open, onClose, onPaid, customer, openInvoices }: Props) {
  const { t } = useTranslation()
  const createTx = useCreateTransaction()
  const [amount, setAmount] = useState("")
  const [invoiceId, setInvoiceId] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setInvoiceId(openInvoices.length === 1 ? (openInvoices[0]?.id ?? "") : "")
    setAmount(""); setError(null)
  }, [open, customer?.id, openInvoices])

  const suggested = useMemo(() => {
    const inv = openInvoices.find((i) => i.id === invoiceId)
    if (inv) return remaining(inv)
    return openInvoices.length ? Math.min(...openInvoices.map(remaining)) : 0
  }, [openInvoices, invoiceId])

  const submit = useCallback(async () => {
    if (!customer?.id) return
    const payAmount = toNum(amount) || suggested
    const targetInvoice = invoiceId || openInvoices[0]?.id || ""
    const parsed = paymentSchema.safeParse({ amount: payAmount, invoiceId: targetInvoice, customerId: customer.id })
    if (!parsed.success) { setError(t("baqidari.form.invalidPayment")); return }
    try {
      await createTx.mutateAsync({
        customerId: parsed.data.customerId, type: "payment", amount: parsed.data.amount,
        currency: "AFN", date: new Date().toISOString(), reference: parsed.data.invoiceId,
        description: t("baqidari.paymentFrom", { name: customer.fullName || customer.name || "" }),
      })
      onPaid?.(); onClose()
    } catch { setError(t("common.saveError")) }
  }, [customer, amount, suggested, invoiceId, openInvoices, createTx, onPaid, onClose, t])

  if (!customer) return null
  const name = customer.fullName || customer.name || t("common.noName")

  return (
    <Modal open={open} onClose={onClose} title={`${t("baqidari.recordPayment")} — ${name}`} size="sm">
      {openInvoices.length > 1 && (
        <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} aria-label={t("baqidari.selectInvoice")}
          className="w-full rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-4 py-3 text-sm">
          <option value="">{t("baqidari.selectInvoice")}</option>
          {openInvoices.map((inv) => <option key={inv.id} value={inv.id}>#{inv.invoiceNumber ?? ""} — {fmt(remaining(inv))} AFN</option>)}
        </select>
      )}
      <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
        placeholder={`${t("baqidari.form.default")}: ${fmt(suggested)} AFN`} label={t("baqidari.form.paymentAmount")}
        leftIcon={<DollarSign className="size-4" aria-hidden />} autoFocus />
      {error && <p role="alert" className="text-sm text-[var(--hisab-destructive)]">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="w-full" onClick={onClose}>{t("common.cancel")}</Button>
        <Button className="w-full" onClick={submit} loading={createTx.isPending}>{t("baqidari.recordPayment")}</Button>
      </div>
    </Modal>
  )
}