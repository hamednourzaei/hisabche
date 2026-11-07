// ============================================
// Guards for the confirmed UI findings of docs/audit/AUDIT-80-*.md (7 Nov 2026).
// The full verdict list is docs/audit/AUDIT-80-VERIFICATION.md.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const UI = join(__dirname, '..', 'components', 'ui')
const read = (rel: string) =>
  readFileSync(join(UI, rel), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')

describe('AUDIT-80 #146 — a refused approval workflow is said, not swallowed', () => {
  const container = read('workflow/containers/workflow-templates-container.tsx')
  const view = read('workflow/workflow-templates-view.tsx')

  it('the container reads the server reason and shows it', () => {
    expect(container).toContain('apiErrorMessage(error,')
    expect(container).toContain('toast.error(')
    // both writes go through it
    expect(container.match(/sayFailed\(error\)/g)?.length).toBe(2)
  })

  it('a failed create keeps the form open instead of throwing into the click', () => {
    const submit = view.slice(view.indexOf('const handleSubmit'), view.indexOf("setName('')"))
    expect(submit).toContain('try {')
    expect(submit).toContain('catch {')
  })
})

describe('AUDIT-80 #24 — translation keys are typed, not cast to any', () => {
  it.each(['dashboard/first-value-checklist.tsx', 'invoices/containers/sales-hub-container.tsx'])(
    '%s has no `as any`',
    (file) => {
      expect(read(file)).not.toMatch(/\bas any\b/)
    },
  )
})
