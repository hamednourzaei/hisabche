// BUG-005 — «ثبت فاکتور ناموفق بود» while the invoice was in fact created.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(__dirname, '../components/ui/invoice-builder/containers/invoice-preview-container.tsx'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')

describe('invoice preview — a failed-looking create is safe to retry', () => {
  it('sends ONE idempotency key per DRAFT — kept across visits, so a retry cannot create a second invoice', () => {
    // ⚠️ It was one key per visit to this screen. On the live site (14 Oct)
    // the server finished an invoice after the client timed out; the draft was
    // kept, and the next visit gave it a new key — a second submit would have
    // made a second invoice.
    expect(src).toContain(
      'const submissionKey = useInvoiceDraftStore((state) => state.submissionKey)',
    )
    expect(src).toContain('idempotencyKey: submissionKey,')
    expect(src).not.toContain('crypto.randomUUID()')
    const store = readFileSync(
      join(__dirname, '../../../store/src/slices/invoice-draft.slice.ts'),
      'utf8',
    )
    // Born with a blank draft (so clearDraft — only after a confirmed save — is
    // the one thing that replaces it) and saved with the draft.
    const blank = store.slice(store.indexOf('function blankDraft('))
    expect(blank.slice(0, 900)).toContain('submissionKey: newSubmissionKey(),')
    expect(store).toContain('submissionKey: state.submissionKey,')
  })

  it('shows the server reason (the API client rejects with a plain object, not an Error)', () => {
    expect(src).not.toContain('cause instanceof Error')
    expect(src).toContain('(cause as { message?: unknown } | null)?.message')
  })
})
