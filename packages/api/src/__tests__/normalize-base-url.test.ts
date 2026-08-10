// ============================================
// A malformed base URL is silent and total: every request in the app goes to
// the wrong path. These pin the shapes that actually reached us from real
// shells and config files.
// ============================================

import { describe, expect, it } from 'vitest'

import { normalizeBaseUrl } from '../lib/client'

describe('normalizeBaseUrl', () => {
  it('passes a clean URL through unchanged', () => {
    expect(normalizeBaseUrl('http://localhost:10000/api')).toBe('http://localhost:10000/api')
  })

  it('strips a trailing space', () => {
    // Windows cmd.exe: `set VAR=http://host/api && cmd` puts the space before
    // `&&` inside the value, producing requests to `/api%20/auth/login`.
    expect(normalizeBaseUrl('http://172.20.10.8:10000/api ')).toBe('http://172.20.10.8:10000/api')
  })

  it('strips leading whitespace and newlines', () => {
    expect(normalizeBaseUrl('  http://host/api\n')).toBe('http://host/api')
  })

  it('strips a trailing slash so paths do not double up', () => {
    expect(normalizeBaseUrl('http://host/api/')).toBe('http://host/api')
  })

  it('strips several trailing slashes', () => {
    expect(normalizeBaseUrl('http://host/api///')).toBe('http://host/api')
  })

  it('handles a trailing slash behind a trailing space', () => {
    expect(normalizeBaseUrl('http://host/api/ ')).toBe('http://host/api')
  })

  it('preserves the path segment', () => {
    expect(normalizeBaseUrl('https://api.hisabche.com/api')).toBe('https://api.hisabche.com/api')
  })

  it('returns undefined for absent or blank values so callers fall back', () => {
    expect(normalizeBaseUrl(undefined)).toBeUndefined()
    expect(normalizeBaseUrl(null)).toBeUndefined()
    expect(normalizeBaseUrl('')).toBeUndefined()
    expect(normalizeBaseUrl('   ')).toBeUndefined()
  })

  it('does not mistake a bare origin for an empty value', () => {
    expect(normalizeBaseUrl('http://localhost:10000')).toBe('http://localhost:10000')
  })
})
