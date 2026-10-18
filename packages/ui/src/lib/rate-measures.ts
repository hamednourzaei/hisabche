// ============================================
// packages/ui/src/lib/rate-measures.ts
//
// «هر ۱ کیلوگرم طلا = …»، «هر ۱ میلیون تومان = …» (owner, 18 Oct 2026).
//
// A rate is STORED per one unit of its code, and that unit is fixed:
//   - a precious metal (XAU, XAG, XPT, XPD) is quoted per GRAM — the LABEL in
//     the picker says «طلا (گرم)» and every reader divides by grams;
//   - a currency is per one unit of it;
//   - a unit the business named itself (ماشین، دستگاه) is per one of it.
// The measure a person types in is only how they say the amount. It is turned
// into that stored unit here, once, before the pair becomes a rate — so
// «۱ کیلوگرم طلا = ۲٬۴۰۰٬۰۰۰ افغانی» is stored as 2,400 afghani per gram.
//
// ⚠️ A measure never changes what is stored: no reader knows about kilograms.
// ============================================

export interface RateMeasure {
  id: string
  /** How many of the code's stored unit one of this measure is. */
  factor: number
  /** Persian fallback label; the translated one is `display.measure.<id>`. */
  label: string
}

/** Grams: the unit `exchange_rates` keeps every metal in. */
const MASS: readonly RateMeasure[] = [
  { id: 'gram', factor: 1, label: 'گرم' },
  // The bazaar mithqal of gold, 4.608 g (24 nokhod × 0.192 g).
  { id: 'mithqal', factor: 4.608, label: 'مثقال' },
  { id: 'ounce', factor: 31.1034768, label: 'اونس' },
  { id: 'kilogram', factor: 1000, label: 'کیلوگرم' },
  { id: 'ton', factor: 1_000_000, label: 'تن' },
]

const MONEY: readonly RateMeasure[] = [
  { id: 'one', factor: 1, label: 'واحد' },
  { id: 'thousand', factor: 1_000, label: 'هزار' },
  { id: 'million', factor: 1_000_000, label: 'میلیون' },
]

const COUNT: readonly RateMeasure[] = [{ id: 'piece', factor: 1, label: 'عدد' }]

/** A measure the person types themselves (بشکه، کیسه، متر) — its own name, factor 1. */
export const OWN_MEASURE = '__own__'

/**
 * A unit the business names itself (owner, 18 Oct 2026): by count, by weight,
 * or by a measure they type. Weight is kept per KILOGRAM — «۱ تن آهن» is
 * stored as «آهن (کیلوگرم)» at a thousandth of the price — and the measure
 * becomes part of the unit's name (`namedUnit`), so «آهن (کیلوگرم)» and
 * «آهن (بشکه)» are never the same rate.
 */
const NAMED: readonly RateMeasure[] = [
  { id: 'piece', factor: 1, label: 'عدد' },
  { id: 'kilogram', factor: 1, label: 'کیلوگرم' },
  { id: 'gram', factor: 0.001, label: 'گرم' },
  { id: 'ton', factor: 1000, label: 'تن' },
  { id: OWN_MEASURE, factor: 1, label: 'واحد اندازه‌ی دیگر…' },
]

const METALS = new Set(['XAU', 'XAG', 'XPT', 'XPD'])

/** The measures a person may quote `code` in; the first is its stored unit. */
export function measuresFor(code: string): readonly RateMeasure[] {
  if (METALS.has(code)) return MASS
  // A saved unit whose name already carries its measure — «آهن (کیلوگرم)» —
  // is quoted as it was saved; offering kilograms again would nest the name.
  if (code.startsWith('unit:') && code.endsWith(')')) return COUNT
  if (code.startsWith('unit:') || code === '__other__') return NAMED
  return MONEY
}

/** `amount` of `measure` of `code`, in the code's stored unit. Unknown measure = stored unit. */
export function inStoredUnit(amount: number, code: string, measure: string): number {
  const found = measuresFor(code).find((m) => m.id === measure)
  return amount * (found?.factor ?? 1)
}

/**
 * The name a business-named unit is saved under: the bare name by count,
 * «name (کیلوگرم)» by weight (every weight is stored per kilogram), «name
 * (own measure)» for a measure the person typed. `labels.kilogram` is the word
 * in the person's language — the name is their data, not a translation key.
 */
export function namedUnit(
  name: string,
  measure: string,
  labels: { kilogram: string; own: string },
): string {
  if (measure === 'piece') return name
  if (measure === OWN_MEASURE) return labels.own ? `${name} (${labels.own})` : name
  return `${name} (${labels.kilogram})`
}
