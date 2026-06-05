"use client"

import { Button } from "../button"
import { Input } from "../input"
import { Card, CardContent } from "../card"
import { ProductPicker } from "../product-picker"
import { CustomerPicker } from "../customer-picker"
import { SaveIndicator } from "../save-indicator"
import {
  ArrowRight,
  Check,
  User,
  DollarSign,
  Package,
  ShoppingCart,
  CreditCard,
} from "lucide-react"

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

const STEPS: Step[] = ["product", "customer", "price", "done"] as const
const QUANTITIES = ["1", "2", "3", "5", "10"] as const

export interface QuickInvoicePageProps {
  t: (key: string, fallback?: string) => string
  elapsedFormatted: string
  showSaved: boolean
  showCelebration: boolean
  step: Step
  selectedProduct: ProductOption | null
  selectedCustomer: CustomerOption | null
  price: string
  quantity: string
  paymentType: PaymentType
  paidNow: string
  total: number
  productName: string
  paidAmount: number
  createdInvoiceId: string | null
  isPending: boolean
  inputRef: React.Ref<HTMLInputElement>
  onSelectProduct: (p: ProductOption | null) => void
  onSelectCustomer: (c: CustomerOption | null) => void
  onPriceChange: (v: string) => void
  onQuantityChange: (q: string) => void
  onPaymentTypeChange: (t: PaymentType) => void
  onPaidNowChange: (v: string) => void
  onSetStep: (s: Step) => void
  onCreate: () => void
  onDismissCelebration: () => void
  onViewInvoice: () => void
  onViewAllInvoices: () => void
}

