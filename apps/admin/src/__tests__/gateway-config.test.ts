import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * V63 audit (12 Nov 2026) — the gateway form exists, and stays safe.
 *
 * The panel used to send the admin to a «Security → Secrets» tab that did not
 * exist; nothing called `/admin/secrets` or the gateway metadata route, so no
 * key and no PayPal address could be entered and no gateway could be enabled.
 * Source assertions (the console needs an AAL2 session CI does not have).
 */

const adminRoot = path.resolve(__dirname, '../../')
const repoRoot = path.resolve(adminRoot, '../../')
const read = (...parts: string[]) => fs.readFileSync(path.join(...parts), 'utf8')
const form = read(
  adminRoot,
  'app',
  '[lang]',
  '(admin)',
  'revenue',
  'gateways',
  'gateway-config.tsx',
)
const panel = read(
  adminRoot,
  'app',
  '[lang]',
  '(admin)',
  'revenue',
  'gateways',
  'gateways-panel.tsx',
)
const hooks = read(adminRoot, 'hooks', 'use-admin-gateways.ts')

type Tree = { [key: string]: string | Tree }
const at = (tree: Tree, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree)

describe('the gateway form is wired', () => {
  it('the panel opens it, and the hooks call the two routes that had no caller', () => {
    expect(panel).toContain('<GatewayConfig')
    expect(hooks).toContain('`/admin/gateways/${input.id}/metadata`')
    expect(hooks).toContain('`/admin/secrets/${encodeURIComponent(input.name)}`')
    expect(hooks).toContain("apiClient.get('/admin/secrets')")
  })

  it('every write carries the step-up header', () => {
    const writes = hooks.slice(hooks.indexOf('export function useStageSecret'))
    expect(writes.match(/'X-Admin-Step-Up-Timestamp'/g)?.length).toBe(2)
  })

  it('the PayPal fields are exactly what the manual adapter reads', () => {
    const adapter = read(
      repoRoot,
      'backend',
      'src',
      'services',
      'payments-gateway',
      'manual.adapter.ts',
    )
    expect(adapter).toContain("MANUAL_CONFIG_KEYS = ['paypal_email', 'bank_details']")
    expect(form).toContain("PAYPAL: ['paypal_email', 'bank_details']")
  })
})

describe('a secret never comes back, and never lingers', () => {
  it('the key field is a write-only password field, cleared once sent', () => {
    expect(form).toContain('type="password"')
    expect(form).toContain('autoComplete="new-password"')
    expect(form).toContain("setSecretDrafts((all) => ({ ...all, [pending.name]: '' }))")
  })
  it('no browser storage, and only metadata is read', () => {
    expect(form).not.toMatch(/localStorage|sessionStorage/)
    expect(hooks).not.toMatch(/\bvalue:\s*string\s*\|\s*null/)
  })
})

describe.each(['fa', 'af', 'en'])('every key the form and panel read exists in %s', (lang) => {
  const messages = JSON.parse(
    read(repoRoot, 'packages', 'i18n', 'messages', lang, 'common.json'),
  ) as Tree
  it('literal keys', () => {
    const missing: string[] = []
    for (const source of [form, panel]) {
      for (const m of source.matchAll(/t\('(admin\.gateways\.[a-zA-Z0-9_.]+)'/g)) {
        if (typeof at(messages, m[1]!) !== 'string') missing.push(m[1]!)
      }
    }
    for (const field of ['paypal_email', 'bank_details', 'publishable_key']) {
      if (typeof at(messages, `admin.gateways.config.fields.${field}`) !== 'string')
        missing.push(field)
    }
    for (const code of [
      'GATEWAY_CONFIG_KEY_IS_SECRET',
      'GATEWAY_CONFIG_VALUE_INVALID',
      'GATEWAY_PAYPAL_EMAIL_INVALID',
    ]) {
      if (typeof at(messages, `admin.gateways.config.errors.${code}`) !== 'string')
        missing.push(code)
    }
    expect(missing).toEqual([])
  })
})
