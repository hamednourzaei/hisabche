"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import {
  useCustomers, useInvoices, useCreateTransaction,
  useCreateCustomer, useCreateInvoice,
} from "@hisabche/api"
import {
  Button, Badge, Card, CardContent, Input, EmptyState,
  ProductPicker, CustomerPicker,
} from "@hisabche/ui"
import {
  Search, User, DollarSign, TrendingUp, TrendingDown,
  ChevronLeft, Plus, ShoppingCart, CreditCard,
} from "lucide-react"

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")

// ═══════════════ Add Customer Modal (بهبود یافته) ═══════════════
function AddCustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createCustomer = useCreateCustomer()
  const createInvoice = useCreateInvoice()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [hasInitialDebt, setHasInitialDebt] = useState(false)
  const [initialAmount, setInitialAmount] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")

  const total = (parseFloat(unitPrice) || 0) * (parseInt(quantity) || 1)

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return

    const newCustomer = await createCustomer.mutateAsync({
      fullName: name.trim(),
      phone: phone.trim() || undefined,
      openingBalance: hasInitialDebt ? parseFloat(initialAmount) || 0 : 0,
      isActive: true,
    })

    // If initial debt with product, create invoice immediately
    if (hasInitialDebt && selectedProduct && unitPrice && parseFloat(unitPrice) > 0) {
      await createInvoice.mutateAsync({
        type: "sale", date: new Date().toISOString(), subtotal: total,
        discountTotal: 0, discountType: "fixed", taxRate: 0, taxTotal: 0,
        total, paidAmount: 0, paymentMethod: "credit", currency: "AFN",
        customerId: newCustomer.id, customerName: name.trim(),
        items: [{
          productId: selectedProduct.id, productName: selectedProduct.name,
          quantity: parseInt(quantity), unitPrice: parseFloat(unitPrice),
          discount: 0, totalPrice: total,
        }],
      })
    }

    setName(""); setPhone(""); setHasInitialDebt(false); setInitialAmount("")
    setSelectedProduct(null); setQuantity("1"); setUnitPrice("")
    onClose()
  }, [name, phone, hasInitialDebt, initialAmount, selectedProduct, unitPrice, quantity, total, createCustomer, createInvoice, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--hisab-card)] rounded-2xl shadow-[var(--hisab-shadow-xl)] border border-[var(--hisab-border)] w-full max-w-md p-6 space-y-4 mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--hisab-foreground)]">مشتری جدید</h3>
          <button onClick={onClose} className="text-[var(--hisab-muted-fg)]">✕</button>
        </div>

        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام مشتری *" autoFocus />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="شماره تماس (اختیاری)" />

        {/* Toggle: Has initial debt? */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setHasInitialDebt(false)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              !hasInitialDebt ? "bg-[var(--hisab-primary)] text-white" : "border border-[var(--hisab-border)] text-[var(--hisab-foreground)]"
            }`}
          >
            ✅ تازه میاد
          </button>
          <button
            type="button"
            onClick={() => setHasInitialDebt(true)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              hasInitialDebt ? "bg-[var(--hisab-warning)] text-white" : "border border-[var(--hisab-border)] text-[var(--hisab-foreground)]"
            }`}
          >
            📝 بدهی داره
          </button>
        </div>

        {hasInitialDebt && (
          <>
            <ProductPicker value={selectedProduct} onChange={setSelectedProduct} placeholder="چه جنسی برده؟" />
            <div className="flex gap-2">
              <Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="قیمت واحد" className="flex-1" />
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="تعداد" className="w-24" />
            </div>
            <Input type="number" value={initialAmount} onChange={(e) => setInitialAmount(e.target.value)} placeholder={`مبلغ بدهی (کل: ${fmt(total)} AFN)`} />
            {unitPrice && <p className="text-center font-bold text-[var(--hisab-primary)]">کل: {fmt(total)} AFN</p>}
          </>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" fullWidth onClick={onClose}>انصراف</Button>
          <Button fullWidth onClick={handleSubmit} loading={createCustomer.isPending || createInvoice.isPending} disabled={!name.trim()}>
            ذخیره
          </Button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════ Payment Modal ═══════════════
function PaymentModal({ open, onClose, customer, openInvoices, onPaid }: {
  open: boolean; onClose: () => void; customer: any; openInvoices: any[]; onPaid: () => void
}) {
  const createTx = useCreateTransaction()
  const [amount, setAmount] = useState("")
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(openInvoices.length === 1 ? openInvoices[0].id : "")

  const defaultAmount = useMemo(() => {
    if (openInvoices.length === 0) return 0
    if (selectedInvoiceId) {
      const inv = openInvoices.find((i) => i.id === selectedInvoiceId)
      return inv ? num(inv.total) - num(inv.paidAmount ?? 0) : 0
    }
    return Math.min(...openInvoices.map((i) => num(i.total) - num(i.paidAmount ?? 0)))
  }, [openInvoices, selectedInvoiceId])

  const handleSubmit = useCallback(async () => {
    const payAmount = num(amount) || defaultAmount
    if (payAmount <= 0) return
    const invoiceId = selectedInvoiceId || openInvoices[0]?.id
    if (!invoiceId) return
    await createTx.mutateAsync({
      customerId: customer.id, type: "payment", amount: payAmount, currency: "AFN",
      date: new Date().toISOString(), reference: invoiceId,
      description: `پرداخت از ${customer.fullName || customer.name}`,
    } as any)
    onPaid(); onClose(); setAmount("")
  }, [amount, defaultAmount, selectedInvoiceId, openInvoices, customer, createTx, onPaid, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--hisab-card)] rounded-2xl shadow-[var(--hisab-shadow-xl)] border border-[var(--hisab-border)] w-full max-w-sm p-6 space-y-4 mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-lg font-bold text-[var(--hisab-foreground)]">ثبت پرداخت — {customer.fullName || customer.name}</h3><button onClick={onClose} className="text-[var(--hisab-muted-fg)]">✕</button></div>
        {openInvoices.length > 1 && (
          <select value={selectedInvoiceId} onChange={(e) => setSelectedInvoiceId(e.target.value)} className="w-full rounded-xl border border-[var(--hisab-border)] bg-[var(--hisab-background)] px-4 py-3 text-sm text-[var(--hisab-foreground)]">
            <option value="">انتخاب فاکتور</option>
            {openInvoices.map((inv) => <option key={inv.id} value={inv.id}>#{inv.invoiceNumber ?? ""} — {fmt(num(inv.total) - num(inv.paidAmount ?? 0))} AFN</option>)}
          </select>
        )}
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`پیش‌فرض: ${fmt(defaultAmount)} AFN`} label="مبلغ پرداختی (AFN)" leftIcon={<DollarSign className="size-4" />} autoFocus />
        <div className="flex gap-3 pt-2"><Button variant="outline" fullWidth onClick={onClose}>انصراف</Button><Button fullWidth onClick={handleSubmit} loading={createTx.isPending}>ثبت پرداخت</Button></div>
      </div>
    </div>
  )
}

// ═══════════════ Customer Detail ═══════════════
function CustomerDetail({ customer, onBack }: { customer: any; onBack: () => void }) {
  const { data: invoicesData, refetch } = useInvoices({ page: 1, limit: 50, sortDirection: "desc" })
  const openInvoices = useMemo(() => {
    if (!invoicesData?.invoices) return []
    return invoicesData.invoices.filter((inv: any) => (inv.customerId === customer.id || inv.customer_id === customer.id) && (inv.status === "pending" || inv.status === "partial"))
  }, [invoicesData, customer.id])
  const totalDebt = openInvoices.reduce((sum, inv) => sum + num(inv.total) - num(inv.paidAmount ?? 0), 0)
  const [showPayment, setShowPayment] = useState(false)

  return (
    <div className="space-y-6">
      <PaymentModal open={showPayment} onClose={() => setShowPayment(false)} customer={customer} openInvoices={openInvoices} onPaid={refetch} />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack}><ChevronLeft className="size-5" /></Button>
        <div><h1 className="text-2xl font-bold text-[var(--hisab-foreground)]">{customer.fullName || customer.name}</h1><p className="text-sm text-[var(--hisab-muted-fg)]">{customer.phone || ""}</p></div>
      </div>
      <Card><CardContent className="p-5">
        <div className="flex items-center justify-between"><div><p className="text-xs text-[var(--hisab-muted-fg)]">کل بدهی</p><p className="text-3xl font-bold text-[var(--hisab-destructive)]">{fmt(totalDebt)} AFN</p></div><Button onClick={() => setShowPayment(true)} icon={<DollarSign className="size-4" />}>ثبت پرداخت</Button></div>
      </CardContent></Card>
      <Card><CardContent className="p-5">
        <h3 className="text-lg font-semibold text-[var(--hisab-foreground)] mb-4">معاملات باز</h3>
        {openInvoices.length === 0 ? <p className="text-center text-sm text-[var(--hisab-muted-fg)] py-8">معامله بازی وجود ندارد</p> : (
          <div className="space-y-3">
            {openInvoices.map((inv: any) => { const remaining = num(inv.total) - num(inv.paidAmount ?? 0); return (
              <div key={inv.id} className="flex items-center justify-between rounded-xl border border-[var(--hisab-border)] p-4">
                <div><p className="font-medium text-[var(--hisab-foreground)]">#{inv.invoiceNumber ?? ""}</p><p className="text-xs text-[var(--hisab-muted-fg)]">{new Date(inv.date).toLocaleDateString("fa-AF")}</p></div>
                <div className="text-right"><p className="font-bold text-[var(--hisab-destructive)]">{fmt(remaining)} AFN</p><p className="text-xs text-[var(--hisab-muted-fg)]">از {fmt(inv.total)} — {fmt(inv.paidAmount ?? 0)} پرداخت شده</p></div>
              </div>
            )})}
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}

// ═══════════════ Main Page ═══════════════
export default function BaqidariPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentCustomer, setPaymentCustomer] = useState<any>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showCreditSale, setShowCreditSale] = useState(false)

  const { data: customersData } = useCustomers({ page: 1, limit: 50, sortDirection: "desc", search: search || undefined })
  const { data: invoicesData } = useInvoices({ page: 1, limit: 200, sortDirection: "desc" })

  const customersWithDebt = useMemo(() => {
    if (!customersData?.customers) return []
    return customersData.customers.map((c: any) => {
      const openInvs = (invoicesData?.invoices || []).filter((inv: any) => (inv.customerId === c.id || inv.customer_id === c.id) && (inv.status === "pending" || inv.status === "partial"))
      const totalDebt = openInvs.reduce((sum, inv) => sum + num(inv.total) - num(inv.paidAmount ?? 0), 0)
      return { ...c, totalDebt, openCount: openInvs.length }
    }).sort((a: any, b: any) => b.totalDebt - a.totalDebt)
  }, [customersData, invoicesData])

  if (selectedCustomerId) {
    const customer = customersData?.customers?.find((c: any) => c.id === selectedCustomerId)
    if (customer) return <CustomerDetail customer={customer} onBack={() => setSelectedCustomerId(null)} />
  }

  return (
    <div className="space-y-6">
      <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
      <PaymentModal open={showPayment} onClose={() => setShowPayment(false)} customer={paymentCustomer}
        openInvoices={paymentCustomer ? invoicesData?.invoices?.filter((inv: any) => (inv.customerId === paymentCustomer.id || inv.customer_id === paymentCustomer.id) && (inv.status === "pending" || inv.status === "partial")) || [] : []}
        onPaid={() => {}} />

      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-[var(--hisab-foreground)]">باقی‌داری</h1><p className="mt-1 text-sm text-[var(--hisab-muted-fg)]">مدیریت حساب مشتریان و بدهی‌ها</p></div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreditSale(true)} icon={<ShoppingCart className="size-4" />}>فاکتور نسیه</Button>
          <Button onClick={() => setShowAddCustomer(true)} icon={<Plus className="size-4" />}>مشتری جدید</Button>
        </div>
      </div>

      <Input placeholder="جستجوی مشتری..." leftIcon={<Search className="size-4" />} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hisab-destructive)]/10"><TrendingUp className="size-5 text-[var(--hisab-destructive)]" /></div><div><p className="text-xl font-bold text-[var(--hisab-foreground)]">{customersWithDebt.filter((c: any) => c.totalDebt > 0).length}</p><p className="text-xs text-[var(--hisab-muted-fg)]">مشتری بدهکار</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hisab-destructive)]/10"><DollarSign className="size-5 text-[var(--hisab-destructive)]" /></div><div><p className="text-xl font-bold text-[var(--hisab-foreground)]">{fmt(customersWithDebt.reduce((s: number, c: any) => s + c.totalDebt, 0))}</p><p className="text-xs text-[var(--hisab-muted-fg)]">کل بدهی (AFN)</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hisab-warning)]/10"><TrendingDown className="size-5 text-[var(--hisab-warning)]" /></div><div><p className="text-xl font-bold text-[var(--hisab-foreground)]">{customersWithDebt.reduce((s: number, c: any) => s + c.openCount, 0)}</p><p className="text-xs text-[var(--hisab-muted-fg)]">معامله باز</p></div></CardContent></Card>
      </div>

      {customersWithDebt.length === 0 ? (
        <EmptyState icon="users" title="هیچ مشتری‌ای ثبت نشده" description="اولین مشتری خود را اضافه کنید." />
      ) : (
        <div className="space-y-3">
          {customersWithDebt.map((customer: any) => (
            <Card key={customer.id} className="cursor-pointer transition-shadow hover:shadow-[var(--hisab-shadow-md)]" onClick={() => setSelectedCustomerId(customer.id)}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${customer.totalDebt > 0 ? 'bg-[var(--hisab-destructive)]/10' : 'bg-[var(--hisab-success)]/10'}`}>
                    <User className={`size-5 ${customer.totalDebt > 0 ? 'text-[var(--hisab-destructive)]' : 'text-[var(--hisab-success)]'}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--hisab-foreground)]">{customer.fullName || customer.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={customer.totalDebt > 0 ? "destructive" : "success"} size="sm">
                        {customer.totalDebt > 0 ? "بدهکار" : "تسویه"}
                      </Badge>
                      {customer.openCount > 0 && (
                        <span className="text-xs text-[var(--hisab-muted-fg)]">{customer.openCount} معامله باز</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {customer.totalDebt > 0 && (
                    <div className="text-right">
                      <p className="font-bold text-[var(--hisab-destructive)]">{fmt(customer.totalDebt)} AFN</p>
                    </div>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); setPaymentCustomer(customer); setShowPayment(true) }}>
                    <DollarSign className="size-4 text-[var(--hisab-success)]" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}