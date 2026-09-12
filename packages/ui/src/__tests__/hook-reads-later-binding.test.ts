// ============================================
// A hook must not read a `const` declared below it.
//
// ---------------------------------------------------------------------------
// ⚠️ THE PRODUCTION CRASH THIS CAME FROM
//
// `/fa/invoices/new/preview` threw on every visit:
//
//     ReferenceError: Cannot access 'Y' before initialization
//       at Object.useMemo (…)
//
// `'Y'` was minified, so the name said nothing — but `at Object.useMemo` did.
// In `invoice-preview-container.tsx`, `documentData = useMemo(...)` read
// `paidAmount` in its body, and `const paidAmount = …` was declared SIXTY
// LINES FURTHER DOWN. `useMemo`'s factory runs synchronously on the first
// render, while that binding is still in its temporal dead zone.
//
// It was not a module cycle. A full import-graph scan of the monorepo (Tarjan
// over every package and app) found exactly one cycle, in a package
// `apps/web` cannot even reach — so the cycle hunt could never have found
// this. What found it was the ROUTE and the stack frame, once those were
// available.
//
// ⚠️ AND A SECOND DEFECT WAS HIDING UNDER IT. `paidAmount` was read in the
// memo body but absent from its dependency array, so once the ordering was
// fixed the printed document would have frozen on the first render's paid
// amount — zero. Someone enters a payment, sees the total update beside the
// form, and prints a document still saying nothing was received.
//
// ---------------------------------------------------------------------------
// WHAT THIS GUARD DOES
//
// It is deliberately narrow: it checks the file that crashed, and the shape
// that crashed it. A general "no TDZ anywhere" checker needs real scope
// analysis; a guard that pretends to do that and quietly does not is worse
// than one that admits its scope.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const PREVIEW = join(
  __dirname,
  '..',
  'components',
  'ui',
  'invoice-builder',
  'containers',
  'invoice-preview-container.tsx',
)

const source = readFileSync(PREVIEW, 'utf8')

/** Line number (1-based) of the first line matching, or -1. */
function lineOf(needle: string): number {
  const lines = source.split('\n')
  const index = lines.findIndex((line) => line.includes(needle))
  return index === -1 ? -1 : index + 1
}

describe('the preview page initialises in the right order', () => {
  it('⚠️ paidAmount is declared BEFORE the memo that reads it', () => {
    const declaration = lineOf('const paidAmount = paidAmountOf(')
    const consumer = lineOf('const documentData: InvoiceDocumentData = useMemo(')

    expect(declaration, 'paidAmount declaration not found').toBeGreaterThan(0)
    expect(consumer, 'documentData memo not found').toBeGreaterThan(0)

    // This is the whole bug: `declaration > consumer` threw on every render.
    expect(declaration).toBeLessThan(consumer)
  })

  it('the payment state is declared before the amount derived from it', () => {
    expect(lineOf('const [payment, setPayment]')).toBeLessThan(
      lineOf('const paidAmount = paidAmountOf('),
    )
  })

  it('⚠️ paidAmount is in the memo dependency array', () => {
    // Read in the body, so it must be a dep — otherwise the document keeps the
    // first render's value and prints a stale amount.
    const deps = source.slice(
      source.indexOf('const documentData: InvoiceDocumentData = useMemo('),
      source.indexOf('// ─── T9') === -1
        ? source.indexOf('const invoiceNotes')
        : source.indexOf('const invoiceNotes'),
    )
    expect(deps).toContain('paidAmount,')
  })
})

describe('the shape that caused it', () => {
  it('⚠️ no useMemo body reads a const declared later in the same component', () => {
    // Narrow on purpose: every `const X = ` at component indentation, checked
    // against every `useMemo(` that appears above it and mentions X in its
    // body. Catches the exact ordering fault without pretending to do full
    // scope analysis.
    const lines = source.split('\n')

    const declarations: Array<{ name: string; line: number }> = []
    lines.forEach((line, index) => {
      const match = /^ {2}const (\w+) = (?!useMemo|useCallback|useState|useRef)/.exec(line)
      if (match?.[1]) declarations.push({ name: match[1], line: index })
    })

    const offenders: string[] = []

    for (const { name, line } of declarations) {
      // Every memo/callback factory that opens before this declaration.
      lines.forEach((candidate, index) => {
        if (index >= line) return
        if (!/=\s*(useMemo|useCallback)\(/.test(candidate)) return

        // The factory body runs from here to the declaration line.
        const body = lines.slice(index, line).join('\n')
        const usesIt = new RegExp(`\\b${name}\\b`).test(body)
        if (usesIt)
          offenders.push(`${name} used at line ${index + 1}, declared at line ${line + 1}`)
      })
    }

    expect(offenders).toEqual([])
  })
})
