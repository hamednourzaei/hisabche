"use client"

import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useCustomers, useInvoices } from "@hisabche/api"
import { Button, Badge, Card, CardContent, Input, EmptyState } from "@hisabche/ui"
import { Search, User, DollarSign, TrendingUp, TrendingDown, Plus, ShoppingCart } from "lucide-react"
import { AddCustomerModal } from "./AddCustomerModal"
import { PaymentModal } from "./PaymentModal"
import { CustomerDetailView } from "./CustomerDetailView"

interface CustomerRecord { id: string; fullName?: string; name?: string; phone?: string }
interface InvoiceRecord { id: string; invoiceNumber?: string; total: number; paidAmount: number; date: string; status: string; customerId: string }

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")

export function BaqidariPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentCustomer, setPaymentCustomer] = useState<CustomerRecord | null>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)

  const { data: customersData } = useCustomers({ page: 1, limit: 50, sortDirection: "desc", search: search || undefined })
  const { data: invoicesData } = useInvoices({ page: 1, limit: 200, sortDirection: "desc" })

  const customersWithDebt = useMemo(() => {
    if (!customersData?.customers) return []
    const customers = customersData.customers as unknown as CustomerRecord[]
    const invoices = (invoicesData?.invoices ?? []) as unknown as InvoiceRecord[]
    return customers.map((c) => {
      const openInvs = invoices.filter((inv) => inv.customerId === c.id && (inv.status === "pending" || inv.status === "partial"))
      const totalDebt = openInvs.reduce((s, inv) => s + Math.max(0, inv.total - inv.paidAmount), 0)
      return { ...c, totalDebt, openCount: openInvs.length }
    }).sort((a, b) => (b.totalDebt ?? 0) - (a.totalDebt ?? 0))
  }, [customersData, invoicesData])

  if (selectedCustomerId) {
    return <CustomerDetailView customerId={selectedCustomerId} onBack={() => setSelectedCustomerId(null)} />
  }

  return (
    <div className="space-y-6">
      <AddCustomerModal open={showAddCustomer} onClose={() => setShowAddCustomer(false)} />
      <PaymentModal open={showPayment} onClose={() => setShowPayment(false)} customer={paymentCustomer}
        openInvoices={paymentCustomer ? ((invoicesData?.invoices ?? []) as unknown as InvoiceRecord[]).filter((inv) => inv.customerId === paymentCustomer.id && (inv.status === "pending" || inv.status === "partial")) : []}
        onPaid={() => {}} />

      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">{t("baqidari.title")}</h1><p className="mt-1 text-sm text-[var(--hisab-muted-fg)]">{t("baqidari.subtitle")}</p></div>
        <div className="flex gap-2">
          <Button onClick={() => {}} icon={<ShoppingCart className="size-4" />}>{t("baqidari.creditInvoice")}</Button>
          <Button onClick={() => setShowAddCustomer(true)} icon={<Plus className="size-4" />}>{t("baqidari.addCustomer")}</Button>
        </div>
      </div>

      <Input placeholder={t("baqidari.searchPlaceholder")} leftIcon={<Search className="size-4" />} value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="interactive-card"><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hisab-destructive)]/10"><TrendingUp className="size-5 text-[var(--hisab-destructive)]" /></div><div><p className="text-xl font-bold">{customersWithDebt.filter((c) => (c.totalDebt ?? 0) > 0).length}</p><p className="text-xs text-[var(--hisab-muted-fg)]">{t("baqidari.debtorCount")}</p></div></CardContent></Card>
        <Card className="interactive-card"><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hisab-destructive)]/10"><DollarSign className="size-5 text-[var(--hisab-destructive)]" /></div><div><p className="text-xl font-bold">{fmt(customersWithDebt.reduce((s, c) => s + (c.totalDebt ?? 0), 0))}</p><p className="text-xs text-[var(--hisab-muted-fg)]">{t("baqidari.totalDebt")} (AFN)</p></div></CardContent></Card>
        <Card className="interactive-card"><CardContent className="p-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hisab-warning)]/10"><TrendingDown className="size-5 text-[var(--hisab-warning)]" /></div><div><p className="text-xl font-bold">{customersWithDebt.reduce((s, c) => s + (c.openCount ?? 0), 0)}</p><p className="text-xs text-[var(--hisab-muted-fg)]">{t("baqidari.openDeals")}</p></div></CardContent></Card>
      </div>

      {customersWithDebt.length === 0 ? (
        <EmptyState icon="users" title={t("baqidari.empty.title")} description={t("baqidari.empty.subtitle")} />
      ) : (
        <div className="space-y-3">
          {customersWithDebt.map((customer) => (
            <Card key={customer.id} className="interactive-card cursor-pointer" onClick={() => setSelectedCustomerId(customer.id)}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${(customer.totalDebt ?? 0) > 0 ? 'bg-[var(--hisab-destructive)]/10' : 'bg-[var(--hisab-success)]/10'}`}>
                    <User className={`size-5 ${(customer.totalDebt ?? 0) > 0 ? 'text-[var(--hisab-destructive)]' : 'text-[var(--hisab-success)]'}`} />
                  </div>
                  <div>
                    <p className="font-semibold">{customer.fullName || customer.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={(customer.totalDebt ?? 0) > 0 ? "destructive" : "success"} size="sm">{(customer.totalDebt ?? 0) > 0 ? t("baqidari.debtor") : t("baqidari.settled")}</Badge>
                      {(customer.openCount ?? 0) > 0 && <span className="text-xs text-[var(--hisab-muted-fg)]">{customer.openCount} {t("baqidari.openDeals")}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {(customer.totalDebt ?? 0) > 0 && <div className="text-right"><p className="font-bold text-[var(--hisab-destructive)]">{fmt(customer.totalDebt ?? 0)} AFN</p></div>}
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