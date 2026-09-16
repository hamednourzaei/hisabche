// SEMrush crawled /en/till and /en/data-migration: 21 authenticated routes were
// missing from robots.ts, which is a hand-kept list. Every route folder in the
// dashboard group must be disallowed.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB = join(__dirname, '../../../../apps/web/app')
const DASHBOARD = join(WEB, '[lang]', '(dashboard)')

describe('robots.txt covers the authenticated app', () => {
  it('disallows every dashboard route folder', () => {
    const robots = readFileSync(join(WEB, 'robots.ts'), 'utf8')
    const routes = readdirSync(DASHBOARD).filter((name) =>
      statSync(join(DASHBOARD, name)).isDirectory(),
    )
    expect(routes.length).toBeGreaterThan(30)
    expect(routes.filter((route) => !robots.includes(`'/*/${route}'`))).toEqual([])
  })

  it('does not block a public route', () => {
    const robots = readFileSync(join(WEB, 'robots.ts'), 'utf8')
    for (const route of ['about', 'contact', 'docs', 'features', 'legal'])
      expect(robots).not.toContain(`'/*/${route}'`)
  })
})
