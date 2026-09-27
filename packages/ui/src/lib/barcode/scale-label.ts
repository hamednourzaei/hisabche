// ============================================
// Scale labels — a barcode that carries a WEIGHT or a PRICE (27 Sep 2026).
//
// A shop scale prints an EAN-13 whose first two digits are an in-store prefix
// (GS1 reserves 20–29 for exactly this), then the item code, then the value,
// then the check digit:
//
//     2 0 | 1 2 3 4 5 | 0 1 2 5 0 | 7
//     prefix  item      value       check      → item 2012345, 1.250 kg
//
// The product is found by prefix + item («2012345» is what goes in the
// product's barcode field); the value becomes the line's QUANTITY — a weight
// directly, a price divided by the product's unit price. Stock then moves by
// the real amount sold, not by «one piece».
//
// OFF BY DEFAULT (G4). A shop without a scale never has its codes read this
// way. Per device, like the scanner: which scale sits beside this till.
// A label whose check digit is wrong is refused, never guessed.
// ============================================

export type ScaleValueKind = 'weight' | 'price'

export interface ScaleLabelConfig {
  enabled: boolean
  /** Two-digit prefixes that mean «scale label». */
  prefixes: string[]
  /** Digits of the item code after the prefix (the rest, up to 12, is the value). */
  itemDigits: number
  valueKind: ScaleValueKind
  /** Weight: 3 = grams → kilograms. Price: decimal places of the amount. */
  decimals: number
}

export const DEFAULT_SCALE_LABEL_CONFIG: ScaleLabelConfig = {
  enabled: false,
  prefixes: ['20', '21', '22', '23', '24', '25', '26', '27', '28', '29'],
  itemDigits: 5,
  valueKind: 'weight',
  decimals: 3,
}

export type ScaleLabel =
  | { kind: 'weight'; productCode: string; quantity: number }
  | { kind: 'price'; productCode: string; amount: number }

/** EAN-13 check digit over the first twelve digits. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

/** A scale label, or null when this code is not one (an ordinary product). */
export function parseScaleLabel(code: string, config: ScaleLabelConfig): ScaleLabel | null {
  if (!config.enabled) return null
  if (!/^\d{13}$/.test(code)) return null
  if (!config.prefixes.includes(code.slice(0, 2))) return null
  if (ean13CheckDigit(code.slice(0, 12)) !== Number(code[12])) return null

  const itemEnd = 2 + config.itemDigits
  const productCode = code.slice(0, itemEnd)
  const raw = Number(code.slice(itemEnd, 12))
  const value = raw / 10 ** config.decimals
  if (!(value > 0)) return null

  return config.valueKind === 'weight'
    ? { kind: 'weight', productCode, quantity: value }
    : { kind: 'price', productCode, amount: value }
}

/** The line quantity a label stands for. null: a price label on a product with no unit price. */
export function quantityOfLabel(label: ScaleLabel, unitPrice: number): number | null {
  if (label.kind === 'weight') return label.quantity
  if (!(unitPrice > 0)) return null
  return Math.round((label.amount / unitPrice) * 1000) / 1000
}

// ─── Storage (per device) ─────────────────────────────────────────────────

const KEY = 'hisabche:scale-label-settings:v1'
export const SCALE_LABEL_SETTINGS_EVENT = 'hisabche:scale-label-settings'

/** Whatever is stored, coerced into a valid config — never trusted as-is. */
export function sanitizeScaleLabelConfig(raw: unknown): ScaleLabelConfig {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_SCALE_LABEL_CONFIG
  const int = (value: unknown, min: number, max: number, fallback: number) => {
    const n = Number(value)
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback
  }
  const prefixes = Array.isArray(v.prefixes)
    ? v.prefixes.map(String).filter((p) => /^\d{2}$/.test(p))
    : d.prefixes
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : d.enabled,
    prefixes: prefixes.length > 0 ? prefixes : d.prefixes,
    // 2 + item + value + 1 = 13, with at least 3 digits of value.
    itemDigits: int(v.itemDigits, 4, 7, d.itemDigits),
    valueKind:
      v.valueKind === 'price' ? 'price' : v.valueKind === 'weight' ? 'weight' : d.valueKind,
    decimals: int(v.decimals, 0, 3, d.decimals),
  }
}

export function loadScaleLabelConfig(): ScaleLabelConfig {
  try {
    const raw = window.localStorage.getItem(KEY)
    return sanitizeScaleLabelConfig(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_SCALE_LABEL_CONFIG
  }
}

export function saveScaleLabelConfig(config: ScaleLabelConfig): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sanitizeScaleLabelConfig(config)))
    window.dispatchEvent(new Event(SCALE_LABEL_SETTINGS_EVENT))
  } catch {
    // Not persisted — the default (off) still applies.
  }
}
