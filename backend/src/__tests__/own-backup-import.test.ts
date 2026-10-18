// Owner, 18 Oct 2026: «از تنظیمات دیتابیس خود حسابچه دانلود کردم، مجدداً
// خواستم واردش بکنم، بازم درست تشخیص نداد» — the screen opened on the sheet
// «backup — نامشخص». That sheet is the file's label (key/value: when and from
// where); the customers and products were further down, never chosen.
//
// This round-trips the file THE PRODUCT WRITES (backupToXlsx) through the
// importer's first look (inspectUpload).
import { describe, expect, it } from 'vitest'

import { suggestMapping } from '../services/migration/migration.entities'
import { inspectUpload } from '../services/migration/inspect.domain'
import { backupToXlsx } from '../services/workspace/backup-formats'
import type { WorkspaceBackup } from '../services/workspace/backup.service'

const backup = {
  meta: {
    workspaceId: 'ws',
    exportedAt: '2026-10-18T10:00:00.000Z',
    schemaVersion: '1',
    restorable: false,
    truncatedTables: [],
    failedTables: [],
    totalRows: 4,
  },
  data: {
    // Raw rows, as `select('*')` gives them.
    customers: [
      {
        id: 'c1',
        workspace_id: 'ws',
        name: 'Ali',
        phone: '0700123456',
        email: null,
        address: 'Kabul',
        balance: 10,
        created_at: '2026-10-01T00:00:00Z',
      },
      {
        id: 'c2',
        workspace_id: 'ws',
        name: 'Zahra',
        phone: '0799123456',
        email: 'z@x.af',
        address: '',
        balance: 0,
        created_at: '2026-10-02T00:00:00Z',
      },
    ],
    invoice_items: [{ id: 'l1', invoice_id: 'i1', product_id: 'p1', quantity: 2, unit_price: 100 }],
    products: [
      {
        id: 'p1',
        workspace_id: 'ws',
        name: 'Rice',
        sku: 'R1',
        barcode: '123',
        price: 100,
        cost_price: 80,
        quantity: 5,
        unit: 'kg',
      },
    ],
  },
} as unknown as WorkspaceBackup

const look = () =>
  inspectUpload({
    filename: 'hisabche-backup-2026-10-18.xlsx',
    base64: Buffer.from(backupToXlsx(backup)).toString('base64'),
  })

describe('importing Hisabche’s own backup file', () => {
  it('the label sheet is set aside, not offered as data', () => {
    const seen = look()
    expect(seen.sheets.map((sheet) => sheet.name)).not.toContain('backup')
    expect(seen.sheet?.ignored).toContain('backup')
  })

  it('opens on a sheet whose kind is known: customers, then products', () => {
    const seen = look()
    expect(seen.sheet?.name).toBe('customers')
    expect(seen.detection.entity).toBe('customer')
    const byName = Object.fromEntries(seen.sheets.map((s) => [s.name, s.detection.entity]))
    expect(byName.customers).toBe('customer')
    expect(byName.products).toBe('product')
    // Recognised sheets first, in the workbook's order.
    const known = seen.sheets.filter((s) => s.detection.entity !== null).map((s) => s.name)
    expect(seen.sheets.slice(0, known.length).map((s) => s.name)).toEqual(known)
  })

  it('the backup’s column names are the importer’s own: name and phone map by themselves', () => {
    const seen = look()
    const mapped = suggestMapping('customer', seen.headers)
      .filter((suggestion) => suggestion.targetField)
      .map((suggestion) => suggestion.targetField)
    expect(mapped).toContain('fullName')
    expect(mapped).toContain('phone')
  })
})
