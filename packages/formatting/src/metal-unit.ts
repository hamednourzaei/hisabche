// ============================================
// Metals: weighed in grams, shown in grams, kilograms or tonnes.
//
// The books never change unit: a metal amount is stored, posted and reported
// in GRAMS (`XAU` = one gram of gold — see money.ts). What a person chooses is
// the unit they READ and TYPE in, and the conversion is real, both ways:
//
//   shown  = grams / factor        typed → grams = typed × factor
//   1 kg   = 1,000 g               1 t   = 1,000,000 g
//
// ⚠️ A UNIT, NOT A CURRENCY. Gold is the currency; kilogram is how much of it.
// Nothing here picks a currency or defaults one.
//
// The chosen unit is a device preference, set by the store
// (`usePreferencesStore.metalUnit`) through `setMetalDisplayUnit`. Until it is
// set, grams — the stored unit — so an unset preference can never misstate a
// figure by a factor of a thousand.
// ============================================

export type MetalUnit = 'g' | 'kg' | 't'

export const METAL_UNITS: readonly MetalUnit[] = ['g', 'kg', 't']

/** Grams in one of each unit. */
export const METAL_UNIT_GRAMS: Readonly<Record<MetalUnit, number>> = {
  g: 1,
  kg: 1_000,
  t: 1_000_000,
}

const METALS: ReadonlySet<string> = new Set(['XAU', 'XAG', 'XPT', 'XPD'])

export function isMetal(currency: string | null | undefined): boolean {
  return typeof currency === 'string' && METALS.has(currency.toUpperCase())
}

let displayUnit: MetalUnit = 'g'

export function setMetalDisplayUnit(unit: MetalUnit): void {
  displayUnit = METAL_UNIT_GRAMS[unit] ? unit : 'g'
}

export function metalDisplayUnit(): MetalUnit {
  return displayUnit
}

/**
 * Grams in one shown unit of this currency: the factor for a metal, 1 for
 * anything else — so a caller can apply it without asking first.
 */
export function metalFactor(
  currency: string | null | undefined,
  unit: MetalUnit = displayUnit,
): number {
  return isMetal(currency) ? METAL_UNIT_GRAMS[unit] : 1
}

/** A stored (gram) amount in the unit shown. */
export function toShownMetal(
  grams: number,
  currency: string,
  unit: MetalUnit = displayUnit,
): number {
  return grams / metalFactor(currency, unit)
}

/** A typed amount in the unit shown, back to grams for storing. */
export function toStoredMetal(
  shown: number,
  currency: string,
  unit: MetalUnit = displayUnit,
): number {
  return shown * metalFactor(currency, unit)
}

/**
 * Decimals to keep when shown: three in grams is a milligram, so a kilogram
 * needs six and a tonne nine to say the same weight — never fewer, or a
 * conversion would round away what the books hold.
 */
export function metalFractionDigits(unit: MetalUnit = displayUnit): number {
  return 3 + Math.round(Math.log10(METAL_UNIT_GRAMS[unit]))
}

export const METAL_UNIT_SIGN: Readonly<Record<MetalUnit, string>> = {
  g: 'g',
  kg: 'kg',
  t: 't',
}
