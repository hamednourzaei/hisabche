// ============================================
// packages/api/src/__tests__/dashboard-offline-read.test.ts
//
// Offline, the dashboard reads the DEVICE (D10): the local engine's
// `/analytics/sales` and `/analytics/dashboard`, so the shop sees the books it
// holds instead of a spinner. Only that read knows how many sales are still
// waiting in the outbox — and «unknown» must not become «0 waiting».
//
// The path tested is the one a person takes: a registered local transport and
// the host saying «offline». Nothing here reaches the network.
// ============================================

import { beforeEach, describe, expect, it } from 'vitest'

import { registerLocalTransport, type LocalTransportRequest } from '../lib/client'
import { registerOfflineQueue } from '../lib/offline-queue'
import { readDashboardKpisFromDevice, readDashboardSalesFromDevice } from '../hooks/dashboard'

let offline = true
let requests: LocalTransportRequest[] = []
let answers: Record<string, unknown> = {}

beforeEach(() => {
  offline = true
  requests = []
  answers = {}

  registerOfflineQueue({ isOffline: () => offline, enqueue: async () => {} })
  registerLocalTransport(async (request) => {
    requests.push(request)
    return { status: 200, data: answers[request.path] ?? {} }
  })
})

describe('the dashboard offline', () => {
  it('reads the device’s sales, and the number waiting to be confirmed', async () => {
    answers['/analytics/sales'] = {
      chartData: [
        { label: '2026-10-20', date: '2026-10-20', value: 30_000, invoiceCount: 2 },
        { label: '2026-10-21', date: '2026-10-21', value: 12_000, invoiceCount: 1 },
      ],
      pendingInvoiceCount: 3,
    }

    const sales = await readDashboardSalesFromDevice('2026-10-01', '2026-10-31')

    expect(sales).not.toBeNull()
    // The label's number, and the same total a person reads on the card.
    expect(sales?.pendingInvoiceCount).toBe(3)
    expect(sales?.total).toBe(42_000)
    // The average is per INVOICE, not per day: 42,000 across 3 invoices.
    expect(sales?.average).toBe(14_000)
    expect(requests.map((request) => request.path)).toEqual(['/analytics/sales'])
  })

  it('counts only the days the picker asked for', async () => {
    answers['/analytics/sales'] = {
      chartData: [
        { label: '2026-09-01', date: '2026-09-01', value: 99_000, invoiceCount: 9 },
        { label: '2026-10-21', date: '2026-10-21', value: 12_000, invoiceCount: 1 },
      ],
      pendingInvoiceCount: 1,
    }

    const sales = await readDashboardSalesFromDevice('2026-10-01', '2026-10-31')

    expect(sales?.total).toBe(12_000)
    expect(sales?.average).toBe(12_000)
  })

  it('leaves the count unknown when the device does not send one', async () => {
    answers['/analytics/sales'] = {
      chartData: [{ label: '2026-10-21', date: '2026-10-21', value: 1_000, invoiceCount: 1 }],
    }

    const sales = await readDashboardSalesFromDevice('2026-10-01', '2026-10-31')

    // NOT 0: «we could not read it» and «none are waiting» are two sentences.
    expect(sales?.pendingInvoiceCount).toBeUndefined()
  })

  it('reads the device’s KPIs', async () => {
    answers['/analytics/dashboard'] = {
      todaySales: 5_000,
      todayInvoices: 2,
      monthlyRevenue: 40_000,
      monthlyGrowth: 0,
      pendingPayments: 1_500,
      pendingPaymentsCount: 1,
      activeCustomers: 7,
      customerGrowth: 0,
      lowStockAlerts: 1,
      totalSales: 40_000,
      customerDebt: 1_500,
      warehouseValue: 20_000,
    }

    const kpis = await readDashboardKpisFromDevice()

    expect(kpis?.todaySales).toBe(5_000)
    expect(kpis?.activeCustomers).toBe(7)
    expect(requests.map((request) => request.path)).toEqual(['/analytics/dashboard'])
  })

  it('does not touch the device while there is a network', async () => {
    offline = false
    answers['/analytics/sales'] = { chartData: [], pendingInvoiceCount: 4 }

    await expect(readDashboardSalesFromDevice('2026-10-01', '2026-10-31')).resolves.toBeNull()
    await expect(readDashboardKpisFromDevice()).resolves.toBeNull()
    expect(requests).toEqual([])
  })
})