export function QuickInvoicePage({
  t,
  elapsedFormatted,
  showSaved,
  showCelebration,
  step,
  selectedProduct,
  selectedCustomer,
  price,
  quantity,
  paymentType,
  paidNow,
  total,
  productName,
  paidAmount,
  createdInvoiceId,
  isPending,
  inputRef,
  onSelectProduct,
  onSelectCustomer,
  onPriceChange,
  onQuantityChange,
  onPaymentTypeChange,
  onPaidNowChange,
  onSetStep,
  onCreate,
  onDismissCelebration,
  onViewInvoice,
  onViewAllInvoices,
}: QuickInvoicePageProps) {
  return (
    <div className="px-4 py-10">
      <SaveIndicator
        show={showSaved}
        message={t("faktoor.created", "فاکتور ثبت شد ✅")}
      />

      {/* ── Celebration Modal ── */}
      {showCelebration && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onDismissCelebration}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-none text-center"
          >
            <div className="mb-4 animate-bounce text-6xl">🧾</div>
            <div className="glass-strong rounded-2xl px-8 py-6 border border-border bg-background/80 backdrop-blur-xl">
              <p className="text-xl font-bold text-foreground">
                🎉 {t("faktoor.created", "فاکتور با موفقیت ثبت شد")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("faktoor.clickToView", "کلیک کنید تا فاکتور را ببینید")}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-xl">
        {/* ── Timer + Step Indicators ── */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">
              {elapsedFormatted}
            </span>
          </div>
          <div className="flex gap-2">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-2 w-14 rounded-full transition-all ${
                  STEPS.indexOf(step) >= i ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── Step 1: Product ── */}
        {step === "product" && (
          <Card className="glass-strong border-border bg-card/80 backdrop-blur-xl">
            <CardContent className="space-y-6 p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Package className="size-8 text-primary" aria-hidden />
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  {t("quickInvoice.whatSold", "نام محصول")}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("quickInvoice.whatSoldDesc", "چه چیزی فروختید؟")}
                </p>
              </div>
              <ProductPicker
                value={selectedProduct}
                onChange={onSelectProduct}
                placeholder={t("godam.pickProduct", "انتخاب محصول از گدام...")}
              />
              <Button
                className="w-full gap-2"
                size="lg"
                disabled={!selectedProduct}
                onClick={() => onSetStep("customer")}
              >
                <ArrowRight className="size-4" aria-hidden />
                {t("action.next", "ادامه")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Customer ── */}
        {step === "customer" && (
          <Card className="glass-strong border-border bg-card/80 backdrop-blur-xl">
            <CardContent className="space-y-6 p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                  <User className="size-8 text-accent" aria-hidden />
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  {t("faktoor.customer", "مشتری")}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("quickInvoice.toWhom", "نام مشتری را انتخاب کنید (اختیاری)")}
                </p>
              </div>
              <CustomerPicker
                value={selectedCustomer}
                onChange={onSelectCustomer}
                placeholder={t("customer.pickPlaceholder", "انتخاب مشتری...")}
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onSetStep("product")}
                >
                  {t("action.back", "برگشت")}
                </Button>
                <Button
                  className="w-full"
                  onClick={() => onSetStep("price")}
                >
                  {t("action.next", "ادامه")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Price ── */}
        {step === "price" && (
          <Card className="glass-strong border-border bg-card/80 backdrop-blur-xl">
            <CardContent className="space-y-6 p-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10">
                  <DollarSign className="size-8 text-success" aria-hidden />
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                  {t("faktoor.total", "مبلغ فاکتور")}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("quickInvoice.howMuch", "مبلغ فروش را وارد کنید")}
                </p>
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-border bg-card p-4 text-start">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t("faktoor.items", "محصول")}
                  </span>
                  <span className="font-medium text-foreground">
                    {productName}
                  </span>
                </div>
                {selectedCustomer && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {t("faktoor.customer", "مشتری")}
                    </span>
                    <span className="font-medium text-foreground">
                      {selectedCustomer.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment type toggle */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={paymentType === "cash" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => onPaymentTypeChange("cash")}
                >
                  💵 {t("faktoor.cash", "نقد")}
                </Button>
                <Button
                  type="button"
                  variant={paymentType === "credit" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => onPaymentTypeChange("credit")}
                >
                  📝 {t("faktoor.credit", "نسیه")}
                </Button>
              </div>

              {paymentType === "credit" && (
                <Input
                  type="number"
                  value={paidNow}
                  onChange={(e) => onPaidNowChange(e.target.value)}
                  placeholder={`${t("payment.record", "پیش‌پرداخت")} (کل: ${total.toLocaleString()} AFN)`}
                  leftIcon={<CreditCard className="size-4" aria-hidden />}
                />
              )}

              {/* Quantity */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t("faktoor.quantity", "تعداد")}
                </label>
                <div className="flex gap-2">
                  {QUANTITIES.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      variant={quantity === q ? "default" : "outline"}
                      size="sm"
                      className="h-10 w-10"
                      onClick={() => onQuantityChange(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Price input */}
              <Input
                ref={inputRef}
                type="number"
                value={price}
                onChange={(e) => onPriceChange(e.target.value)}
                placeholder={t("quickInvoice.pricePlaceholder", "مثلاً 500")}
                label={`${t("faktoor.unitPrice", "قیمت")} (AFN)`}
                leftIcon={<DollarSign className="size-4" aria-hidden />}
              />

              {/* Total */}
              {price && (
                <div className="rounded-2xl bg-primary/5 p-5 text-center border border-border">
                  <p className="mb-2 text-sm text-muted-foreground">
                    {t("common.total", "مبلغ کل")}
                  </p>
                  <p className="text-4xl font-bold tabular-nums text-primary">
                    {total.toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {paymentType === "cash"
                      ? t("faktoor.paid", "پرداخت کامل")
                      : paidNow
                        ? `${t("payment.record", "پیش‌پرداخت")}: ${parseFloat(paidNow).toLocaleString()} AFN — ${t("faktoor.remaining", "باقی‌مانده")}: ${(total - parseFloat(paidNow || "0")).toLocaleString()} AFN`
                        : t("faktoor.credit", "نسیه کامل")}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onSetStep("customer")}
                >
                  {t("action.back", "برگشت")}
                </Button>
                <Button
                  className="w-full gap-2"
                  size="lg"
                  loading={isPending}
                  disabled={!price || parseFloat(price) <= 0}
                  onClick={onCreate}
                >
                  <ShoppingCart className="size-4" aria-hidden />
                  {t("action.submit", "ثبت فاکتور")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && (
          <Card className="glass-strong border-border bg-card/80 backdrop-blur-xl">
            <CardContent className="space-y-8 p-8 text-center">
              <div>
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-success/10">
                  <Check className="size-12 text-success" aria-hidden />
                </div>
                <h1 className="mb-3 text-3xl font-bold text-foreground">
                  {t("faktoor.created", "فاکتور ثبت شد")} 🎉
                </h1>
                <p className="text-muted-foreground">
                  {t("dashboard.ready", "فاکتور شما در")}{" "}
                  <strong>{elapsedFormatted}</strong>{" "}
                  {t("dashboard.ready", "ثبت شد.")}
                </p>
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-border bg-card p-5 text-start">
                <div className="mb-3 flex justify-between">
                  <span className="text-muted-foreground">
                    {t("faktoor.items", "محصول")}
                  </span>
                  <span className="font-medium text-foreground">
                    {productName}
                  </span>
                </div>
                <div className="mb-3 flex justify-between">
                  <span className="text-muted-foreground">
                    {t("faktoor.quantity", "تعداد")}
                  </span>
                  <span className="font-medium text-foreground">
                    {quantity}
                  </span>
                </div>
                <div className="mb-3 flex justify-between">
                  <span className="text-muted-foreground">
                    {t("common.status", "نوع")}
                  </span>
                  <span className="font-medium text-foreground">
                    {paymentType === "cash"
                      ? `💵 ${t("faktoor.cash", "نقد")}`
                      : `📝 ${t("faktoor.credit", "نسیه")}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("common.total", "مبلغ کل")}
                  </span>
                  <span className="font-bold tabular-nums text-primary">
                    {total.toLocaleString()} AFN
                  </span>
                </div>
                {paymentType === "credit" && (
                  <>
                    <div className="mt-2 flex justify-between">
                      <span className="text-muted-foreground">
                        {t("faktoor.paid", "پرداخت شده")}
                      </span>
                      <span className="font-bold tabular-nums text-success">
                        {paidAmount.toLocaleString()} AFN
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between">
                      <span className="text-muted-foreground">
                        {t("faktoor.remaining", "باقی‌مانده")}
                      </span>
                      <span className="font-bold tabular-nums text-destructive">
                        {(total - paidAmount).toLocaleString()} AFN
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                {createdInvoiceId && (
                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={onViewInvoice}
                  >
                    <ArrowRight className="size-5" aria-hidden />
                    {t("action.view", "مشاهده فاکتور")}
                  </Button>
                )}
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={onViewAllInvoices}
                >
                  {t("action.back", "بازگشت به فاکتورها")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}