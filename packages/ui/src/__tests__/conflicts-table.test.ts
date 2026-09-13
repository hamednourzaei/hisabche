// ============================================
// The offline conflict queue is a DataTable a person can read at a glance.
//
// What the owner saw before: a list of badges plus a detail panel showing
// «نسخه‌ی سرور: —», raw field names (`quantity`, `shortfall`) and a bare `—`
// for a missing value. «It's not clear at all what is what.»
//
// These assertions pin the redesign: the shared DataTable (no second table),
// plain-language operation and field labels in every locale, missing values
// said in words, the project date formatter, and — unchanged — a reason
// required before any decision is applied.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
}

const view = code(join(__dirname, '..', 'components', 'ui', 'conflicts', 'conflicts-view.tsx'))
const container = code(
  join(__dirname, '..', 'components', 'ui', 'conflicts', 'containers', 'conflicts-container.tsx'),
)

const MESSAGES = join(__dirname, '..', '..', '..', 'i18n', 'messages')
const bundles = ['fa', 'af', 'en'].map((lang) => ({
  lang,
  conflicts: (
    JSON.parse(readFileSync(join(MESSAGES, lang, 'common.json'), 'utf8')) as {
      conflicts: Record<string, unknown>
    }
  ).conflicts,
}))

function setEntries(name: string): string[] {
  const match = new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(view)
  expect(match, `${name} not found`).not.toBeNull()
  return [...match![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
}

describe('conflicts page structure', () => {
  it('renders on the shared DataTable, not a hand-built list', () => {
    expect(view).toContain("from '../data-table'")
    expect(view).toContain('<DataTable')
    expect(view).not.toContain('<ul className="divide-y')
  })

  it('formats time through useDateFormat, not by slicing the ISO string', () => {
    expect(view).toContain('useDateFormat()')
    expect(view).not.toContain(".replace('T', ' ')")
  })

  it('never shows the meaningless server/device version numbers', () => {
    expect(view).not.toContain('serverVersion')
    expect(view).not.toContain('clientVersion')
  })

  it('says a missing value in words instead of a bare dash', () => {
    expect(view).toContain("t('conflicts.not_recorded')")
    expect(view).not.toContain("return '—'")
  })

  it('shows the record name the server resolved', () => {
    expect(view).toContain('entityLabel')
  })

  it('still requires a reason before applying', () => {
    expect(view).toContain("reason.trim() !== ''")
    expect(view).toContain('undecided === 0')
  })

  it('reads the list through asList()', () => {
    expect(container).toContain('asList<Conflict>(conflicts.data)')
  })
})

describe('every label the table can render exists in fa, af and en', () => {
  const keys = [
    ...setEntries('KNOWN_OPERATIONS').map((op) => `op_${op}`),
    ...setEntries('KNOWN_FIELDS').map((field) => `field_${field}`),
    ...[...view.matchAll(/'conflicts\.([a-zA-Z_]+)'/g)].map((m) => m[1]!),
    'choice_keep_server',
    'choice_keep_client',
    'choice_merge',
    'side_server',
    'side_client',
    'status_open',
    'status_resolved',
    'status_all',
  ]

  for (const { lang, conflicts } of bundles) {
    it(lang, () => {
      const missing = [...new Set(keys)].filter((key) => typeof conflicts[key] !== 'string')
      expect(missing).toEqual([])
    })
  }
})
