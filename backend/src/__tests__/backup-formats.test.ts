// Backups for Pro/Enterprise as Markdown and Excel (owner's request).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { backupToMarkdown, backupToXlsx } from '../services/workspace/backup-formats'
import type { WorkspaceBackup } from '../services/workspace/backup.service'

const backup: WorkspaceBackup = {
  meta: {
    workspaceId: 'ws-1',
    exportedAt: '2026-09-26T10:00:00.000Z',
    schemaVersion: '1',
    restorable: false,
    truncatedTables: [],
    failedTables: [],
    totalRows: 2,
  },
  data: {
    invoices: [
      { id: 'i1', number: 'INV-1', total: 30000, note: 'a | b\nc', customer: { name: 'علی' } },
      { id: 'i2', number: 'INV-2', total: 1200.5, note: '=HYPERLINK("x")' },
    ],
    customers: [],
  },
}

export const SAMPLE = backup

describe('Markdown', () => {
  it('a section and a table per data set; pipes and newlines cannot break the table', () => {
    const md = backupToMarkdown(backup)
    expect(md).toContain('## invoices (2)')
    expect(md).toContain('| id | number | total | note | customer |')
    // The pipe is escaped (a table cell), the newline flattened.
    expect(md).toContain('a \\| b c')
    expect(md).toContain('{"name":"علی"}')
    expect(md).toContain('## customers (0)')
  })
})

describe('Excel (.xlsx)', () => {
  const file = backupToXlsx(backup)
  const text = file.toString('latin1')

  it('is a zip with the parts Excel needs, one sheet per data set plus the meta sheet', () => {
    expect(file.subarray(0, 4).toString('latin1')).toBe('PK\u0003\u0004')
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
    ]) {
      expect(text).toContain(part)
    }
    expect(text).toContain('xl/worksheets/sheet3.xml') // backup, invoices, customers
  })

  it('numbers are numbers; a value starting with «=» is TEXT, never a formula', () => {
    const utf8 = file.toString('utf8')
    expect(utf8).toContain('<v>30000</v>')
    expect(utf8).toContain('=HYPERLINK(&quot;x&quot;)')
    expect(utf8).not.toContain('<f>')
    expect(utf8).toContain('علی')
  })
})

describe('the route', () => {
  const src = readFileSync(join(__dirname, '..', 'routes', 'workspace.routes.ts'), 'utf8')
  it('md and xlsx need a paid plan, checked on the server', () => {
    expect(src).toMatch(
      /format !== 'json'[\s\S]{0,400}\['pro', 'enterprise'\]\.includes\(subscription\.plan\)[\s\S]{0,80}isTrial/,
    )
    expect(src).toContain('BACKUP_FORMAT_REQUIRES_PLAN')
  })
})
