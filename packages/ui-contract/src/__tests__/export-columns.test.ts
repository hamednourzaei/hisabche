// ============================================
// Export contract.
//
// An export gets filed and reconciled outside the product. These tests pin the
// properties an accountant would notice if they broke: the same columns in the
// same order regardless of which platform produced the file, and a purchase
// that never leaves labelled as a sale.
// ============================================

import { describe, expect, it } from 'vitest'

import {
  INVOICE_EXPORT_COLUMNS,
  invoiceTypeLabelKey,
  resolveExportColumns,
} from '../export-columns'

describe('invoice export columns', () => {
  it('pins the column order every platform must emit', () => {
    expect(INVOICE_EXPORT_COLUMNS.map((c) => c.key)).toEqual([
      'typeLabel',
      'invoiceNumber',
      'date',
      'customerName',
      'company',
      'total',
      'currency',
      'status',
      'paymentDate',
    ])
  })

  it('exports a localised type label, not the raw field', () => {
    // Exporting `type` directly would file a purchase as the English string
    // "purchase" in a Persian spreadsheet; exporting a *sale-defaulted* label
    // would file it as a sale outright.
    expect(INVOICE_EXPORT_COLUMNS[0]?.key).toBe('typeLabel')
    expect(invoiceTypeLabelKey('purchase')).toBe('invoices.type.purchase')
    expect(invoiceTypeLabelKey('sale')).toBe('invoices.type.sale')
  })

  it('defaults an unset type to sale, matching the invoice list', () => {
    expect(invoiceTypeLabelKey(undefined)).toBe('invoices.type.sale')
    expect(invoiceTypeLabelKey(null)).toBe('invoices.type.sale')
    expect(invoiceTypeLabelKey('')).toBe('invoices.type.sale')
  })

  it('names the party column neutrally — the export mixes both directions', () => {
    const party = INVOICE_EXPORT_COLUMNS.find((c) => c.key === 'customerName')

    expect(party?.labelKey).toBe('invoices.party')
    expect(party?.fallback).toBe('طرف حساب')
  })

  it('never resolves a heading to a raw translation key', () => {
    const columns = resolveExportColumns(INVOICE_EXPORT_COLUMNS, (key, fallback) => fallback ?? key)

    for (const column of columns) {
      expect(column.label).not.toContain('invoices.')
      expect(column.label.length).toBeGreaterThan(0)
    }
  })
})
