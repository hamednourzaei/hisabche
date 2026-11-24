// ============================================
// packages/app-bridge/src/hardware/serial-scale-protocol.ts
//
// Hardware Serial Scale & POS Weighing Protocol Parser
// Supports standard POS serial scale protocols (CAS, Mettler Toledo, NCI, Dibal)
// Output weight is converted to integer grams or integer milligrams to prevent float drift.
// ============================================

export type ScaleProtocol = 'cas' | 'toledo_nci' | 'generic_continuous'

export interface ParsedScaleReading {
  /** Weight in integer grams (e.g. 1.250 kg -> 1250 grams). */
  readonly weightGrams: number
  /** Weight in integer milligrams for high-precision scales (e.g. jewelry/spices). */
  readonly weightMilligrams: number
  /** Whether the weight measurement has settled on the platter. */
  readonly isStable: boolean
  /** Whether the reading is Net (tare deducted) or Gross. */
  readonly isNet: boolean
  /** Whether the reading is zero or negative. */
  readonly isZero: boolean
  /** Whether the scale platter is overloaded. */
  readonly isOverload: boolean
  /** Raw unit sent by the scale device. */
  readonly originalUnit: 'kg' | 'g' | 'lb' | 'oz'
  /** Raw unparsed string line. */
  readonly rawLine: string
}

/**
 * Parses continuous scale line from CAS scales (e.g., CAS ER Plus, SW, AP-1).
 * Standard CAS 22-byte format:
 * `ST,NT,+  1.250kg\r\n` or `US,GS,+  0.500kg\r\n`
 */
export function parseCasScaleLine(line: string): ParsedScaleReading | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // CAS headers: ST (Stable), US (Unstable), OL (Overload)
  // Mode: NT (Net), GS (Gross)
  const regex = /^(ST|US|OL),(NT|GS),\s*([+-]?)\s*(\d+(?:\.\d+)?)\s*(kg|g|lb|oz)$/i
  const match = trimmed.match(regex)
  if (!match) return null

  const [, status, mode, signStr, weightStr, unit] = match
  const statusUpper = status?.toUpperCase()
  const isOverload = statusUpper === 'OL'
  const isStable = statusUpper === 'ST'
  const isNet = mode?.toUpperCase() === 'NT'

  const sign = signStr === '-' ? -1 : 1
  const rawWeight = sign * parseFloat(weightStr || '0')
  const unitLower = (unit?.toLowerCase() ?? 'kg') as 'kg' | 'g' | 'lb' | 'oz'

  let weightGrams = 0
  let weightMilligrams = 0

  if (unitLower === 'kg') {
    weightMilligrams = Math.round(rawWeight * 1_000_000)
    weightGrams = Math.round(rawWeight * 1_000)
  } else if (unitLower === 'g') {
    weightMilligrams = Math.round(rawWeight * 1_000)
    weightGrams = Math.round(rawWeight)
  } else if (unitLower === 'lb') {
    // 1 lb = 453.59237 grams
    weightMilligrams = Math.round(rawWeight * 453_592.37)
    weightGrams = Math.round(rawWeight * 453.59237)
  } else if (unitLower === 'oz') {
    // 1 oz = 28.349523125 grams
    weightMilligrams = Math.round(rawWeight * 28_349.52)
    weightGrams = Math.round(rawWeight * 28.3495)
  }

  const isZero = weightGrams === 0

  return {
    weightGrams,
    weightMilligrams,
    isStable,
    isNet,
    isZero,
    isOverload,
    originalUnit: unitLower,
    rawLine: trimmed,
  }
}

/**
 * Parses Mettler Toledo / NCI continuous protocol.
 * Format: `\x02<status><weight><unit>\x03` or `<status> <weight> <unit>`
 * Example: `S   1.250 kg` or `D   0.850 kg` (S=Stable, D=Dynamic/Unstable)
 */
export function parseToledoNciLine(line: string): ParsedScaleReading | null {
  // Strip framing characters (STX = 2, ETX = 3, CR = 13, LF = 10) without control regex
  const clean = line
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code !== 2 && code !== 3 && code !== 10 && code !== 13
    })
    .join('')
    .trim()
  if (!clean) return null

  const regex = /^([SDOZ])\s*([+-]?\d+(?:\.\d+)?)\s*(kg|g|lb|oz)$/i
  const match = clean.match(regex)
  if (!match) return null

  const [, status, weightStr, unit] = match
  const statusUpper = status?.toUpperCase()
  const isStable = statusUpper === 'S' || statusUpper === 'Z'
  const isOverload = statusUpper === 'O'

  const rawWeight = parseFloat(weightStr || '0')
  const unitLower = (unit?.toLowerCase() ?? 'kg') as 'kg' | 'g' | 'lb' | 'oz'

  let weightGrams: number
  let weightMilligrams: number

  if (unitLower === 'kg') {
    weightMilligrams = Math.round(rawWeight * 1_000_000)
    weightGrams = Math.round(rawWeight * 1_000)
  } else if (unitLower === 'g') {
    weightMilligrams = Math.round(rawWeight * 1_000)
    weightGrams = Math.round(rawWeight)
  } else {
    weightMilligrams = Math.round(rawWeight * 453_592.37)
    weightGrams = Math.round(rawWeight * 453.59237)
  }

  return {
    weightGrams,
    weightMilligrams,
    isStable,
    isNet: false,
    isZero: weightGrams === 0,
    isOverload,
    originalUnit: unitLower,
    rawLine: clean,
  }
}

/**
 * Auto-detecting multi-protocol serial stream parser.
 */
export function parseScaleStreamLine(
  line: string,
  preferredProtocol: ScaleProtocol = 'cas',
): ParsedScaleReading | null {
  if (preferredProtocol === 'cas') {
    const cas = parseCasScaleLine(line)
    if (cas) return cas
    return parseToledoNciLine(line)
  }

  if (preferredProtocol === 'toledo_nci') {
    const toledo = parseToledoNciLine(line)
    if (toledo) return toledo
    return parseCasScaleLine(line)
  }

  return parseCasScaleLine(line) ?? parseToledoNciLine(line)
}
