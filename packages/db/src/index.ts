// packages/db/src/index.ts
// ============================================
// Only type exports — safe for web, mobile, backend
// ============================================

// ─── Types ────────────────────────────────────────────────────────────────────
import type InvoiceType from './models/Invoice.model'
import type ProductType from './models/Product.model'
import type CustomerType from './models/Customer.model'

export type Invoice = InvoiceType
export type Product = ProductType
export type Customer = CustomerType

// ─── Schema ──────────────────────────────────────────────────────────────────
export type { hisabcheSchema } from './schema'

// ─── Drizzle Schema ─────────────────────────────────────────────────────────
export * from './schema'

// ─── Supabase Types ─────────────────────────────────────────────────────────
export type { Database } from './supabase/types'

// ─── Drizzle Client ─────────────────────────────────────────────────────────
export { db, client } from './client'

// ─── Watermelon DB ──────────────────────────────────────────────────────────
export { database, performSync, Invoice, Product, Customer } from './database'
export { syncQueue } from './sync-queue'