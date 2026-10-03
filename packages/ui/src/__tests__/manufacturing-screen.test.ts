// ============================================
// The manufacturing screens — one domain, several entry points.
//
// What these guard, each of which was (or would have been) a real defect:
//
//   · a key used on screen that is missing from one locale takes the whole page
//     to the error boundary (`t()` throws);
//   · a server refusal looked up as a translation key when it is not one;
//   · the product page growing its own cost arithmetic beside the editor's;
//   · «تکمیل» going back to flipping a status instead of producing.
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const DIR = join(__dirname, '..', 'components', 'ui', 'manufacturing')

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  )
}

/** Source with comment lines removed, so a comment describing a bug is not the bug. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
}

const sources = [
  ...files(DIR),
  join(ROOT, 'packages', 'validation', 'src', 'schemas', 'manufacturing-cost.ts'),
  join(__dirname, '..', 'components', 'ui', 'dashboard', 'containers', 'dashboard-container.tsx'),
]

function usedKeys(): string[] {
  const keys = new Set<string>()
  const patterns = [
    /['"`](manufacturing\.[A-Za-z0-9_.]+)['"`]\s*,/g,
    /labelKey: '(manufacturing\.[A-Za-z0-9_.]+)'/g,
    /message: '(manufacturing\.[A-Za-z0-9_.]+)'/g,
  ]
  for (const file of sources) {
    const source = readFileSync(file, 'utf8')
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) keys.add(match[1] as string)
    }
  }
  // A prefix (`manufacturing.errors.`) is not a key.
  return [...keys].filter((key) => !key.endsWith('.'))
}

const LOCALES = ['fa', 'af', 'en'] as const
const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(join(ROOT, 'packages', 'i18n', 'messages', locale, 'common.json'), 'utf8'),
    ) as Record<string, unknown>,
  ]),
) as Record<(typeof LOCALES)[number], Record<string, unknown>>

function lookup(tree: Record<string, unknown>, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      tree,
    )
}

describe('manufacturing translations', () => {
  const keys = usedKeys()

  it('finds the keys it is supposed to be checking', () => {
    expect(keys.length).toBeGreaterThan(120)
  })

  it.each(LOCALES)('every key used on screen is a string in %s', (locale) => {
    const missing = keys.filter((key) => typeof lookup(messages[locale], key) !== 'string')
    expect(missing).toEqual([])
  })

  it.each(LOCALES)('every refusal code has a sentence in %s', (locale) => {
    const source = readFileSync(join(DIR, 'manufacturing-errors.ts'), 'utf8')
    const list = source.slice(source.indexOf('['), source.indexOf('] as const'))
    const codes = [...list.matchAll(/'([A-Za-z_]+)'/g)].map((match) => match[1] as string)
    expect(codes.length).toBeGreaterThan(10)
    const missing = codes.filter(
      (code) => typeof lookup(messages[locale], `manufacturing.errors.${code}`) !== 'string',
    )
    expect(missing).toEqual([])
  })

  it('a server message is never looked up as a key outside the closed list', () => {
    for (const file of files(DIR)) {
      if (file.endsWith('manufacturing-errors.ts')) continue
      expect(code(file), file).not.toContain('manufacturing.errors.${')
    }
  })

  it('the direction mark differs between the RTL locales and English', () => {
    expect(lookup(messages.fa, 'manufacturing.arrow')).toBe('←')
    expect(lookup(messages.en, 'manufacturing.arrow')).toBe('→')
  })
})

describe('one manufacturing core, several entry points', () => {
  const container = code(join(DIR, 'containers', 'manufacturing-container.tsx'))
  const panel = code(join(DIR, 'product-manufacturing-panel.tsx'))
  const view = code(join(DIR, 'manufacturing-view.tsx'))
  const editor = code(join(DIR, 'production-editor.tsx'))

  it('the page and the product panel open the SAME editor', () => {
    expect(container).toContain('<ProductionEditor')
    expect(panel).toContain('<ProductionEditor')
  })

  it('the cost is computed in one place on the client — the draft hook', () => {
    const computing = files(DIR).filter((file) => code(file).includes('computeProductionCost('))
    expect(computing.map((file) => file.split(/[\\/]/).pop())).toEqual(['use-production-draft.ts'])
  })

  it('the component table is the invoice grid, not a second table', () => {
    expect(editor).toContain("from '../invoice-builder/grid/invoice-items-grid'")
    expect(editor).toContain("from '../invoice-builder/column-dialog'")
    expect(editor).toContain('pickAs="component"')
  })

  it('warehouse and product creation reuse the existing dialogs', () => {
    expect(editor).toContain("from '../warehouse/warehouse-dialogs'")
    expect(editor).toContain("from '../add-product-modal'")
  })

  it('«تکمیل» opens the production form; no status-only completion remains', () => {
    expect(view).toContain('onCompleteWorkOrder(workOrder)')
    expect(container).not.toContain('useCompleteWorkOrder')
    const hooks = code(join(ROOT, 'packages', 'api', 'src', 'hooks', 'manufacturing.ts'))
    expect(hooks).not.toContain('/complete')
  })

  it('a retry reuses its idempotency key; only a success takes a new one', () => {
    const produce = editor.slice(
      editor.indexOf('const handleProduce'),
      editor.indexOf('const busy'),
    )
    const success = produce.slice(produce.indexOf('onSuccess'), produce.indexOf('onError'))
    const failure = produce.slice(produce.indexOf('onError'))
    expect(success).toContain('idempotencyKey.current = newIdempotencyKey()')
    expect(failure).not.toContain('newIdempotencyKey()')
  })

  it('the product page mounts the panel', () => {
    const page = code(
      join(
        __dirname,
        '..',
        'components',
        'ui',
        'warehouse-detail',
        'containers',
        'warehouse-detail-container.tsx',
      ),
    )
    expect(page).toContain('<ProductManufacturingPanel')
  })
})

describe('house rules in the manufacturing screens', () => {
  it.each(files(DIR))('%s uses tokens and logical properties only', (file) => {
    const source = code(file)
    expect(source).not.toMatch(/#[0-9a-fA-F]{6}\b/)
    expect(source).not.toMatch(/\b(?:ml|mr|pl|pr)-\d/)
    expect(source).not.toMatch(/\btext-(?:left|right)\b/)
    expect(source).not.toMatch(/\b(?:bg|text|border)-(?:red|green|blue|gray|slate|amber)-\d{3}\b/)
  })
})
