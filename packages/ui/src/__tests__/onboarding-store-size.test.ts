// ============================================
// Every business size the onboarding screen offers must be one the server accepts.
//
// `solo` («کار انفرادی، ۱ نفر») was offered and refused by `updateProfileSchema`: the final
// «ورود به حسابچه» answered 400 on every press, so an owner who works alone never got past
// onboarding. Found by the browser journey (14 Nov 2026); accepted on the owner's word (D-01).
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { updateProfileSchema } from '@hisabche/validation'

const page = readFileSync(
  join(__dirname, '..', 'components', 'ui', 'onboarding', 'onboarding-page.tsx'),
  'utf8',
)
const start = page.indexOf('const storeSizes = [')
const block = page.slice(start, page.indexOf('\n  ]', start))
const offered = [...block.matchAll(/id: '([a-z]+)'/g)].map((match) => match[1])

describe('onboarding business sizes', () => {
  it('the screen offers sizes (the parse above found them)', () => {
    expect(offered).toContain('solo')
    expect(offered.length).toBeGreaterThanOrEqual(4)
  })

  it.each(offered)('the server accepts «%s»', (size) => {
    const result = updateProfileSchema.safeParse({ onboardingCompleted: true, storeSize: size })
    expect(result.success, JSON.stringify(result)).toBe(true)
  })
})
