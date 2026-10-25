// ============================================
// packages/validation/src/schemas/custom-unit.rules.ts
//
// Units the business names itself (custom-units-01, live audit #82):
// «یک ماشین = ۵۰۰٬۰۰۰ افغانی». For converting and showing a figure only — no
// document is ever kept in such a unit. One validation for the server and the
// device.
// ============================================

export interface CustomUnitQuote {
  name: string
  /** Books-currency units one of it is worth. */
  perUnit: number
  onDate: string
}

/**
 * A custom-unit quote as it will be stored: the name trimmed, the rate positive,
 * the day without a time. Refuses with a named code the client translates.
 */
export function parseCustomUnitInput(input: {
  name: string
  perUnit: number
  onDate: string
}):
  | { ok: true; value: { name: string; perUnit: number; day: string } }
  | { ok: false; code: 'UNIT_NAME_INVALID' | 'RATE_INVALID' } {
  const name = String(input.name ?? '').trim()
  if (name.length < 1 || name.length > 40) return { ok: false, code: 'UNIT_NAME_INVALID' }
  if (!(Number(input.perUnit) > 0)) return { ok: false, code: 'RATE_INVALID' }
  return {
    ok: true,
    value: { name, perUnit: Number(input.perUnit), day: String(input.onDate).slice(0, 10) },
  }
}
