// ============================================
// backend/src/services/workspace/backup-formats.ts
//
// The workspace backup (backup.service.ts) as a file a person can open:
//   • Markdown — one section and one table per data set, readable anywhere
//   • Excel (.xlsx) — one sheet per data set
//
// ⚠️ A REAL .xlsx, WITH NO LIBRARY. An .xlsx is a zip of a few XML files.
// Written here with an uncompressed ("stored") zip and Node's own crc32
// (zlib.crc32, Node ≥ 22.2 — Render runs 22.22), rather than adding a
// dependency for one export. Cells are inline strings or numbers; nothing is
// a formula, so a value starting with «=» is text, not an instruction
// (no CSV/formula injection).
// ============================================

import { crc32 } from 'node:zlib'

import type { WorkspaceBackup } from './backup.service'

// ─── Shared ────────────────────────────────────────────────────────────────

/** Union of keys across rows, in first-seen order. */
function columnsOf(rows: unknown[]): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    if (row && typeof row === 'object') for (const key of Object.keys(row)) seen.add(key)
  }
  return [...seen]
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// ─── Markdown ──────────────────────────────────────────────────────────────

function mdEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

export function backupToMarkdown(backup: WorkspaceBackup): string {
  const lines: string[] = [
    '# Hisabche backup',
    '',
    `- Workspace: \`${backup.meta.workspaceId}\``,
    `- Exported at: ${backup.meta.exportedAt}`,
    `- Rows: ${backup.meta.totalRows}`,
    `- Schema version: ${backup.meta.schemaVersion}`,
  ]
  if (backup.meta.truncatedTables.length > 0) {
    lines.push(`- ⚠️ Cut at the row cap: ${backup.meta.truncatedTables.join(', ')}`)
  }
  for (const failed of backup.meta.failedTables) {
    lines.push(`- ⚠️ Not exported: ${failed.name} (${failed.error})`)
  }
  for (const [name, rows] of Object.entries(backup.data)) {
    lines.push('', `## ${name} (${rows.length})`, '')
    if (rows.length === 0) {
      lines.push('_empty_')
      continue
    }
    const columns = columnsOf(rows)
    lines.push(`| ${columns.map(mdEscape).join(' | ')} |`)
    lines.push(`| ${columns.map(() => '---').join(' | ')} |`)
    for (const row of rows) {
      const record = row as Record<string, unknown>
      lines.push(`| ${columns.map((c) => mdEscape(cellText(record[c]))).join(' | ')} |`)
    }
  }
  return lines.join('\n') + '\n'
}

// ─── XLSX ──────────────────────────────────────────────────────────────────

/**
 * Drops C0 control characters other than tab, newline and carriage return —
 * XML 1.0 forbids them, and one would make Excel refuse the whole file.
 */
function withoutControlChars(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) out += ch
  }
  return out
}

function xmlEscape(text: string): string {
  return withoutControlChars(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function columnName(index: number): string {
  let name = ''
  let n = index + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return name
}

function cell(ref: string, value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value))
    return `<c r="${ref}"><v>${value}</v></c>`
  const text = cellText(value)
  if (text === '') return ''
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`
}

function sheetXml(rows: unknown[]): string {
  const columns = columnsOf(rows)
  const out: string[] = []
  const header = columns.map((c, i) => cell(`${columnName(i)}1`, c)).join('')
  out.push(`<row r="1">${header}</row>`)
  rows.forEach((row, r) => {
    const record = row as Record<string, unknown>
    const cells = columns.map((c, i) => cell(`${columnName(i)}${r + 2}`, record[c])).join('')
    out.push(`<row r="${r + 2}">${cells}</row>`)
  })
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${out.join('')}</sheetData></worksheet>`
  )
}

/** Excel's rules: ≤ 31 characters, none of []:*?/\ , unique. */
function sheetNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((raw) => {
    const base = raw.replace(/[[\]:*?/\\]/g, '_').slice(0, 28) || 'sheet'
    let name = base
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base}_${i}`
    used.add(name.toLowerCase())
    return name
  })
}

/** A minimal zip: every entry stored (no compression), UTF-8 names. */
function zip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const crc = crc32(file.data) >>> 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(0, 8) // stored
    local.writeUInt32LE(0, 10) // time/date
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(file.data.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, name, file.data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt32LE(0, 12)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(file.data.length, 20)
    central.writeUInt32LE(file.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)
    offset += 30 + name.length + file.data.length
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

export function backupToXlsx(backup: WorkspaceBackup): Buffer {
  const entries = Object.entries(backup.data)
  const meta: unknown[] = [
    { key: 'workspaceId', value: backup.meta.workspaceId },
    { key: 'exportedAt', value: backup.meta.exportedAt },
    { key: 'totalRows', value: backup.meta.totalRows },
    { key: 'truncatedTables', value: backup.meta.truncatedTables.join(', ') },
    {
      key: 'failedTables',
      value: backup.meta.failedTables.map((f) => `${f.name}: ${f.error}`).join('; '),
    },
  ]
  const sheets = [
    { name: 'backup', rows: meta },
    ...entries.map(([name, rows]) => ({ name, rows })),
  ]
  const names = sheetNames(sheets.map((s) => s.name))

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    names
      .map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    '</sheets></workbook>'
  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    names
      .map(
        (_n, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    '</Relationships>'
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    names
      .map(
        (_n, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '</Types>'
  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'

  return zip([
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes) },
    { name: '_rels/.rels', data: Buffer.from(rootRels) },
    { name: 'xl/workbook.xml', data: Buffer.from(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(workbookRels) },
    ...sheets.map((sheet, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(sheetXml(sheet.rows)),
    })),
  ])
}
