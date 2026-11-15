// ============================================
// The header's «last synced» pill gives its number TO the translator.
//
// `t('sync.minutesAgo').replace('{m}', …)` with next-intl's own translator answers the KEY
// (the message has a placeholder and got no value): the header read «sync.minutesAgo».
// Found by the browser journey's raw-key check (14 Nov 2026).
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const header = readFileSync(
  join(__dirname, '..', 'components', 'ui', 'dashboard-header.tsx'),
  'utf8',
)

describe('header sync pill', () => {
  it('passes the minutes as a value, not by string replacement', () => {
    expect(header).toContain("t('sync.minutesAgo', { m: Math.floor(s / 60) })")
    expect(header).not.toContain("t('sync.minutesAgo').replace(")
  })
})
