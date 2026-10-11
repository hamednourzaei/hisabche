// ============================================
// UNKNOWN IS NOT ZERO — the screens.
//
// INV-000077 (11 Oct 2026): a sale whose goods had no recorded cost was shown
// as «cost 0 · profit 450,000 · margin 100%», with a small warning under it.
// The server now sends `null` for a profit it cannot compute; this guard keeps
// every screen from turning that null back into a number, and keeps the trial
// balance stating a SIDE instead of a signed figure.
//
// Why a guard and not only the fix: the old tests asserted the warning flag and
// never looked at the number beside it. The number is what a person reads.
//
// The scan at the bottom is the pattern for every other page: any component
// that gives a profit, a margin or a contribution a zero fallback is red here,
// by name, on the day it is written.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const UI = join(ROOT, 'packages', 'ui', 'src', 'components', 'ui')

/** Source with comments removed and whitespace flattened. */
function source(...parts: string[]): string {
  const raw = readFileSync(join(...parts), 'utf8')
  return raw
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      walk(path, out)
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

function messages(lang: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(ROOT, 'packages', 'i18n', 'messages', lang, 'common.json'), 'utf8'),
  ) as Record<string, unknown>
}

function at(tree: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
      tree,
    )
}

describe('the invoice’s «why this profit» panel', () => {
  const panel = source(UI, 'invoice-detail', 'invoice-evidence-panel.tsx')

  it('says «cannot be calculated» for a profit the server could not compute', () => {
    expect(panel).toContain('evidence.data.grossProfit === null')
    expect(panel).toContain("t('evidence.unknown')")
    expect(panel).toContain("t('evidence.costUnknown')")
  })

  it('never feeds the profit into the money formatter unchecked', () => {
    expect(panel).not.toContain("['evidence.grossProfit', evidence.data.grossProfit]")
    expect(panel).not.toContain("['evidence.cost', -evidence.data.cost]")
    expect(panel).toContain('line.profit === null')
  })

  it('offers the one act that fixes it, and reports what the server answered', () => {
    expect(panel).toContain('useCostInvoice')
    expect(panel).toContain('costInvoice.mutate(invoiceId)')
    expect(panel).toContain('evidence.costResult.')
  })
})

describe('the profit report', () => {
  const table = source(UI, 'accounting', 'components', 'ProductProfitTable.tsx')

  it('prints a profit through the one helper that knows about «unknown»', () => {
    expect(table).toContain('profitText(row.profit)')
    expect(table).toContain('profitText(totals.grossProfit)')
    expect(table).toContain('profitText(totals.netProfit)')
    expect(table).not.toContain('money(row.profit)')
    expect(table).not.toContain('money(totals.netProfit)')
    expect(table).not.toContain('money(totals.grossProfit)')
  })

  it('states what IS known beside what is not', () => {
    expect(table).toContain('totals.knownGrossProfit')
    expect(table).toContain('totals.uncostedRevenue')
  })

  it('the per-currency card and the product journey do the same', () => {
    expect(source(UI, 'accounting', 'tabs', 'IncomeStatementTab.tsx')).toContain('net === null')
    expect(source(UI, 'warehouse-detail', 'product-journey-panel.tsx')).toContain(
      'journey.data.profit === null',
    )
    expect(source(UI, 'analysis', 'analysis-container.tsx')).toContain('row.contribution === null')
  })
})

describe('the trial balance', () => {
  const tab = source(UI, 'accounting', 'tabs', 'TrialBalanceTab.tsx')

  it('states a side: a debit-balance column and a credit-balance column', () => {
    expect(tab).toContain('n(row.debitBalance)')
    expect(tab).toContain('n(row.creditBalance)')
    expect(tab).toContain("n(totals.debitBalance, 'zero')")
    expect(tab).toContain("n(totals.creditBalance, 'zero')")
  })

  it('⚠️ never prints the signed balance («−10,220,000» on a till)', () => {
    expect(tab).not.toContain('n(row.balance)')
    expect(tab).not.toContain('r.balance')
  })

  it('names its currency, the state of the books and what a balance does NOT prove', () => {
    expect(tab).toContain('accounting.trialBalance.currency')
    expect(tab).toContain('accounting.trialBalance.unposted')
    expect(tab).toContain('accounting.trialBalance.unpostedUnknown')
    expect(tab).toContain('accounting.trialBalance.proofNote')
    expect(tab).toContain('row.abnormal')
  })

  it('«could not count» is its own sentence, not «none»', () => {
    expect(tab).toContain('unposted === null || unposted === undefined')
  })

  it('no hardcoded column titles in the export', () => {
    expect(tab).not.toContain("header: 'کد حساب'")
    expect(tab).not.toContain("header: 'مانده'")
  })
})

