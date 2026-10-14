// ============================================
// No page, store or schema carries a currency of its own.
//
// The currency a business keeps its books in is one stored value on the
// server (`workspaces.base_currency`, read through `useBookCurrency`). The
// letters 'AFN' used to be typed into forty files as «the» currency — as the
// default of a schema, the value a modal posted, the label a card printed.
// For a business whose books are in another currency every one was wrong.
//
// This guard reads the shared packages (comments removed) and finds every
// 'AFN' literal. A file may hold one only if it is:
//
//   CATALOGUE  — the list of currencies itself, or Hisabche's own billing
//                currency. Legitimate, and expected to stay.
//   NOT_YET    — a hardcode that is still there. An explicit register, with
//                the reason, so the remaining work is a list and not a guess.
//                ⚠️ To turn this test green after fixing one, REMOVE its row.
//                Adding a row is how the rule gets quietly abandoned.
//
// Anything else — a new hardcode anywhere — fails by name.
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const PACKAGES = join(__dirname, '..', '..', '..')
const ROOTS = [
  'ui/src',
  'store/src',
  'app-shell/src',
  'api/src',
  'validation/src',
  'ui-contract/src',
]

const CATALOGUE = [
  // The one list of currency codes, and its display metadata.
  'validation/src/schemas/common.schema.ts',
  'ui-contract/src/currencies.ts',
]

const NOT_YET: Record<string, string> = {
  'ui/src/components/ui/budgets/budgets-view.tsx':
    'budgets keep an fx_rate against AFN in the database (budget-currency-migration.sql); needs the ledger phase',
  'api/src/hooks/budgets.ts': 'same model as the budgets screen — a private four-currency union',
  'ui/src/components/ui/warehouse/warehouse-view.tsx':
    'the warehouse rate model is «afghani per unit» (Currency.afnPerUnit)',
  'ui/src/lib/warehouse/rate-from-pair.ts': 'BASE_CODE of the same warehouse rate model',
  'store/src/slices/currency.slice.ts': 'client rate table keyed to AFN = 1; same model as above',
  'app-shell/src/shared/stores/ui.store.ts': 'the desktop shell’s display currency default',
}

function filesUnder(dir: string): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name === 'messages') continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) found.push(...filesUnder(path))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) found.push(path)
  }
  return found
}

// Comments explain the old hardcodes by name; only code is read.
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .map((line) => line.replace(/\s\/\/.*$/, ''))
    .join('\n')

const LITERAL = /['"`]AFN['"`]/

const holders = ROOTS.flatMap((root) => filesUnder(join(PACKAGES, root)))
  .filter((path) => LITERAL.test(code(readFileSync(path, 'utf8'))))
  .map((path) => relative(PACKAGES, path).split('\\').join('/'))
  .sort()

describe('no page, store or schema carries a currency of its own', () => {
  it('⚠️ a NEW hardcoded currency fails by name', () => {
    const allowed = new Set([...CATALOGUE, ...Object.keys(NOT_YET)])
    expect(
      holders.filter((file) => !allowed.has(file)),
      'these files hardcode a currency; read it from useBookCurrency() or let the server decide',
    ).toEqual([])
  })

  it('the register of remaining hardcodes holds no row that is already fixed', () => {
    expect(
      Object.keys(NOT_YET).filter((file) => !holders.includes(file)),
      'fixed — remove these rows from NOT_YET',
    ).toEqual([])
  })

  it('the pages that used to POST a currency of their own no longer do', () => {
    for (const file of [
      'ui/src/components/ui/customers/AddCustomerModal.tsx',
      'ui/src/components/ui/customers/PaymentModal.tsx',
      'ui/src/components/ui/human-resources/hr-view.tsx',
      'ui/src/components/ui/team-and-payroll/team-and-payroll-view.tsx',
    ]) {
      expect(holders, file).not.toContain(file)
    }
  })

  it('⚠️ the schemas default no currency — the server decides from the books currency', () => {
    for (const file of ['invoice', 'transaction', 'human-resources', 'project']) {
      const source = code(
        readFileSync(join(PACKAGES, 'validation/src/schemas', `${file}.schema.ts`), 'utf8'),
      )
      expect(source, file).not.toMatch(/currency\w*:\s*[\w.]+\.default\(/i)
    }
  })

  it('⚠️ what the person picks at onboarding is saved on the SERVER as the books currency', () => {
    const wizard = code(
      readFileSync(
        join(PACKAGES, 'ui/src/components/ui/onboarding/containers/onboarding-container.tsx'),
        'utf8',
      ),
    )
    expect(wizard).toContain('useSetBaseCurrency()')
    expect(wizard).toContain('saveBookCurrency.mutate(currency')
    // …and nothing is chosen for them beforehand.
    const slice = code(readFileSync(join(PACKAGES, 'store/src/slices/onboarding.slice.ts'), 'utf8'))
    expect(slice).toContain("defaultCurrency: '' as Currency")
  })

  it('both shells keep the device currency in step with the books currency', () => {
    for (const shell of [
      join(PACKAGES, 'app-shell/src/components/layout/app-shell.tsx'),
      join(PACKAGES, '..', 'apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx'),
    ]) {
      expect(code(readFileSync(shell, 'utf8')), shell).toContain('<BookCurrencySync />')
    }
  })

  it('the hook has no fallback of its own', () => {
    const hook = code(readFileSync(join(PACKAGES, 'ui/src/hooks/use-book-currency.ts'), 'utf8'))
    expect(hook).toContain('useBaseCurrency().data?.currency')
    expect(hook).not.toMatch(/\?\?|\|\|/)
  })
})
