// ============================================
// The role beside each recent activity.
//
// ---------------------------------------------------------------------------
// WHAT THESE GUARD
//
// 1. ONE PALETTE. The role colours were defined inside `dashboard-header.tsx`.
//    The activity feed needed the same four colours, and the cheap move — copy
//    the map — is how the same person ends up two different colours on one
//    screen. Both surfaces now read `lib/role-tone.ts`.
//
// 2. AN UNKNOWN ROLE STAYS UNKNOWN. An activity whose actor has no current
//    membership arrives with `actorRole: null`. Rendering it as `member` or
//    `viewer` would be a false statement about a real person — and «viewer» is
//    the tempting default precisely because it looks harmless.
//
// 3. EVERY LABEL EXISTS IN EVERY LOCALE. `next-intl`'s `t()` THROWS on a
//    missing key, so a key added to `fa` alone does not degrade — it takes the
//    dashboard down in Dari and English.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROLE_TONE, ROLE_TONE_UNKNOWN, roleLabelKey, roleTone } from '../lib/role-tone'

const SRC = join(__dirname, '..')

/**
 * ⚠️ COMMENTS STRIPPED FIRST — the same reason as
 * `header-sidebar-identity.test.ts`: the `not.toMatch` assertions below would
 * otherwise match the prose explaining why the thing they forbid is forbidden.
 */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const header = code(join(SRC, 'components', 'ui', 'dashboard-header.tsx'))
const dashboard = code(join(SRC, 'components', 'ui', 'dashboard', 'dashboard-view.tsx'))

const LOCALES = ['fa', 'af', 'en'] as const

function catalog(locale: string): Record<string, Record<string, string>> {
  return JSON.parse(
    readFileSync(join(SRC, '..', '..', 'i18n', 'messages', locale, 'common.json'), 'utf8'),
  ) as Record<string, Record<string, string>>
}

describe('the role palette is stated once', () => {
  it('⚠️ the header no longer declares its own ROLE_TONE map', () => {
    expect(header).not.toMatch(/const ROLE_TONE\b/)
    expect(header).toMatch(/roleTone\(/)
  })

  it('the activity feed colours roles from the same module', () => {
    expect(dashboard).toMatch(/from '\.\.\/\.\.\/\.\.\/lib\/role-tone'/)
    expect(dashboard).toMatch(/roleTone\(a\.actorRole\)/)
  })

  it('every role colour is a design token, never a raw colour', () => {
    for (const tone of Object.values(ROLE_TONE)) {
      expect(tone).toMatch(/hsl\(var\(--/)
      expect(tone).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    }
  })
})

describe('an unknown role is uncoloured, not «viewer»', () => {
  it('null, undefined and an unrecognised value all get the neutral tone', () => {
    expect(roleTone(null)).toBe(ROLE_TONE_UNKNOWN)
    expect(roleTone(undefined)).toBe(ROLE_TONE_UNKNOWN)
    expect(roleTone('accountant')).toBe(ROLE_TONE_UNKNOWN)
  })

  it('⚠️ and they are labelled «unknown», never a real role', () => {
    expect(roleLabelKey(null)).toBe('team.roleUnknown')
    expect(roleLabelKey('')).toBe('team.roleUnknown')
    expect(roleLabelKey('member')).toBe('team.roleMember')
    expect(roleLabelKey('owner')).toBe('team.roleOwner')
  })

  it('⚠️ the feed never substitutes a role for a missing one', () => {
    expect(dashboard).not.toMatch(/actorRole\s*\?\?\s*'(member|viewer|owner|admin)'/)
    expect(dashboard).not.toMatch(/actorRole\s*\|\|\s*'(member|viewer|owner|admin)'/)
  })
})

describe('the new strings exist in fa, af and en', () => {
  const keys: Array<[string, string]> = [
    ['team', 'roleUnknown'],
    ['team', 'roleOwner'],
    ['team', 'roleAdmin'],
    ['team', 'roleMember'],
    ['team', 'roleViewer'],
    ['dashboard', 'activityColumnRole'],
    ['dashboard', 'activityColumnEvent'],
    ['error', 'backToDashboard'],
    ['error', 'backToLanding'],
    ['action', 'retry'],
  ]

  for (const locale of LOCALES) {
    it(`${locale} has every key the boundaries and the feed ask for`, () => {
      const messages = catalog(locale)
      for (const [group, key] of keys) {
        expect(typeof messages[group]?.[key], `${locale}: ${group}.${key}`).toBe('string')
        expect(messages[group]?.[key]).not.toBe('')
      }
    })
  }
})
