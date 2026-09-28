// ============================================
// OAuth on screen: the consent page refuses a malformed request without
// redirecting anywhere, every server value has words in three languages, and
// the page is where apps are told it is — hidden from crawlers.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OAUTH_APP_STATUSES, OAUTH_ERROR_CODES } from '@hisabche/validation'

import { parseAuthorizeQuery } from '../components/ui/developers/containers/oauth-consent-container'

const ROOT = join(__dirname, '../../../..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => strip(readFileSync(join(ROOT, p), 'utf8'))
const catalog = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8')) as {
    oauth: Record<string, unknown>
  }
const lookup = (tree: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree)

const DEV = 'packages/ui/src/components/ui/developers'
const FILES = [
  `${DEV}/oauth-apps-panel.tsx`,
  `${DEV}/oauth-consent-view.tsx`,
  `${DEV}/containers/oauth-consent-container.tsx`,
  `${DEV}/containers/developers-container.tsx`,
  `${DEV}/developers-view.tsx`,
]

describe('the consent request', () => {
  const full = {
    response_type: 'code',
    client_id: 'hk_app_x',
    redirect_uri: 'https://app.example/cb',
    scope: 'read:products',
    state: 's',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
  }

  it('a complete S256 request is read as-is', () => {
    expect(parseAuthorizeQuery(full)).toMatchObject({ client_id: 'hk_app_x', state: 's' })
  })

  it.each([
    ['no PKCE', { ...full, code_challenge: undefined }],
    ['plain PKCE', { ...full, code_challenge_method: 'plain' }],
    ['implicit flow', { ...full, response_type: 'token' }],
    ['no redirect_uri', { ...full, redirect_uri: undefined }],
    ['no scope', { ...full, scope: undefined }],
  ])('%s is refused', (_name, query) => {
    expect(parseAuthorizeQuery(query)).toBeNull()
  })

  it('nobody is redirected before the server has vouched for the redirect_uri', () => {
    const container = read(`${DEV}/containers/oauth-consent-container.tsx`)
    const deny = container.slice(container.indexOf('onDeny='))
    expect(deny.indexOf("state.kind !== 'ready'")).toBeLessThan(
      deny.indexOf('window.location.assign'),
    )
    // Approval redirects only to what the server returned.
    expect(container).toMatch(
      /onSuccess:\s*\(out\)\s*=>\s*window\.location\.assign\(out\.redirectTo\)/,
    )
    // Deny and approve are drawn only in the ready state.
    const view = read(`${DEV}/oauth-consent-view.tsx`)
    expect(view.indexOf("state.kind === 'ready'")).toBeLessThan(view.indexOf('props.onDeny'))
  })

  it('a signed-out visitor comes back to the same request after login', () => {
    const container = read(`${DEV}/containers/oauth-consent-container.tsx`)
    expect(container).toContain('replace(`/login?redirect=${encodeURIComponent(back)}`)')
  })
})

describe('words', () => {
  it.each(['fa', 'af', 'en'])(
    '%s has every status, every error and every key the screens use',
    (lang) => {
      const messages = JSON.parse(
        readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8'),
      ) as Record<string, unknown>
      const oauth = catalog(lang).oauth
      for (const s of OAUTH_APP_STATUSES)
        expect(lookup(oauth, `status.${s}`), s).toBeTypeOf('string')
      for (const c of OAUTH_ERROR_CODES) expect(lookup(oauth, `error.${c}`), c).toBeTypeOf('string')
      const used = new Set<string>()
      for (const file of FILES) {
        for (const m of read(file).matchAll(/t\('(oauth\.[a-zA-Z_.]+)'/g)) used.add(m[1] as string)
      }
      expect(used.size).toBeGreaterThan(40)
      expect([...used].filter((key) => typeof lookup(messages, key) !== 'string')).toEqual([])
    },
  )

  it('a server value is looked up only through the closed lists', () => {
    const labels = read('packages/ui/src/lib/oauth-labels.ts')
    expect(labels).toContain('(OAUTH_APP_STATUSES as readonly string[]).includes(status)')
    expect(labels).toContain('(OAUTH_ERROR_CODES as readonly string[]).includes(code)')
    for (const file of FILES) expect(read(file)).not.toMatch(/t\(`oauth\./)
  })
})

describe('where it lives', () => {
  it('the web page renders the shared container, noindex, and crawlers are kept out', () => {
    const page = read('apps/web/app/[lang]/oauth/authorize/page.tsx')
    expect(page).toContain('<OAuthConsentContainer query={query} />')
    expect(page).toContain('index: false')
    const robots = readFileSync(join(ROOT, 'apps/web/app/robots.ts'), 'utf8')
    expect(robots).toContain("'/oauth/'")
    expect(robots).toContain("'/*/oauth/'")
  })

  it('the developer screen shows the apps panel, and a client secret is shown once', () => {
    expect(read(`${DEV}/developers-view.tsx`)).toContain(
      '<OAuthAppsPanel t={t} {...props.oauth} />',
    )
    expect(read(`${DEV}/containers/developers-container.tsx`)).toContain(
      "setRevealed({ kind: 'client-secret', value: out.clientSecret })",
    )
  })
})
