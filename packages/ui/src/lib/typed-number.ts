// ============================================
// packages/ui/src/lib/typed-number.ts
//
// A number a person TYPED, in any of the digits they type with.
//
// ⚠️ Owner, 18 Oct 2026: a shelf's capacity was typed, the shelf saved, and the
// capacity was not there. The field was `<input type="number">`: Chrome gives
// such a field the value «» for Persian digits («۲۰۰»), so the form read
// «not recorded» and sent `capacity: null` — no error, nothing on screen.
// A field a Persian or Dari speaker fills is a text field with
// `inputMode="decimal"`, read through this.
//
// «٫» (the Persian decimal separator) is a decimal point; «٬», «,» and
// spaces are grouping and dropped. Empty → null, never 0.
// ============================================

import { parseNumericInput } from '@hisabche/formatting'

export function typedNumber(text: string): number | null {
  const clean = parseNumericInput(text.replace(/٫/g, '.'))
  if (clean === '' || clean === '-') return null
  const value = Number(clean)
  return Number.isFinite(value) ? value : null
}