describe('every key these screens read exists in all three languages', () => {
  const KEYS = [
    'evidence.unknown',
    'evidence.costUnknown',
    'evidence.costRecordedPart',
    'evidence.uncostedUnits',
    'evidence.costAction',
    'evidence.costActionHint',
    'evidence.costWorking',
    'evidence.costFailed',
    'evidence.profitUnknown',
    'evidence.costResult.costed',
    'evidence.costResult.still_uncosted',
    'evidence.costResult.nothing_to_cost',
    'evidence.costResult.ledger_incomplete',
    'evidence.costResult.not_postable',
    'evidence.warning.COST_MISSING',
    'accounting.profit.unknown',
    'accounting.profit.knownProfit',
    'accounting.profit.uncostedRevenue',
    'accounting.profit.unknownNote',
    'accounting.profit.costMissing',
    'accounting.unvalued.title',
    'accounting.unvalued.ready',
    'accounting.unvalued.value',
    'accounting.unvalued.blocked',
    'accounting.unvalued.action',
    'accounting.unvalued.confirm',
    'accounting.unvalued.confirmAction',
    'accounting.unvalued.cancel',
    'accounting.unvalued.working',
    'accounting.unvalued.done',
    'accounting.unvalued.failed',
    'analysis.breakEven.reasons.COST_UNKNOWN',
    'accounting.trialBalance.asOfDate',
    'accounting.trialBalance.kind',
    'accounting.trialBalance.group',
    'accounting.trialBalance.turnoverDebit',
    'accounting.trialBalance.turnoverCredit',
    'accounting.trialBalance.debitBalance',
    'accounting.trialBalance.creditBalance',
    'accounting.trialBalance.accounts',
    'accounting.trialBalance.totalDebit',
    'accounting.trialBalance.totalCredit',
    'accounting.trialBalance.difference',
    'accounting.trialBalance.ledgerBalanced',
    'accounting.trialBalance.currency',
    'accounting.trialBalance.currencyNote',
    'accounting.trialBalance.abnormal',
    'accounting.trialBalance.abnormalHint',
    'accounting.trialBalance.abnormalCount',
    'accounting.trialBalance.show',
    'accounting.trialBalance.withBalance',
    'accounting.trialBalance.allAccounts',
    'accounting.trialBalance.proofNote',
    'accounting.trialBalance.unposted',
    'accounting.trialBalance.unpostedUnknown',
    'accounting.trialBalance.allPosted',
    'accounting.trialBalance.lastEntry',
    'accounting.trialBalance.noneWithBalance',
    'accounting.accountTypes.asset',
    'accounting.accountTypes.expense',
  ]

  for (const lang of ['fa', 'af', 'en']) {
    it(lang, () => {
      const tree = messages(lang)
      const missing = KEYS.filter((key) => {
        const value = at(tree, key)
        return typeof value !== 'string' || value.length === 0
      })
      expect(missing).toEqual([])
    })
  }

  it('the old sentence that called an unknown profit «overstated» is gone', () => {
    // «بیشتر از واقع نشان داده می‌شود» described showing a wrong number. The
    // number is no longer shown.
    expect(String(at(messages('fa'), 'evidence.warning.COST_MISSING'))).not.toContain(
      'بیشتر از واقع',
    )
  })
})

describe('the pattern, for every other page', () => {
  const FALLBACK =
    /\b\w*(profit|Profit|marginPercent|MarginPercent|contribution)\b\s*(\?\?|\|\|)\s*0\b/

  it('no component, hook or service gives a profit or a margin a zero fallback', () => {
    const roots = [
      join(ROOT, 'packages', 'ui', 'src', 'components'),
      join(ROOT, 'packages', 'api', 'src'),
      join(ROOT, 'packages', 'app-shell', 'src'),
      join(ROOT, 'backend', 'src', 'services'),
      join(ROOT, 'backend', 'src', 'routes'),
    ]
    const offenders: string[] = []
    for (const root of roots) {
      for (const file of walk(root)) {
        const lines = readFileSync(file, 'utf8').split('\n')
        lines.forEach((line, index) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
          if (FALLBACK.test(line)) offenders.push(`${file.slice(ROOT.length + 1)}:${index + 1}`)
        })
      }
    }
    expect(offenders).toEqual([])
  })
})
