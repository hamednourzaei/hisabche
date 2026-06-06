// packages/ui/src/hooks/use-baqidari.ts
"use client"

import { useMemo } from "react"
import { useCustomers, useInvoices } from "@hisabche/api"
import type { Customer, InvoiceForDebt } from "../../lib/baqidari/baqidari-types"
import { mapCustomerWithDebt, mapOpenInvoices, mapCustomerDetail } from "../../lib/baqidari/baqidari-mappers"

export function useBaqidari() {
  const { data: customersData, isLoading: customersLoading } = useCustomers({
    page: 1,
    limit: 50,
    sortDirection: "desc",
  })

  const { data: invoicesData, isLoading: invoicesLoading, refetch } = useInvoices({
    page: 1,
    limit: 200,
    sortDirection: "desc",
  })

  const customers = useMemo(
    () => (customersData?.customers ?? []) as Customer[],
    [customersData]
  )

  const invoices = useMemo(
    () => (invoicesData?.invoices ?? []) as InvoiceForDebt[],
    [invoicesData]
  )

  const customersWithDebt = useMemo(
    () => mapCustomerWithDebt(customers, invoices),
    [customers, invoices]
  )

  const debtorCount = useMemo(
    () => customersWithDebt.filter((c) => (c.totalDebt ?? 0) > 0).length,
    [customersWithDebt]
  )

  const totalDebt = useMemo(
    () => customersWithDebt.reduce((s, c) => s + (c.totalDebt ?? 0), 0),
    [customersWithDebt]
  )

  const openDealsCount = useMemo(
    () => customersWithDebt.reduce((s, c) => s + (c.openCount ?? 0), 0),
    [customersWithDebt]
  )

  const getOpenInvoicesForCustomer = (customerId: string) =>
    mapOpenInvoices(invoices, customerId)

  const getCustomerDetail = (customerId: string, t: (key: string) => string) =>
    mapCustomerDetail(customers, customerId, t)

  return {
    customersWithDebt,
    debtorCount,
    totalDebt,
    openDealsCount,
    customersLoading,
    invoicesLoading,
    refetchInvoices: refetch,
    getOpenInvoicesForCustomer,
    getCustomerDetail,
  }
}