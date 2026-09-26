// The activity feed cache is scope 'user': keys are `activities:<userId>:<url>`
// and `activities-unread:<userId>:<url>`. Clears keyed by workspace id, or
// without the trailing `:*`, matched nothing and the feed stayed stale.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const routes = ['activity.routes.ts', 'invoice.routes.ts'].map((f) =>
  readFileSync(join(__dirname, '../routes', f), 'utf8'),
)
const clears = routes.flatMap((src) =>
  [...src.matchAll(/clearCache\(`(activities[^`]*)`\)/g)].map((m) => m[1]!),
)

describe('activity cache clears match the user-scoped keys', () => {
  it('there are clears to check', () => {
    expect(clears.length).toBeGreaterThan(5)
  })
  it('every clear is by user and ends with :*', () => {
    for (const key of clears) {
      expect(key, key).toMatch(
        /^activities(-unread|-counts)?:\$\{(userId|request\.tenancy\.userId)\}:\*$/,
      )
    }
  })
})
