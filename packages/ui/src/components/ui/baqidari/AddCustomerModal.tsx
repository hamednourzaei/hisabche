"use client"

import { useCallback, useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { useCreateCustomer, useCreateInvoice } from "@hisabche/api"
import { Button, Input, ProductPicker, SaveIndicator } from "@hisabche/ui"
import { useSyncStore, useBackupStore } from "@hisabche/store"
import { AlertTriangle, RefreshCw, User, Phone, Package, DollarSign } from "lucide-react"
import { Modal } from "../Modal"

type ProductOption = NonNullable<Parameters<typeof ProductPicker>[0]["value"]>

const toNum = (v: string): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: number): string => v.toLocaleString("fa-AF")

const customerSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
})

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function AddCustomerModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const createCustomer = useCreateCustomer()
  const createInvoice = useCreateInvoice()
  const { setSaveStatus } = useSyncStore()
  const { addAuditEntry } = useBackupStore()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [withDebt, setWithDebt] = useState(false)
  const [product, setProduct] = useState<ProductOption | null>(null)
  const [qty, setQty] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [showSaved, setShowSaved] = useState(false)

  const total = useMemo(
    () => toNum(unitPrice) * Math.max(1, toNum(qty)),
    [unitPrice, qty]
  )

  const pending = createCustomer.isPending || createInvoice.isPending

  const close = useCallback(() => {
    setName("")
    setPhone("")
    setWithDebt(false)
    setProduct(null)
    setQty("1")
    setUnitPrice("")
    setError(null)
    onClose()
  }, [onClose])

  const submit = useCallback(async () => {
    const parsed = customerSchema.safeParse({ name, phone })
    if (!parsed.success) {
      setError(t("baqidari.form.nameRequired"))
      return
    }

    setError(null)
    setSaveStatus("saving")

    try {
      const customer = await createCustomer.mutateAsync({
        fullName: parsed.data.name,
        phone: parsed.data.phone || undefined,
        openingBalance: 0,
        isActive: true,
      })

      addAuditEntry({
        action: "create",
        entity: "customer",
        entityId: customer.id || "",
        details: `مشتری جدید: ${parsed.data.name}`,
      })

      if (withDebt && product && total > 0) {
        await createInvoice.mutateAsync({
          type: "sale",
          date: new Date().toISOString(),
          subtotal: total,
          discountTotal: 0,
          discountType: "fixed",
          taxRate: 0,
          taxTotal: 0,
          total,
          paidAmount: 0,
          paymentMethod: "credit",
          currency: "AFN",
          customerId: customer.id,
          customerName: parsed.data.name,
          items: [
            {
              productId: product.id,
              productName: product.name,
              quantity: toNum(qty),
              unitPrice: toNum(unitPrice),
              discount: 0,
              totalPrice: total,
            },
          ],
        })
      }

      setSaveStatus("saved")
      setShowSaved(true)
      setTimeout(() => {
        setSaveStatus("idle")
        setShowSaved(false)
      }, 2000)

      onCreated?.()
      close()
    } catch {
      setSaveStatus("error")
      setError(t("common.saveError"))
      setTimeout(() => setSaveStatus("idle"), 2000)
    }
  }, [
    name,
    phone,
    withDebt,
    product,
    qty,
    unitPrice,
    total,
    createCustomer,
    createInvoice,
    onCreated,
    close,
    t,
    setSaveStatus,
    addAuditEntry,
  ])

  return (
    <Modal
      open={open}
      onClose={close}
      title={t("baqidari.addCustomer")}
      size="md"
    >
      <SaveIndicator
        show={showSaved}
        message={t("common.saved", "ذخیره شد ✅")}
      />

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("baqidari.form.namePlaceholder")}
        label={t("baqidari.form.fullName", "نام کامل")}
        leftIcon={<User className="size-4" aria-hidden />}
        autoFocus
      />

      <Input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t("baqidari.form.phonePlaceholder")}
        label={t("baqidari.form.phone", "شماره تماس")}
        leftIcon={<Phone className="size-4" aria-hidden />}
      />

      <div className="flex gap-2">
        <Toggle
          active={!withDebt}
          tone="primary"
          onClick={() => setWithDebt(false)}
        >
          {t("baqidari.form.newCustomer")}
        </Toggle>
        <Toggle
          active={withDebt}
          tone="warning"
          onClick={() => setWithDebt(true)}
        >
          {t("baqidari.form.hasDebt")}
        </Toggle>
      </div>

      {withDebt && (
        <div className="space-y-3 rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-muted)]/30 p-4">
          <ProductPicker
            value={product}
            onChange={setProduct}
            placeholder={t("baqidari.form.whichProduct")}
          />

          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder={t("baqidari.form.unitPrice")}
              label={t("baqidari.form.unitPrice", "قیمت واحد")}
              leftIcon={<DollarSign className="size-4" aria-hidden />}
              className="flex-1"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={t("baqidari.form.qty")}
              label={t("baqidari.form.qty", "تعداد")}
              leftIcon={<Package className="size-4" aria-hidden />}
              className="w-24"
            />
          </div>

          {total > 0 && (
            <p className="text-center text-lg font-bold tabular-nums text-[var(--hisab-primary)]">
              {t("baqidari.form.total")}: {fmt(total)} AFN
            </p>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-[var(--hisab-destructive)]/20 bg-[var(--hisab-destructive)]/10 p-3 text-sm text-[var(--hisab-destructive)]"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={submit}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium hover:bg-[var(--hisab-destructive)]/20 transition-colors"
            aria-label={t("common.retry")}
          >
            <RefreshCw className="size-3" aria-hidden />
          </button>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="w-full" onClick={close}>
          {t("common.cancel")}
        </Button>
        <Button
          className="w-full"
          onClick={submit}
          loading={pending}
          disabled={!name.trim()}
        >
          {t("common.save")}
        </Button>
      </div>
    </Modal>
  )
}

function Toggle({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean
  tone: "primary" | "warning"
  onClick: () => void
  children: ReactNode
}) {
  const activeClass =
    tone === "primary"
      ? "bg-[var(--hisab-primary)] text-[var(--hisab-primary-fg)]"
      : "bg-[var(--hisab-warning)] text-[var(--hisab-warning-fg)]"

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-all ${
        active
          ? activeClass
          : "border border-[var(--hisab-border)] text-[var(--hisab-muted-fg)] hover:bg-[var(--hisab-muted)]"
      }`}
    >
      {children}
    </button>
  )
}