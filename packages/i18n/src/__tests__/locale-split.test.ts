import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  SHELL_EXCLUDED_NAMESPACES,
  getLoadedLocales,
  getMessages,
  loadMessages,
  requireMessage,
  resetLoadedMessagesForTests,
} from '../messages'

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      walkTsFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe('locale dynamic split and shell namespace filter (V62 Slice 3)', () => {
  beforeEach(() => {
    resetLoadedMessagesForTests()
  })

  it('loading en does not load fa or af into memory', async () => {
    const catalog = await loadMessages('en', { shellOnly: true })
    expect(getLoadedLocales()).toEqual(['en'])
    expect(getMessages('en')).toBe(catalog)
    expect(getMessages('fa')).toEqual({})
    expect(getMessages('af')).toEqual({})
  })

  it('excludes web-only namespaces in shellOnly mode without mutating source JSON', async () => {
    const catalog = await loadMessages('fa', { shellOnly: true })
    for (const ns of SHELL_EXCLUDED_NAMESPACES) {
      expect(catalog[ns]).toBeUndefined()
    }
    expect(catalog.common).toBeDefined()
    expect(catalog.nav).toBeDefined()
  })

  it('requireMessage throws on a missing key', async () => {
    const catalog = await loadMessages('en', { shellOnly: true })
    expect(() => requireMessage(catalog, 'definitely.missing.key.v62')).toThrow(
      /Missing i18n message key/,
    )
  })

  it('app-shell never references an excluded web-only namespace', () => {
    const shellSrc = path.resolve(__dirname, '../../../app-shell/src')
    const files = walkTsFiles(shellSrc)
    expect(files.length).toBeGreaterThan(0)
    const pattern = new RegExp(
      `useTranslations\\(\\s*['"](${SHELL_EXCLUDED_NAMESPACES.join('|')})['"]\\s*\\)`,
    )
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8')
      expect(
        pattern.test(content),
        `app-shell file ${path.relative(shellSrc, file)} must not use excluded web-only i18n namespaces`,
      ).toBe(false)
    }
  })
})
