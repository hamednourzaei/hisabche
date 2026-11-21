// ============================================
// packages/ui/src/lib/invoices/advance-id.ts
//
// The id a pre-sale / pre-purchase is created with.
//
// `submissionKey` belongs to the INVOICE endpoint: `inv_web_<uuid>`. The
// advances endpoint types its `id` as a uuid, and the preview sent the
// prefixed key unchanged — so every pre-purchase (and pre-sale) answered
// «id: Invalid uuid» and could not be recorded.
//
// The uuid inside the key is stable for the life of the draft, so a retried
// confirm is still the same advance. A value that is not a uuid yields
// `undefined`: the caller then sends no id and the server mints one, which is
// better than sending a key the schema will refuse.
// ============================================

/** The prefix `newSubmissionKey()` puts on the invoice's own idempotency key. */
export const INVOICE_SUBMISSION_PREFIX = 'inv_web_'

/** The same shape the server's `z.string().uuid()` accepts. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function advanceIdFromSubmissionKey(submissionKey: string): string | undefined {
  const bare = submissionKey.startsWith(INVOICE_SUBMISSION_PREFIX)
    ? submissionKey.slice(INVOICE_SUBMISSION_PREFIX.length)
    : submissionKey
  return UUID.test(bare) ? bare : undefined
}
