"use client"

import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useCustomers, useInvoices } from "@hisabche/api"
import { Button } from "../button"
import { Badge } from "../badge"
import { Card, CardContent } from "../card"
import { Input } from "../input"
import { EmptyState } from "../empty-state"
import {
  Search,
  User,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  ShoppingCart,
} from "lucide-react"
import { AddCustomerModal } from "./AddCustomerModal"
import { PaymentModal } from "./PaymentModal"
import { CustomerDetailContainer } from "./containers/customer-detail-container"

interface CustomerRecord {
  id: string
  fullName?: string
  name?: string
  phone?: string
}

interface InvoiceRecord {
  id: string
  invoiceNumber?: string
  total: number
  paidAmount: number
  date: string
  status: string
  customerId: string
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmt = (v: unknown): string => num(v).toLocaleString("fa-AF")

export function BaqidariPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentCustomer, setPaymentCustomer] = useState<CustomerRecord | null>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)

  const { data: customersData } = useCustomers({
    page: 1,
    limit: 50,
    sortDirection: "desc",
    search: search || undefined,
  })
  const { data: invoicesData } = useInvoices({
    page: 1,
    limit: 200,
    sortDirection: "desc",
  })

  const customersWithDebt = useMemo(() => {
    if (!customersData?.customers) return []
    const customers = customersData.customers as unknown as CustomerRecord[]
    const invoices = (invoicesData?.invoices ?? []) as unknown as InvoiceRecord[]
    return customers
      .map((c) => {
        const openInvs = invoices.filter(
          (inv) =>
            inv.customerId === c.id &&
            (inv.status === "pending" || inv.status === "partial")
        )
        const totalDebt = openInvs.reduce(
          (s, inv) => s + Math.max(0, inv.total - inv.paidAmount),
          0
        )
        return { ...c, totalDebt, openCount: openInvs.length }
      })
      .sort((a, b) => (b.totalDebt ?? 0) - (a.totalDebt ?? 0))
  }, [customersData, invoicesData])

  const paymentInvoices = useMemo(() => {
    if (!paymentCustomer) return []
    const invoices = (invoicesData?.invoices ?? []) as unknown as InvoiceRecord[]
    return invoices.filter(
      (inv) =>
        inv.customerId === paymentCustomer.id &&
        (inv.status === "pending" || inv.status === "partial")
    )
  }, [invoicesData, paymentCustomer])

  if (selectedCustomerId) {
    return (
      <CustomerDetailContainer
        customerId={selectedCustomerId}
        onBack={() => setSelectedCustomerId(null)}
      />
    )
  }

  const debtorCount = customersWithDebt.filter((c) => (c.totalDebt ?? 0) > 0).length
  const totalDebt = customersWithDebt.reduce((s, c) => s + (c.totalDebt ?? 0), 0)
  const openDealsCount = customersWithDebt.reduce((s, c) => s + (c.openCount ?? 0), 0)

  return (
    <div className="space-y-6">
      <AddCustomerModal
        open={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
      />

      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        customer={paymentCustomer}
        openInvoices={paymentInvoices as InvoiceRecord[]}
        onPaid={() => {}}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold sm:text-3xl text-foreground">
            {t("baqidari.title", "باقیداری")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("baqidari.subtitle", "مدیریت بدهی‌ها و پرداخت‌ها")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {}}
            className="gap-2"
          >
            <ShoppingCart className="size-4" aria-hidden />
            {t("baqidari.creditInvoice", "فاکتور نسیه")}
          </Button>
          <Button
            onClick={() => setShowAddCustomer(true)}
            className="shimmer-btn gap-2"
          >
            <Plus className="size-4" aria-hidden />
            {t("baqidari.addCustomer", "افزودن مشتری")}
          </Button>
        </div>
      </div>

      <div className="max-w-sm">
        <Input
          placeholder={t("baqidari.searchPlaceholder", "جستجوی مشتری...")}
          leftIcon={<Search className="size-4" aria-hidden />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="glass-card bg-gradient-to-br from-rose-500/10 to-rose-500/[0.02] border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
              <TrendingUp className="size-5 text-rose-500" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {debtorCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("baqidari.debtorCount", "تعداد بدهکاران")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card bg-gradient-to-br from-rose-500/10 to-rose-500/[0.02] border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
              <DollarSign className="size-5 text-rose-500" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {fmt(totalDebt)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("baqidari.totalDebt", "مجموع بدهی")} (AFN)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02] border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <TrendingDown className="size-5 text-amber-500" aria-hidden />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {openDealsCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("baqidari.openDeals", "معاملات باز")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {customersWithDebt.length === 0 ? (
        <EmptyState
          icon="users"
          title={t("baqidari.empty.title", "هیچ مشتری‌ای یافت نشد")}
          description={t("baqidari.empty.subtitle", "با افزودن مشتری جدید شروع کنید")}
        />
      ) : (
        <div className="space-y-3">
          {customersWithDebt.map((customer) => {
            const hasDebt = (customer.totalDebt ?? 0) > 0
            return (
              <Card
                key={customer.id}
                className="interactive-card cursor-pointer border-border hover:border-primary/30 transition-all"
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3 text-start">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        hasDebt ? "bg-rose-500/10" : "bg-emerald-500/10"
                      }`}
                    >
                      <User
                        className={`size-5 ${
                          hasDebt ? "text-rose-500" : "text-emerald-500"
                        }`}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {customer.fullName || customer.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Badge variant={hasDebt ? "destructive" : "success"}>
                          {hasDebt
                            ? t("baqidari.debtor", "بدهکار")
                            : t("baqidari.settled", "تسویه")}
                        </Badge>
                        {(customer.openCount ?? 0) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {customer.openCount} {t("baqidari.openDeals", "معامله باز")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="ms-3 flex shrink-0 items-center gap-3">
                    {hasDebt && (
                      <div className="text-end">
                        <p className="font-bold tabular-nums text-rose-500">
                          {fmt(customer.totalDebt ?? 0)} AFN
                        </p>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPaymentCustomer(customer)
                        setShowPayment(true)
                      }}
                      aria-label={t("baqidari.recordPaymentFor", {
                        defaultValue: `ثبت پرداخت برای ${customer.fullName || customer.name}`,
                      })}
                    >
                      <DollarSign className="size-4 text-emerald-500" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}