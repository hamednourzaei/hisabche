// ============================================
// The invoice number a device may write.
//
// ⚠️ A DEVICE NEVER WRITES THE OFFICIAL NUMBER.
//
// The official number comes from the server's canonical sequence — the one
// Phase 0 found: `nextval('invoice_number_seq')` (docs/missing-rpcs-migration.sql:35).
// A second numbering system on the device would hand out numbers the server
// never agreed to, and two devices writing the same number would produce two
// invoices with one identity.
//
// So an invoice written offline carries a TEMPORARY id, and every screen that
// shows it says so.
// ============================================

/** The prefix that marks a number as temporary. */
export const TEMPORARY_INVOICE_PREFIX = 'OFF-'

/**
 * The temporary number an offline invoice carries.
 *
 * `OFF-<device>-<seq>`: the device, so two devices that both wrote an invoice
 * offline can be told apart, and the sequence, so the number is stable for
 * the same device.
 */
export function temporaryInvoiceNumber(deviceId: string, seq: number): string {
  return `${TEMPORARY_INVOICE_PREFIX}${deviceId}-${String(seq).padStart(4, '0')}`
}

/**
 * Is this number one the server has not seen yet?
 *
 * The check is on the prefix, not on a flag: a number that says it is
 * temporary says so wherever it travels — in a list, on a receipt, in a
 * printout.
 */
export function isTemporaryInvoiceNumber(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(TEMPORARY_INVOICE_PREFIX)
}
