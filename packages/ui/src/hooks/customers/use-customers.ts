// packages/ui/src/hooks/customers/use-customers.ts
"use client"

import { useMemo } from "react"
import { useCustomers as useCustomersApi, useInvoices } from "@hisabche/api"
import type { Customer, InvoiceForDebt } from "../../lib/customers/customers-types"
import { mapCustomerWithDebt, mapOpenInvoices, mapCustomerDetail } from "../../lib/customers/customers-mappers"

export function useCustomers() {
  const { data: customersData, isLoading: customersLoading } = useCustomersApi({
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
    () => (customersData?.customers ?? []) as unknown as Customer[],
    [customersData]
  )

  const invoices = useMemo(
    () => (invoicesData?.invoices ?? []) as unknown as InvoiceForDebt[],
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