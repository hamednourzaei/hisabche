// ============================================
// The sandbox on screen: marked on EVERY page of a sandbox, in both shells —
// test invoices must never pass for the real books — and every sentence in
// three languages.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SANDBOX_ERROR_CODES } from '@hisabche/validation'

const ROOT = join(__dirname, '../../../..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => strip(readFileSync(join(ROOT, p), 'utf8'))
const lookup = (tree: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], tree)

const DEV = 'packages/ui/src/components/ui/developers'
const FILES = [
  `${DEV}/sandbox-notice.tsx`,
  `${DEV}/sandbox-panel.tsx`,
  `${DEV}/containers/developers-container.tsx`,
]

describe('the sandbox mark', () => {
  it('both shells draw it above every page, inside the main area', () => {
    const web = read('apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx')
    expect(web).toMatch(/<main[^>]*>\s*<SandboxNotice \/>/)
    const desktop = read('packages/app-shell/src/components/layout/app-shell.tsx')
    expect(desktop).toMatch(/<main[^>]*>\s*<SandboxNotice \/>/)
  })

  it('it is drawn only when the server says this workspace IS a sandbox', () => {
    const notice = read(`${DEV}/sandbox-notice.tsx`)
    expect(notice).toContain('if (!data?.isSandbox) return null')
  })

  it('stepping in or out goes through one helper, which reloads into the new workspace', () => {
    const helper = read('packages/ui/src/lib/enter-workspace.ts')
    expect(helper.indexOf('setWorkspace(id, name)')).toBeLessThan(
      helper.indexOf('window.location.reload()'),
    )
    const container = read(`${DEV}/containers/developers-container.tsx`)
    expect(container).toContain('onSuccess: (out) => enterWorkspace(out.id, out.name)')
    expect(container).toContain('onEnter: enterWorkspace')
  })
})

describe('words', () => {
  it.each(['fa', 'af', 'en'])('%s has every key the screens use and every refusal', (lang) => {
    const messages = JSON.parse(
      readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8'),
    ) as Record<string, unknown>
    for (const code of SANDBOX_ERROR_CODES) {
      expect(lookup(messages, `sandbox.error.${code}`), code).toBeTypeOf('string')
    }
    const used = new Set<string>()
    for (const file of FILES) {
      for (const m of read(file).matchAll(/t\('(sandbox\.[a-zA-Z_.]+)'/g)) used.add(m[1] as string)
    }
    expect(used.size).toBeGreaterThanOrEqual(9)
    expect([...used].filter((key) => typeof lookup(messages, key) !== 'string')).toEqual([])
  })

  it('a refusal from the server is worded only through the closed list', () => {
    expect(read('packages/ui/src/lib/sandbox-labels.ts')).toContain(
      '(SANDBOX_ERROR_CODES as readonly string[]).includes(code)',
    )
  })
})
