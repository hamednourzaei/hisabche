"use client"

import { useCallback, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTranslation } from "react-i18next"
import { useCreateCustomer, useCreateInvoice } from "@hisabche/api"
import { Button } from "../button"
import { Input } from "../input"
import { Label } from "../label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../dialog"
import { ProductPicker } from "../product-picker"
import { SaveIndicator } from "../save-indicator"
import { useSyncStore, useBackupStore } from "@hisabche/store"
import { AlertTriangle, RefreshCw, User, Phone, Package, DollarSign } from "lucide-react"

type ProductOption = NonNullable<Parameters<typeof ProductPicker>[0]["value"]>

const toNum = (v: string): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: number): string => v.toLocaleString("fa-AF")

const customerSchema = z.object({
  name: z.string().min(1, "customer.nameRequired"),
  phone: z.string().optional(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

interface AddCustomerModalProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

export function AddCustomerModal({ open, onClose, onCreated }: AddCustomerModalProps) {
  const { t } = useTranslation()
  const createCustomer = useCreateCustomer()
  const createInvoice = useCreateInvoice()
  const { setSaveStatus } = useSyncStore()
  const { addAuditEntry } = useBackupStore()

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

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = form

  const close = useCallback(() => {
    reset()
    setWithDebt(false)
    setProduct(null)
    setQty("1")
    setUnitPrice("")
    setError(null)
    onClose()
  }, [reset, onClose])

  const onSubmit = async (data: CustomerFormValues) => {
    setError(null)
    setSaveStatus("saving")

    try {
      const customer = await createCustomer.mutateAsync({
        fullName: data.name,
        phone: data.phone || undefined,
        openingBalance: 0,
        isActive: true,
      })

      addAuditEntry({
        action: "create",
        entity: "customer",
        entityId: customer.id || "",
        details: `مشتری جدید: ${data.name}`,
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
      setError(t("common.saveError", "خطا در ذخیره اطلاعات"))
      setTimeout(() => setSaveStatus("idle"), 2000)
    }
  }

  const retrySubmit = () => {
    handleSubmit(onSubmit)()
  }

 return (
    <Dialog open={open} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <SaveIndicator show={showSaved} message={t("common.saved", "ذخیره شد ✅")} />

        <DialogHeader>
          <DialogTitle>{t("baqidari.addCustomer", "افزودن مشتری جدید")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input
              {...register("name")}
              placeholder={t("baqidari.form.namePlaceholder", "نام کامل")}
              leftIcon={<User className="size-4" aria-hidden />}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-sm text-destructive">
                {t(errors.name.message || "نام الزامی است")}
              </p>
            )}
          </div>

          <div>
            <Input
              {...register("phone")}
              placeholder={t("baqidari.form.phonePlaceholder", "شماره تماس")}
              leftIcon={<Phone className="size-4" aria-hidden />}
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-destructive">
                {t(errors.phone.message || "مقدار وارد شده معتبر نیست")}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={!withDebt ? "default" : "outline"}
              className="flex-1"
              onClick={() => setWithDebt(false)}
            >
              {t("baqidari.form.newCustomer", "مشتری بدون بدهی")}
            </Button>
            <Button
              type="button"
              variant={withDebt ? "destructive" : "outline"}
              className="flex-1"
              onClick={() => setWithDebt(true)}
            >
              {t("baqidari.form.hasDebt", "مشتری دارای بدهی")}
            </Button>
          </div>

          {withDebt && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <ProductPicker
                value={product}
                onChange={setProduct}
                placeholder={t("baqidari.form.whichProduct", "انتخاب محصول")}
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder={t("baqidari.form.unitPrice", "قیمت واحد")}
                    leftIcon={<DollarSign className="size-4" aria-hidden />}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder={t("baqidari.form.qty", "تعداد")}
                    leftIcon={<Package className="size-4" aria-hidden />}
                  />
                </div>
              </div>

              {total > 0 && (
                <p className="text-center text-lg font-bold tabular-nums text-primary">
                  {t("baqidari.form.total", "مجموع")}: {fmt(total)} AFN
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <p className="flex-1">{error}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={retrySubmit}
              >
                <RefreshCw className="size-3" aria-hidden />
              </Button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="w-full" onClick={close}>
              {t("common.cancel", "انصراف")}
            </Button>
            <Button type="submit" className="w-full" disabled={pending}>
              {t("common.save", "ذخیره")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}