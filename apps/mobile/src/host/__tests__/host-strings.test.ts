// ============================================
// The native host's own words follow the person's language.
//
// The «app could not open» screen and the camera overlay were Persian literals;
// an English or Dari reader got Persian exactly when something went wrong.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { hostStrings, toHostLocale } from '../host-strings'

describe('host language', () => {
  it('maps the stored language and device tags to a bundle', () => {
    expect(toHostLocale('fa-IR')).toBe('fa')
    expect(toHostLocale('fa-AF')).toBe('af')
    expect(toHostLocale('ps-AF')).toBe('af')
    expect(toHostLocale('en')).toBe('en')
    expect(toHostLocale('en-US')).toBe('en')
    expect(toHostLocale(null)).toBe('fa')
  })

  it('every bundle has every string, and none is empty', () => {
    const keys = Object.keys(hostStrings.fa).sort()
    for (const locale of ['fa', 'af', 'en'] as const) {
      expect(Object.keys(hostStrings[locale]).sort()).toEqual(keys)
      for (const value of Object.values(hostStrings[locale])) expect(value.trim()).not.toBe('')
    }
  })

  it('Dari is not written in Pashto letters', () => {
    for (const value of Object.values(hostStrings.af)) expect(value).not.toMatch(/[ږښېۍټډړڼګ]/)
  })

  it('⚠️ the native screens draw no literal Persian text', () => {
    for (const file of ['shell-webview.tsx', 'camera-scan-overlay.tsx']) {
      const code = readFileSync(join(__dirname, '..', file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(code).not.toMatch(/>[^<{]*[؀-ۿ][^<{]*</)
    }
  })
})
