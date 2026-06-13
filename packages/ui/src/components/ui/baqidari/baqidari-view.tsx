// packages/ui/src/components/ui/baqidari/baqidari-view.tsx
"use client"

import { Button } from "../button"
import { Input } from "../input"
import { EmptyState } from "../empty-state"
import { Plus, ShoppingCart, Search } from "lucide-react"
import { BaqidariStats } from "./baqidari-stats"
import { BaqidariCustomerList } from "./baqidari-customer-list"
import { AddCustomerModal } from "./AddCustomerModal"
import { PaymentModal } from "./PaymentModal"
import { CustomerDetailContainer } from "./containers/customer-detail-container"
import type { CustomerWithDebt, InvoiceForDebt } from "../../../lib/baqidari/baqidari-types"

interface BaqidariViewProps {
  t: (key: string, fallback?: string) => string
  fmt: (v: number) => string
  search: string
  onSearchChange: (value: string) => void
  customersWithDebt: CustomerWithDebt[]
  debtorCount: number
  totalDebt: number
  openDealsCount: number
  isLoading: boolean
  selectedCustomerId: string | null
  onSelectCustomer: (id: string) => void
  onClearSelection: () => void
  showAddModal: boolean
  onOpenAddModal: () => void
  onCloseAddModal: () => void
  showPaymentModal: boolean
  paymentCustomer: CustomerWithDebt | null
  paymentInvoices: InvoiceForDebt[]
  onOpenPayment: (customer: CustomerWithDebt) => void
  onClosePayment: () => void
  onPaymentSuccess: () => void
  onNewCreditInvoice: () => void
}

export function BaqidariView({
  t,
  fmt,
  search,
  onSearchChange,
  customersWithDebt,
  debtorCount,
  totalDebt,
  openDealsCount,
  isLoading,
  selectedCustomerId,
  onSelectCustomer,
  onClearSelection,
  showAddModal,
  onOpenAddModal,
  onCloseAddModal,
  showPaymentModal,
  paymentCustomer,
  paymentInvoices,
  onOpenPayment,
  onClosePayment,
  onPaymentSuccess,
  onNewCreditInvoice,
}: BaqidariViewProps) {
  // Show customer detail if selected
  if (selectedCustomerId) {
    return (
      <CustomerDetailContainer
        customerId={selectedCustomerId}
        onBack={onClearSelection}
      />
    )
  }

  return (
    <div className="space-y-6">
      <AddCustomerModal
        open={showAddModal}
        onClose={onCloseAddModal}
        onCreated={() => {}}
      />

      <PaymentModal
        open={showPaymentModal}
        onClose={onClosePayment}
        onPaid={onPaymentSuccess}
        customer={paymentCustomer}
        openInvoices={paymentInvoices}
      />

      {/* Header */}
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
          <Button onClick={onNewCreditInvoice} className="gap-2">
            <ShoppingCart className="size-4" aria-hidden />
            {t("baqidari.creditInvoice", "فاکتور نسیه")}
          </Button>
          <Button onClick={onOpenAddModal} className="shimmer-btn gap-2">
            <Plus className="size-4" aria-hidden />
            {t("baqidari.addCustomer", "افزودن مشتری")}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder={t("baqidari.searchPlaceholder", "جستجوی مشتری...")}
          startIcon={<Search className="size-4" aria-hidden />}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Stats */}
      <BaqidariStats
        t={t}
        debtorCount={debtorCount}
        totalDebt={totalDebt}
        openDealsCount={openDealsCount}
        fmt={fmt}
      />

      {/* Customer List or Empty State */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-shimmer h-24 rounded-xl" />
          ))}
        </div>
      ) : customersWithDebt.length === 0 ? (
        <EmptyState
          icon="users"
          title={t("baqidari.empty.title", "هیچ مشتری‌ای یافت نشد")}
          description={t("baqidari.empty.subtitle", "با افزودن مشتری جدید شروع کنید")}
          action={{
            label: t("baqidari.addCustomer", "افزودن مشتری"),
            onClick: onOpenAddModal,
          }}
        />
      ) : (
        <BaqidariCustomerList
          t={t}
          fmt={fmt}
          customers={customersWithDebt}
          onSelectCustomer={onSelectCustomer}
          onPaymentClick={(customer, e) => {
            e.stopPropagation()
            onOpenPayment(customer)
          }}
        />
      )}
    </div>
  )
}