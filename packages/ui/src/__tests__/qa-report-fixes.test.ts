// ============================================
// The QA report of 9 Nov 2026 (Hisabche_MASTER_QA_Architecture), one guard
// per defect it found that was fixed in code. Source assertions read the code
// with comments stripped, so a comment that explains the bug cannot satisfy
// its own guard.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { productUnitsProblem } from '../components/ui/warehouse-detail/product-units-panel'
import { serialLines } from '../components/ui/warehouse-detail/product-serials-panel'
import { aiErrorText } from '../lib/ai-error-text'
import { formatPercent } from '../components/ui/kpi-card'

const UI = join(__dirname, '..')
const code = (rel: string) =>
  readFileSync(join(UI, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .split(/\s+/)
    .join(' ')

describe('QA-KPI-001 — a custom KPI asks the server for its figures', () => {
  it('the invoice figure requests the summary', () => {
    expect(code('components/ui/dashboard/custom-kpis.tsx')).toContain('includeSummary: true')
  })
})

describe('QA-PCT-001 — no «76.8k%» and no «+100%» from nothing', () => {
  it('a change past 999% is said as «more than 999%»', () => {
    expect(formatPercent(76_800, 'en')).toBe('>999%')
    expect(formatPercent(-5_000, 'fa')).toContain('>')
  })
  it('an empty previous month is no comparison at all', () => {
    for (const file of [
      'components/ui/invoices/invoices-view.tsx',
      'hooks/customers/use-customers-data.ts',
    ]) {
      const src = code(file)
      expect(src).toContain('if (previous === 0) return null')
      expect(src).not.toContain('current === 0 ? null : 100')
    }
  })
})

describe('QA-005 — «ذخیره پیش‌نویس» writes to the server', () => {
  it('the builder saves through the drafts API, not a timer', () => {
    const src = code('components/ui/invoice-builder/containers/invoice-builder-container.tsx')
    expect(src).toContain('useSaveInvoiceDraft()')
    expect(src).toContain('saveDraftOnServer.mutate(')
    expect(src).not.toContain("setTimeout(() => { setSaveStatus('saved')")
  })
  it('a draft that became a document is removed from the server', () => {
    const src = code('components/ui/invoice-builder/containers/invoice-preview-container.tsx')
    expect(src).toContain('if (serverDraftId) deleteServerDraft(serverDraftId)')
  })
  it('the invoices page lists the saved drafts', () => {
    expect(code('components/ui/invoices/invoices-view.tsx')).toContain(
      '<InvoiceDraftsButton t={t} />',
    )
  })
})

describe('QA-THEME-001 — the theme follows the person', () => {
  it('both shells mount the sync', () => {
    const repo = join(UI, '..', '..', '..')
    for (const file of [
      'apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx',
      'packages/app-shell/src/components/layout/app-shell.tsx',
    ]) {
      expect(readFileSync(join(repo, file), 'utf8')).toContain('<ThemePreferenceSync />')
    }
  })
})

describe('QA-006 — the unit price follows the product picked', () => {
  it('a product without a price leaves the cell empty, not «0»', () => {
    expect(code('hooks/invoices/use-picker-rows.ts')).toContain(
      "price: price > 0 ? String(price) : ''",
    )
  })
  it('re-picking replaces a price the app had filled', () => {
    const src = code('components/ui/invoice-builder/containers/invoice-builder-container.tsx')
    expect(src).toContain(
      "if (ours && before?.productId !== product.id) draft.setCell(rowId, COLUMN.unitPrice, '')",
    )
  })
})

describe('QA-AI-DOWN — a server that is down says so', () => {
  const tr = (_key: string, fallback: string) => fallback
  it('reads the server code from the reply body', () => {
    expect(
      aiErrorText(
        { code: 'ERR_BAD_RESPONSE', response: { status: 503, data: { code: 'AI_PROVIDER_BUSY' } } },
        tr,
      ),
    ).toContain('شلوغ')
  })
  it('no reply at all is «not reachable», not «could not answer»', () => {
    expect(aiErrorText({ code: 'ERR_NETWORK' }, tr)).toContain('در دسترس نیست')
  })
})

describe('weighted retail — 2.5 kg stays 2.5', () => {
  it('the product form no longer floors the stock', () => {
    const src = code('components/ui/warehouse-detail/containers/warehouse-detail-container.tsx')
    expect(src).not.toContain('quantity: Math.floor(num(values.quantity))')
  })
})

describe('pack ↔ bulk units — the rules of the set', () => {
  const row = (over: Partial<Parameters<typeof productUnitsProblem>[0][number]>) => ({
    key: 'k',
    unitId: 'u1',
    factor: '1',
    isBaseUnit: true,
    isPurchaseDefault: false,
    isSaleDefault: false,
    ...over,
  })
  it('one base at factor 1, then a sack of ten', () => {
    expect(
      productUnitsProblem([
        row({}),
        row({ key: 'b', unitId: 'u2', factor: '10', isBaseUnit: false }),
      ]),
    ).toBeNull()
  })
  it('names the first broken rule', () => {
    expect(productUnitsProblem([row({ isBaseUnit: false })])).toBe('productUnits.problems.oneBase')
    expect(productUnitsProblem([row({ factor: '2' })])).toBe('productUnits.problems.baseIsOne')
    expect(productUnitsProblem([row({}), row({ key: 'b' })])).toBe(
      'productUnits.problems.duplicate',
    )
    expect(
      productUnitsProblem([
        row({}),
        row({ key: 'b', unitId: 'u2', factor: '۰', isBaseUnit: false }),
      ]),
    ).toBe('productUnits.problems.factor')
  })
})

describe('serial numbers — one per line', () => {
  it('splits on lines and commas, drops blanks and repeats', () => {
    expect(serialLines('356938035643809\n\n356938035643809, 356938035643817')).toEqual([
      '356938035643809',
      '356938035643817',
    ])
  })
})
