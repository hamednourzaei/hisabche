// ============================================
// packages/validation/src/schemas/analytics.schema.ts
// ============================================

import { z } from 'zod'
import {
  uuidSchema,
  isoDateSchema,
} from './common.schema'

// ============================================
// Date Range
// ============================================

export const dateRangeSchema = z.object({
  startDate: isoDateSchema,
  endDate: isoDateSchema,
})

export type DateRange = z.infer<typeof dateRangeSchema>

// ============================================
// Sales Analytics
// ============================================

export const salesSummarySchema = z.object({
  totalRevenue: z.number(),
  totalInvoices: z.number(),
  averageInvoiceValue: z.number(),
  totalPaid: z.number(),
  totalUnpaid: z.number(),
  byCurrency: z.record(z.number()),
  byPeriod: z.array(z.object({
    period: z.string(),
    revenue: z.number(),
    count: z.number(),
  })),
  topProducts: z.array(z.object({
    productId: uuidSchema,
    productName: z.string(),
    quantity: z.number(),
    revenue: z.number(),
  })),
  topCustomers: z.array(z.object({
    customerId: uuidSchema,
    customerName: z.string(),
    revenue: z.number(),
    invoiceCount: z.number(),
  })),
})

export type SalesSummary = z.infer<typeof salesSummarySchema>

// ============================================
// Inventory Analytics
// ============================================

export const inventorySummarySchema = z.object({
  totalProducts: z.number(),
  totalStockValue: z.number(),
  lowStockProducts: z.number(),
  outOfStockProducts: z.number(),
  byCategory: z.array(z.object({
    category: z.string(),
    count: z.number(),
    totalValue: z.number(),
  })),
  topMovements: z.array(z.object({
    productId: uuidSchema,
    productName: z.string(),
    movementType: z.string(),
    quantity: z.number(),
    date: z.string(),
  })),
})

export type InventorySummary = z.infer<typeof inventorySummarySchema>

// ============================================
// Financial Analytics
// ============================================

export const financialSummarySchema = z.object({
  totalRevenue: z.number(),
  totalExpenses: z.number(),
  netProfit: z.number(),
  accountsReceivable: z.number(),
  accountsPayable: z.number(),
  cashFlow: z.array(z.object({
    period: z.string(),
    inflow: z.number(),
    outflow: z.number(),
    net: z.number(),
  })),
  byAccountType: z.record(z.number()),
})

export type FinancialSummary = z.infer<typeof financialSummarySchema>

// ============================================
// Dashboard KPIs
// ============================================

export const dashboardKpisSchema = z.object({
  todaySales: z.number(),
  todayInvoices: z.number(),
  monthlyRevenue: z.number(),
  monthlyGrowth: z.number(),
  pendingPayments: z.number(),
  activeCustomers: z.number(),
  lowStockAlerts: z.number(),
  recentActivity: z.array(z.object({
    type: z.string(),
    message: z.string(),
    timestamp: z.string(),
  })),
})

export type DashboardKpis = z.infer<typeof dashboardKpisSchema>