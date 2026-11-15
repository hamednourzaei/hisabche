// ============================================
// The invoice builder's date field is drawn only after hydration.
//
// The draft's default date comes from `new Date()` in the store: on the server it is the
// moment the module loaded, in the server's zone; in the browser, page load in the owner's
// zone. Two different days broke hydration (React #418) and swallowed the first click.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = [
  ['components', 'ui', 'invoice-builder', 'customer-panel.tsx'],
  ['components', 'ui', 'invoice-builder', 'mobile', 'invoice-builder-mobile.tsx'],
]

describe('invoice date waits for hydration', () => {
  it.each(files.map((parts) => [parts.join('/'), parts] as const))('%s', (_name, parts) => {
    const source = readFileSync(join(__dirname, '..', ...parts), 'utf8')
    expect(source).toContain('const hydrated = useAfterHydration()')
    expect(source).toContain("value={hydrated ? toDateValue(date) : ''}")
    expect(source).not.toContain('value={toDateValue(date)}')
  })
})
