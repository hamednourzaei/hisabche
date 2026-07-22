// packages/db/src/watermelon.schema.ts
// ============================================
// WatermelonDB Schema — Offline-first Storage
// ============================================

import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const watermelonSchema = appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'activities',
      columns: [
        { name: 'entity_type', type: 'string' },
        { name: 'entity_id', type: 'string' },
        { name: 'action', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'actor_id', type: 'string' },
        { name: 'actor_name', type: 'string' },
        { name: 'metadata', type: 'string' },
        { name: 'importance', type: 'number' },
        { name: 'is_read', type: 'boolean' },
        { name: 'is_pinned', type: 'boolean' },
        { name: 'is_archived', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'synced_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'invoices',
      columns: [
        { name: 'invoice_number', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'customer_id', type: 'string' },
        { name: 'supplier_id', type: 'string' },
        { name: 'date', type: 'number' },
        { name: 'due_date', type: 'number' },
        { name: 'subtotal', type: 'number' },
        { name: 'discount_total', type: 'number' },
        { name: 'tax_total', type: 'number' },
        { name: 'total', type: 'number' },
        { name: 'paid_amount', type: 'number' },
        { name: 'currency', type: 'string' },
        { name: 'payment_method', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'notes', type: 'string' },
        { name: 'synced_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'products',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'barcode', type: 'string' },
        { name: 'sku', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'buy_price', type: 'number' },
        { name: 'sell_price', type: 'number' },
        { name: 'wholesale_price', type: 'number' },
        { name: 'min_stock_level', type: 'number' },
        { name: 'description', type: 'string' },
        { name: 'is_active', type: 'boolean' },
        { name: 'synced_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'customers',
      columns: [
        { name: 'full_name', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'opening_balance', type: 'number' },
        { name: 'is_active', type: 'boolean' },
        { name: 'synced_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
})