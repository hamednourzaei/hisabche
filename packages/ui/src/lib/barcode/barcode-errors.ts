// The API refuses a barcode another product already carries (409
// BARCODE_TAKEN, on the `barcode` field). Every product form says so in words
// instead of «Error» — one reading of that answer, shared.

/** next-intl's t, or any (key) => text. The key exists in fa/af/en. */
type Translate = (key: string) => string

export function isBarcodeTaken(error: unknown): boolean {
  const e = error as { code?: unknown; response?: { data?: { code?: unknown } } } | null
  return e?.code === 'BARCODE_TAKEN' || e?.response?.data?.code === 'BARCODE_TAKEN'
}

export function barcodeTakenMessage(error: unknown, t: Translate): string | null {
  return isBarcodeTaken(error) ? t('barcode.taken') : null
}
