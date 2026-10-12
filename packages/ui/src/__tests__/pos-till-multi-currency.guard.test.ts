// ============================================
// packages/ui/src/__tests__/pos-till-multi-currency.guard.test.ts
//
// Guards for Till («صندوق»):
// - Add-till dialog: name + currency from CURRENCY_CODES, no hardcoded currency
// - KPI section: no layout jump (<Loading> not above KPI section; renders Skeletons in cards)
// - One list → one till's ledger: List state renders tills table; Detail state renders ledger
// - i18n keys complete in fa, af, en
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')

/** Source with comments stripped and whitespace flattened */
function code(source: string): string {
  return source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')
}

const tillView = code(read('packages', 'ui', 'src', 'components', 'ui', 'till', 'till-view.tsx'))
const tillContainer = code(
  read('packages', 'ui', 'src', 'components', 'ui', 'till', 'containers', 'till-container.tsx'),
)

describe('Guard: Add-till dialog (Part 1)', () => {
  it('dialog has optional name with name="label"', () => {
    expect(tillView).toContain('data-add-till')
    expect(tillView).toContain('name="label"')
  })

  it('dialog uses SelectField fed from CURRENCY_CODES with bookCurrency default and no hardcoded currency', () => {
    expect(tillView).toContain('CURRENCY_CODES')
    expect(tillView).toContain('bookCurrency')
    // Must not hardcode AFN as the currency default in the add till state
    expect(tillView).not.toContain("useState<string>('AFN')")
    expect(tillView).not.toContain("useState('AFN')")
  })
})

const apiHooks = code(read('packages', 'api', 'src', 'hooks', 'till.ts'))

describe('Guard: No layout jump in KPI section (Part 3)', () => {
  it('Loading indicator is not placed above the KPI section', () => {
    // The top-level loading check above the 4 KPI cards is removed
    expect(tillView).not.toMatch(/isTotalsLoading\s*\?\s*\(?\s*<Loading/)
    expect(tillView).not.toMatch(/isTotalsLoading\s*&&\s*<Loading/)
  })

  it('renders KPI cards immediately with Skeleton states inside cards when loading', () => {
    expect(tillView).toContain("aria-label={t('till.kpis', 'خلاصه‌ی امروز صندوق')}")
    expect(tillView).toContain('isSessionLoading ? ( <Skeleton className="h-7 w-20" /> )')
    expect(tillView).toContain('isCashFlowLoading ? ( <Skeleton className="h-7 w-20" /> )')
  })
})

describe('Guard: One list to one till ledger (Part 4)', () => {
  it('useSessionLedger is enabled only when a till is selected', () => {
    expect(tillContainer).toContain('const ledger = useSessionLedger(selectedTillId)')
    expect(tillContainer).toContain('isLedgerLoading={!!selectedTillId && ledger.isLoading}')
    expect(apiHooks).toContain('useSessionLedger(sessionId: string | null)')
    expect(apiHooks).toContain('enabled: ready && !!sessionId')
  })

  it('renders tills DataTable when no till selected, and ledger only in detail view', () => {
    // List view when !selectedTillId
    expect(tillView).toContain('!selectedTillId')
    // Back button in detail view
    expect(tillView).toContain('onBackToList')
    expect(tillView).toContain('till.back_to_tills')
  })
})

describe('Guard: i18n completeness across fa, af, en', () => {
  const REQUIRED_KEYS = [
    'till.back_to_tills',
    'till.direction_in',
    'till.direction_out',
    'till.col_currency',
    'till.currency',
    'till.filter_currency',
    'till.select_a_till',
    'till.error_POS_CURRENCY_MISMATCH',
    'till.error_POS_CURRENCY_SCHEMA_REQUIRED',
    'till.foreign_not_posted',
    'till.not_found',
    'till.movement_direction',
    'till.record_movement',
    'till.unattached_invoice_payment',
  ]

  function getNested(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((curr, part) => {
      if (curr && typeof curr === 'object') {
        return (curr as Record<string, unknown>)[part]
      }
      return undefined
    }, obj)
  }

  for (const lang of ['fa', 'af', 'en']) {
    it(`all required till keys exist and are non-empty in ${lang}`, () => {
      const messages = JSON.parse(
        read('packages', 'i18n', 'messages', lang, 'common.json'),
      ) as Record<string, unknown>

      for (const key of REQUIRED_KEYS) {
        const val = getNested(messages, key)
        expect(
          typeof val === 'string' && val.trim().length > 0,
          `Key "${key}" must exist and be non-empty in ${lang}/common.json`,
        ).toBe(true)
      }
    })
  }
})
