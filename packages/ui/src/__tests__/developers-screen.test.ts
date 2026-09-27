// ============================================
// The developer screen (API keys and webhooks).
//
// Its labels are built from data — a scope, an event type, a delivery
// status — so the literal-key scan in i18n-keys-exist.test.ts cannot see
// them. Every value the contract can produce must have a label in fa, af and
// en; a missing one throws inside next-intl and takes the page down.
//
// And the states that must never read as «empty»: 503 (not set up) and 403
// (not allowed) each have their own sentence.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { API_KEY_SCOPES, WEBHOOK_EVENTS } from '@hisabche/validation'

const ROOT = join(__dirname, '../../../..')
const LOCALES = ['fa', 'af', 'en'] as const
const catalog = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8')) as {
    developer: Record<string, Record<string, string>>
  }
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => strip(readFileSync(join(ROOT, p), 'utf8'))

describe.each(LOCALES)('%s labels every value the contract can produce', (lang) => {
  const dev = catalog(lang).developer

  it.each([...API_KEY_SCOPES])('scope %s', (scope) => {
    expect(dev.scope?.[scope.replace(':', '_')]).toBeTruthy()
  })

  it.each([...WEBHOOK_EVENTS])('event %s', (event) => {
    expect(dev.event?.[event.replace('.', '_')]).toBeTruthy()
  })

  it.each(['pending', 'delivering', 'succeeded', 'failed'])('delivery status %s', (status) => {
    expect(dev.delivery?.[status]).toBeTruthy()
  })
})

describe('the screen', () => {
  const container = read(
    'packages/ui/src/components/ui/developers/containers/developers-container.tsx',
  )
  const view = read('packages/ui/src/components/ui/developers/developers-view.tsx')

  it('503 and 403 are their own states, not an empty list', () => {
    expect(container).toContain("if (status === 503) return 'not-configured'")
    expect(container).toContain("if (status === 403) return 'forbidden'")
    expect(view).toContain("t('developer.notConfigured')")
    expect(view).toContain("t('developer.forbidden')")
  })

  it('the views take props only — no data hook', () => {
    const panel = read('packages/ui/src/components/ui/developers/key-usage-panel.tsx')
    for (const source of [view, panel]) {
      // Types only from @hisabche/api; a value import would be a hook.
      expect(source).toMatch(/^import type \{[^}]*\} from '@hisabche\/api'/m)
      expect(source).not.toMatch(/^import \{[^}]*\} from '@hisabche\/api'/m)
    }
  })

  it('usage before migration 02 is its own sentence, not an error or «no requests»', () => {
    const panel = read('packages/ui/src/components/ui/developers/key-usage-panel.tsx')
    expect(panel).toContain("if (state === 'not-configured')")
    expect(panel).toContain("t('developer.usageNotConfigured')")
  })

  it('is reachable on every host and hidden from crawlers', () => {
    expect(read('apps/web/app/[lang]/(dashboard)/developers/page.tsx')).toContain(
      '<DevelopersContainer />',
    )
    expect(read('packages/app-shell/src/app/app.tsx')).toContain(
      "{ path: 'developers', element: <DevelopersPage /> }",
    )
    // Raw: the comment stripper would read the '/*' of each path as a comment.
    expect(readFileSync(join(ROOT, 'apps/web/app/robots.ts'), 'utf8')).toContain("'/*/developers'")
    expect(read('packages/ui/src/components/ui/settings/settings-page.tsx')).toContain(
      "localizePath('/developers', lang)",
    )
  })
})
