"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { useCreateTransaction } from "@hisabche/api"
import { Button, Input, SaveIndicator } from "@hisabche/ui"
import { useSyncStore, useBackupStore } from "@hisabche/store"
import { DollarSign, AlertTriangle, RefreshCw } from "lucide-react"
import { Modal } from "../Modal"

interface InvoiceRecord {
  id: string
  invoiceNumber?: string
  total: number
  paidAmount: number
  date: string
  status: string
  customerId: string
}

interface CustomerWithDebt {
  id: string
  fullName?: string
  name?: string
  phone?: string
}

const toNum = (v: string): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: number): string => v.toLocaleString("fa-AF")

const remaining = (inv: InvoiceRecord): number => Math.max(0, inv.total - inv.paidAmount)

const paymentSchema = z.object({
  amount: z.number().positive(),
  invoiceId: z.string().min(1),
  customerId: z.string().min(1),
})

interface Props {
  open: boolean
  onClose: () => void
  onPaid?: () => void
  customer: CustomerWithDebt | null
  openInvoices: InvoiceRecord[]
}

export function PaymentModal({ open, onClose, onPaid, customer, openInvoices }: Props) {
  const { t } = useTranslation()
  const createTx = useCreateTransaction()
  const { setSaveStatus } = useSyncStore()
  const { addAuditEntry } = useBackupStore()
  const [amount, setAmount] = useState("")
  const [invoiceId, setInvoiceId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    setInvoiceId(openInvoices.length === 1 ? (openInvoices[0]?.id ?? "") : "")
    setAmount("")
    setError(null)
    setShowSaved(false)
  }, [open, customer?.id, openInvoices])

  const suggested = useMemo(() => {
    const inv = openInvoices.find((i) => i.id === invoiceId)
    if (inv) return remaining(inv)
    return openInvoices.length ? Math.min(...openInvoices.map(remaining)) : 0
  }, [openInvoices, invoiceId])

  const handleClose = useCallback(() => {
    setError(null)
    onClose()
  }, [onClose])

  const submit = useCallback(async () => {
    if (!customer?.id) return

    const payAmount = toNum(amount) || suggested
    const targetInvoice = invoiceId || openInvoices[0]?.id || ""

    const parsed = paymentSchema.safeParse({
      amount: payAmount,
      invoiceId: targetInvoice,
      customerId: customer.id,
    })

    if (!parsed.success) {
      setError(t("baqidari.form.invalidPayment"))
      return
    }

    setError(null)
    setSaveStatus("saving")

    try {
      await createTx.mutateAsync({
        customerId: parsed.data.customerId,
        type: "payment",
        amount: parsed.data.amount,
        currency: "AFN",
        date: new Date().toISOString(),
        reference: parsed.data.invoiceId,
        description: t("baqidari.paymentFrom", {
          name: customer.fullName || customer.name || "",
        }),
      })

      addAuditEntry({
        action: "payment",
        entity: "transaction",
        entityId: customer.id,
        details: `پرداخت ${fmt(parsed.data.amount)} AFN از ${customer.fullName || customer.name} — فاکتور #${targetInvoice}`,
      })

      setSaveStatus("saved")
      setShowSaved(true)
      setTimeout(() => {
        setSaveStatus("idle")
        setShowSaved(false)
      }, 2000)

      onPaid?.()
      onClose()
    } catch {
      setSaveStatus("error")
      setError(t("common.saveError"))
      setTimeout(() => setSaveStatus("idle"), 2000)
    }
  }, [
    customer,
    amount,
    suggested,
    invoiceId,
    openInvoices,
    createTx,
    onPaid,
    onClose,
    t,
    setSaveStatus,
    addAuditEntry,
  ])

  if (!customer) return null

  const name = customer.fullName || customer.name || t("common.noName")
  const canSubmit = (toNum(amount) > 0 || suggested > 0) && (invoiceId || openInvoices.length === 1)

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`${t("baqidari.recordPayment")} — ${name}`}
      size="sm"
    >
      <SaveIndicator
        show={showSaved}
        message={t("common.saved", "پرداخت ثبت شد ✅")}
      />

      {openInvoices.length > 1 && (
        <select
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
          aria-label={t("baqidari.selectInvoice")}
          className="w-full rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-4 py-3 text-sm"
        >
          <option value="">{t("baqidari.selectInvoice")}</option>
          {openInvoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              #{inv.invoiceNumber ?? ""} — {fmt(remaining(inv))} AFN
            </option>
          ))}
        </select>
      )}

      {openInvoices.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hisab-warning)]/10">
            <AlertTriangle className="size-7 text-[var(--hisab-warning)]" aria-hidden />
          </div>
          <div className="space-y-1">
            <p className="font-semibold">{t("baqidari.noOpenDeals")}</p>
            <p className="text-sm text-[var(--hisab-muted-fg)]">
              {t("baqidari.noOpenDealsDesc", "این مشتری بدهی باز ندارد")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleClose}>
            {t("common.back")}
          </Button>
        </div>
      )}

      {openInvoices.length > 0 && (
        <>
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`${t("baqidari.form.default")}: ${fmt(suggested)} AFN`}
            label={t("baqidari.form.paymentAmount")}
            leftIcon={<DollarSign className="size-4" aria-hidden />}
            autoFocus
          />

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-[var(--hisab-destructive)]/20 bg-[var(--hisab-destructive)]/10 p-3 text-sm text-[var(--hisab-destructive)]"
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <p>{error}</p>
              <button
                type="button"
                onClick={submit}
                className="ms-auto shrink-0 rounded-lg px-2 py-1 text-xs font-medium hover:bg-[var(--hisab-destructive)]/20 transition-colors"
                aria-label={t("common.retry")}
              >
                <RefreshCw className="size-3" aria-hidden />
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="w-full" onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button
              className="w-full"
              onClick={submit}
              loading={createTx.isPending}
              disabled={!canSubmit}
            >
              {t("baqidari.recordPayment")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}