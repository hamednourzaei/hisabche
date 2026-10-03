// The refusals the manufacturing API answers with, each of which has a sentence
// in the catalogue (`manufacturing.errors.<code>`, all three locales).
//
// ⚠️ A CLOSED LIST ON PURPOSE. `t()` on a key that does not exist throws and
// takes the screen to the error boundary, and a server message is not a key
// until it is in this list — so an unknown message is shown as it came, never
// looked up.
export const MANUFACTURING_ERROR_CODES = [
  'overrideReasonRequired',
  'range',
  'MANUFACTURING_MIGRATION_PENDING',
  'INVENTORY_INSUFFICIENT_STOCK',
  'PRODUCT_WAREHOUSE_REQUIRED',
  'PRODUCT_WAREHOUSE_NOT_FOUND',
  'MANUFACTURING_PRODUCT_NOT_FOUND',
  'MANUFACTURING_COMPONENT_NOT_FOUND',
  'MANUFACTURING_SELF_COMPONENT',
  'MANUFACTURING_WAREHOUSE_NOT_FOUND',
  'MANUFACTURING_BOM_NOT_FOUND',
  'MANUFACTURING_TOTALS_MISMATCH',
  'MANUFACTURING_OVERRIDE_REASON_REQUIRED',
  'MANUFACTURING_QUANTITY_INVALID',
  'WORK_ORDER_ALREADY_COMPLETED',
  'WORK_ORDER_CANCELLED',
  'WORK_ORDER_NOT_EDITABLE',
] as const

const KNOWN: ReadonlySet<string> = new Set(MANUFACTURING_ERROR_CODES)

/**
 * What to show for a refusal: the catalogue's sentence for a known code, the
 * server's own message otherwise, and `fallback` when there is no message.
 */
export function manufacturingErrorText(
  t: (key: string, fallback?: string) => string,
  message: string | null | undefined,
  fallback: string,
): string {
  if (!message) return fallback
  const code = message.replace('manufacturing.errors.', '')
  return KNOWN.has(code) ? t(`manufacturing.errors.${code}`, message) : message
}
