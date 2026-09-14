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
  it('sends ONE idempotency key per screen, so a retry cannot create a second invoice', () => {
    expect(src).toContain('const requestKeyRef = useRef(`inv_web_${crypto.randomUUID()}`)')
    expect(src).toContain('idempotencyKey: requestKeyRef.current')
  })

  it('shows the server reason (the API client rejects with a plain object, not an Error)', () => {
    expect(src).not.toContain('cause instanceof Error')
    expect(src).toContain('(cause as { message?: unknown } | null)?.message')
  })
})
