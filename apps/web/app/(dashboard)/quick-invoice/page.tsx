"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button, Input, Card, CardContent, ProductPicker, CustomerPicker } from "@hisabche/ui"
import { useCreateInvoice } from "@hisabche/api"
import { useOnboardingStore, usePreferencesStore } from "@hisabche/store"
import { ArrowRight, Check, User, DollarSign, Package, ShoppingCart, CreditCard } from "lucide-react"

interface ProductOption {
  id: string
  name: string
  sellPrice: number
  unit: string
}

interface CustomerOption {
  id: string
  name: string
  phone: string
}

type Step = "product" | "customer" | "price" | "done"
type PaymentType = "cash" | "credit"

export default function QuickInvoicePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const createInvoice = useCreateInvoice()
  const { markInvoiceCreated } = useOnboardingStore()
  const preferences = usePreferencesStore()
  const inputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>("product")
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)
  const [price, setPrice] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [paymentType, setPaymentType] = useState<PaymentType>("cash")
  const [paidNow, setPaidNow] = useState("")
  const [showCelebration, setShowCelebration] = useState(false)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startTime])

  useEffect(() => {
    if (selectedProduct?.sellPrice) {
      setPrice(selectedProduct.sellPrice.toString())
    }
  }, [selectedProduct])

  const total = (parseFloat(price) || 0) * (parseInt(quantity) || 1)
  const productName = selectedProduct?.name ?? ""
  const paidAmount = paymentType === "cash" ? total : (parseFloat(paidNow) || 0)

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false)
    router.push(createdInvoiceId ? `/invoices/${createdInvoiceId}` : "/invoices")
  }, [createdInvoiceId, router])

  const handleCreate = useCallback(async () => {
    if (!selectedProduct || !price) return

    const newInvoice = await createInvoice.mutateAsync({
      type: "sale",
      date: new Date().toISOString(),
      subtotal: total,
      discountTotal: 0,
      discountType: "fixed",
      taxRate: preferences.lastTaxRate ?? 0,
      taxTotal: 0,
      total,
      paidAmount,
      paymentMethod: paymentType === "cash" ? "cash" : "credit",
      currency: (preferences.lastCurrency as "AFN" | "USD" | "PKR" | "IRR") ?? "AFN",
      customerId: selectedCustomer?.id || undefined,
      customerName: selectedCustomer?.name || undefined,
      items: [
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity: parseInt(quantity),
          unitPrice: parseFloat(price),
          discount: 0,
          totalPrice: total,
        },
      ],
    })

    preferences.addRecentProduct(selectedProduct.name)
    preferences.addFrequentProduct(selectedProduct.name)
    if (selectedCustomer) {
      preferences.setLastCustomer(selectedCustomer.name, selectedCustomer.id)
    }

    markInvoiceCreated()
    setCreatedInvoiceId(newInvoice.id ?? null)
    setShowCelebration(true)
    setStep("done")
  }, [
    selectedProduct, price, total, paidAmount, paymentType, quantity,
    selectedCustomer, preferences, createInvoice, markInvoiceCreated,
  ])

  const elapsedFormatted = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`

  return (
    <div className="min-h-screen bg-[var(--hisab-background)] px-4 py-10">
      {showCelebration && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm cursor-pointer"
          onClick={dismissCelebration}
        >
          <div onClick={(e) => e.stopPropagation()} className="text-center pointer-events-none">
            <div className="text-6xl mb-4 animate-bounce">🧾</div>
            <div className="bg-[var(--hisab-card)] rounded-2xl shadow-[var(--hisab-shadow-xl)] px-8 py-6 border border-[var(--hisab-border)]">
              <p className="text-xl font-bold text-[var(--hisab-foreground)]">
                🎉 {t("faktoor.created") || "فاکتور با موفقیت ثبت شد"}
              </p>
              <p className="text-sm text-[var(--hisab-muted-fg)] mt-2">
                {t("faktoor.clickToView") || "کلیک کنید تا فاکتور را ببینید"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-[var(--hisab-success)]" />
            <span className="text-sm text-[var(--hisab-muted-fg)]">{elapsedFormatted}</span>
          </div>
          <div className="flex gap-2">
            {(["product", "customer", "price", "done"] as Step[]).map((s, i) => (
              <div
                key={s}
                className={`h-2 w-14 rounded-full transition-all ${
                  ["product", "customer", "price", "done"].indexOf(step) >= i
                    ? "bg-[var(--hisab-primary)]"
                    : "bg-[var(--hisab-muted)]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP: PRODUCT */}
        {step === "product" && (
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--hisab-primary)]/10">
                  <Package className="size-8 text-[var(--hisab-primary)]" />
                </div>
                <h1 className="text-2xl font-bold text-[var(--hisab-foreground)]">نام محصول</h1>
                <p className="mt-2 text-sm text-[var(--hisab-muted-fg)]">چه چیزی فروختید؟</p>
              </div>
              <ProductPicker value={selectedProduct} onChange={setSelectedProduct} placeholder="انتخاب محصول از گدام..." />
              <Button fullWidth size="lg" disabled={!selectedProduct} onClick={() => setStep("customer")} icon={<ArrowRight className="size-4" />}>
                ادامه
              </Button>
            </CardContent>
          </Card>
        )}

        {/* STEP: CUSTOMER */}
        {step === "customer" && (
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--hisab-accent)]/10">
                  <User className="size-8 text-[var(--hisab-accent)]" />
                </div>
                <h1 className="text-2xl font-bold text-[var(--hisab-foreground)]">مشتری</h1>
                <p className="mt-2 text-sm text-[var(--hisab-muted-fg)]">نام مشتری را انتخاب کنید (اختیاری)</p>
              </div>
              <CustomerPicker value={selectedCustomer} onChange={setSelectedCustomer} placeholder="انتخاب مشتری..." />
              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setStep("product")}>برگشت</Button>
                <Button fullWidth onClick={() => setStep("price")}>ادامه</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP: PRICE */}
        {step === "price" && (
          <Card>
            <CardContent className="space-y-6 p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--hisab-success)]/10">
                  <DollarSign className="size-8 text-[var(--hisab-success)]" />
                </div>
                <h1 className="text-2xl font-bold text-[var(--hisab-foreground)]">مبلغ فاکتور</h1>
                <p className="mt-2 text-sm text-[var(--hisab-muted-fg)]">مبلغ فروش را وارد کنید</p>
              </div>

              <div className="rounded-2xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-[var(--hisab-muted-fg)]">محصول</span>
                  <span className="font-medium text-[var(--hisab-foreground)]">{productName}</span>
                </div>
                {selectedCustomer && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--hisab-muted-fg)]">مشتری</span>
                    <span className="font-medium text-[var(--hisab-foreground)]">{selectedCustomer.name}</span>
                  </div>
                )}
              </div>

              {/* Payment Type Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentType("cash")}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    paymentType === "cash"
                      ? "bg-[var(--hisab-primary)] text-white"
                      : "border border-[var(--hisab-border)] text-[var(--hisab-foreground)]"
                  }`}
                >
                  💵 نقد
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType("credit")}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    paymentType === "credit"
                      ? "bg-[var(--hisab-warning)] text-white"
                      : "border border-[var(--hisab-border)] text-[var(--hisab-foreground)]"
                  }`}
                >
                  📝 نسیه
                </button>
              </div>

              {/* Partial Payment */}
              {paymentType === "credit" && (
                <Input
                  type="number"
                  value={paidNow}
                  onChange={(e) => setPaidNow(e.target.value)}
                  placeholder={`پیش‌پرداخت (کل: ${total.toLocaleString()} AFN)`}
                  label="مبلغ پرداخت شده الان"
                  leftIcon={<CreditCard className="size-4" />}
                />
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--hisab-foreground)]">تعداد</label>
                <div className="flex gap-2">
                  {["1", "2", "3", "5", "10"].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`h-10 w-10 rounded-lg border text-sm font-medium transition-all ${
                        quantity === q
                          ? "border-[var(--hisab-primary)] bg-[var(--hisab-primary)]/10 text-[var(--hisab-primary)]"
                          : "border-[var(--hisab-border)] text-[var(--hisab-muted-fg)]"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                ref={inputRef}
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="مثلاً 500"
                label="قیمت (AFN)"
                leftIcon={<DollarSign className="size-4" />}
              />

              {price && (
                <div className="rounded-2xl bg-[var(--hisab-primary)]/5 p-5 text-center">
                  <p className="mb-2 text-sm text-[var(--hisab-muted-fg)]">مبلغ کل</p>
                  <p className="text-4xl font-bold text-[var(--hisab-primary)]">{total.toLocaleString()}</p>
                  <p className="mt-1 text-sm text-[var(--hisab-muted-fg)]">
                    {paymentType === "cash"
                      ? "پرداخت کامل"
                      : paidNow
                        ? `پیش‌پرداخت: ${parseFloat(paidNow).toLocaleString()} AFN — باقی‌مانده: ${(total - parseFloat(paidNow || "0")).toLocaleString()} AFN`
                        : "نسیه کامل"}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" fullWidth onClick={() => setStep("customer")}>برگشت</Button>
                <Button
                  fullWidth
                  size="lg"
                  loading={createInvoice.isPending}
                  disabled={!price || parseFloat(price) <= 0}
                  onClick={handleCreate}
                  icon={<ShoppingCart className="size-4" />}
                >
                  ثبت فاکتور
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP: DONE */}
        {step === "done" && (
          <Card>
            <CardContent className="space-y-8 p-8 text-center">
              <div>
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[var(--hisab-success)]/10">
                  <Check className="size-12 text-[var(--hisab-success)]" />
                </div>
                <h1 className="mb-3 text-3xl font-bold text-[var(--hisab-foreground)]">فاکتور ثبت شد 🎉</h1>
                <p className="text-[var(--hisab-muted-fg)]">
                  فاکتور شما در <strong>{elapsedFormatted}</strong> ثبت شد.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--hisab-border)] bg-[var(--hisab-card)] p-5 text-right">
                <div className="mb-3 flex justify-between">
                  <span className="text-[var(--hisab-muted-fg)]">محصول</span>
                  <span className="font-medium text-[var(--hisab-foreground)]">{productName}</span>
                </div>
                <div className="mb-3 flex justify-between">
                  <span className="text-[var(--hisab-muted-fg)]">تعداد</span>
                  <span className="font-medium text-[var(--hisab-foreground)]">{quantity}</span>
                </div>
                <div className="mb-3 flex justify-between">
                  <span className="text-[var(--hisab-muted-fg)]">نوع</span>
                  <span className="font-medium text-[var(--hisab-foreground)]">
                    {paymentType === "cash" ? "💵 نقد" : "📝 نسیه"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--hisab-muted-fg)]">مبلغ کل</span>
                  <span className="font-bold text-[var(--hisab-primary)]">{total.toLocaleString()} AFN</span>
                </div>
                {paymentType === "credit" && (
                  <>
                    <div className="flex justify-between mt-2">
                      <span className="text-[var(--hisab-muted-fg)]">پرداخت شده</span>
                      <span className="font-bold text-[var(--hisab-success)]">{paidAmount.toLocaleString()} AFN</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[var(--hisab-muted-fg)]">باقی‌مانده</span>
                      <span className="font-bold text-[var(--hisab-destructive)]">
                        {(total - paidAmount).toLocaleString()} AFN
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {createdInvoiceId && (
                  <Button fullWidth size="lg" onClick={() => router.push(`/invoices/${createdInvoiceId}`)} icon={<ArrowRight className="size-5" />}>
                    مشاهده فاکتور
                  </Button>
                )}
                <Button fullWidth variant="outline" onClick={() => router.push("/invoices")}>
                  بازگشت به فاکتورها
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}