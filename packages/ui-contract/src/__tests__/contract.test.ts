// ============================================
// Contract enforcement.
//
// Most of this package's guarantees are compile-time (`satisfies` +
// exhaustive Records). These runtime tests cover what the compiler cannot:
// that roles resolve to REAL canonical values, that no colour literal has
// crept in, and that the package stays platform-neutral.
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { brand, semantic, themes } from '@hisabche/design-tokens'

import {
  BUTTON_VARIANTS,
  DESKTOP_TONE_ALIAS,
  DIALOG_SURFACE,
  MOBILE_TEXT_TONE_ROLE,
  MOBILE_TONE_ALIAS,
  SEMANTIC_COLOR_ROLES,
  SEMANTIC_COLORS,
  TONE_FOREGROUND,
  isThemeDependent,
  resolveColor,
  type SemanticColor,
} from '../index'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(here, '..')

const sourceFiles = readdirSync(srcDir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ name: f, text: readFileSync(join(srcDir, f), 'utf8') }))

describe('every semantic role resolves to a real canonical token', () => {
  it.each(SEMANTIC_COLOR_ROLES)('%s resolves in both themes', (role) => {
    for (const theme of ['dark', 'light'] as const) {
      const value = resolveColor(role, theme)
      expect(value).toBeTruthy()
      // A bare HSL triplet: "<h> <s>% <l>%".
      expect(value).toMatch(/^-?\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/)
    }
  })

  it('resolved values are the canonical objects, not copies', () => {
    expect(resolveColor('interactive.primary', 'dark')).toBe(brand.primary)
    expect(resolveColor('status.danger', 'dark')).toBe(semantic.destructive)
    expect(resolveColor('surface.base', 'dark')).toBe(themes.dark.surfaceBase)
    expect(resolveColor('surface.base', 'light')).toBe(themes.light.surfaceBase)
  })

  it('theme-dependent roles actually differ between themes', () => {
    const themed = SEMANTIC_COLOR_ROLES.filter(isThemeDependent)
    expect(themed.length).toBeGreaterThan(0)
    for (const role of themed) {
      expect(resolveColor(role, 'dark')).not.toBe(resolveColor(role, 'light'))
    }
  })

  it('theme-independent roles are identical across themes', () => {
    const fixed = SEMANTIC_COLOR_ROLES.filter((r) => !isThemeDependent(r))
    for (const role of fixed) {
      expect(resolveColor(role, 'dark')).toBe(resolveColor(role, 'light'))
    }
  })
})

describe('NO SECOND SOURCE OF TRUTH: the contract holds no colour literals', () => {
  const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\bhsla?\(|\brgba?\(/

  it.each(sourceFiles.map((f) => f.name))('%s contains no colour value', (name) => {
    const file = sourceFiles.find((f) => f.name === name)!
    const offending = file.text
      .split('\n')
      .filter((line) => COLOUR_LITERAL.test(line) && !line.trimStart().startsWith('//'))
    expect(offending).toEqual([])
  })
})

describe('PLATFORM NEUTRAL: no framework or platform import', () => {
  const FORBIDDEN = ['react', 'react-native', 'react-dom', 'electron', 'next/', 'expo']

  it.each(sourceFiles.map((f) => f.name))('%s imports nothing platform-specific', (name) => {
    const file = sourceFiles.find((f) => f.name === name)!
    const imports = [...file.text.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!)
    const bad = imports.filter((spec) => FORBIDDEN.some((f) => spec === f || spec.startsWith(f)))
    expect(bad).toEqual([])
  })

  it('only depends on design-tokens and relative modules', () => {
    const external = sourceFiles
      .flatMap((f) => [...f.text.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!))
      .filter((spec) => !spec.startsWith('.'))
      .filter((spec) => !spec.startsWith('node:'))
    expect([...new Set(external)]).toEqual(['@hisabche/design-tokens'])
  })
})

describe('platform tone aliases translate onto the canonical vocabulary', () => {
  it('mobile BadgeTone maps every member', () => {
    expect(MOBILE_TONE_ALIAS.primary).toBe('brand')
    expect(MOBILE_TONE_ALIAS.destructive).toBe('danger')
    expect(Object.keys(MOBILE_TONE_ALIAS)).toHaveLength(6)
  })

  it('desktop BadgeTone maps every member and is already canonical', () => {
    expect(Object.values(DESKTOP_TONE_ALIAS)).toEqual(Object.keys(DESKTOP_TONE_ALIAS))
    expect(Object.keys(DESKTOP_TONE_ALIAS)).toHaveLength(6)
  })

  it('both platforms land on the same six tones', () => {
    const mobile = new Set(Object.values(MOBILE_TONE_ALIAS))
    const desktop = new Set(Object.values(DESKTOP_TONE_ALIAS))
    expect([...mobile].sort()).toEqual([...desktop].sort())
  })

  it('every tone has a foreground role that exists', () => {
    for (const role of Object.values(TONE_FOREGROUND)) {
      expect(SEMANTIC_COLORS[role as SemanticColor]).toBeDefined()
    }
  })
})

describe('component contracts reference only declared roles', () => {
  it('every mobile TextTone maps to a real role', () => {
    for (const role of Object.values(MOBILE_TEXT_TONE_ROLE)) {
      expect(SEMANTIC_COLOR_ROLES).toContain(role)
    }
  })

  it('every Button variant references real roles', () => {
    for (const variant of Object.values(BUTTON_VARIANTS)) {
      for (const role of [variant.background, variant.foreground, variant.border]) {
        if (role !== null) expect(SEMANTIC_COLOR_ROLES).toContain(role)
      }
    }
  })

  it('no orphan roles: every declared role is reachable from some contract', () => {
    const buttonRoles: string[] = []
    for (const variant of Object.values(BUTTON_VARIANTS)) {
      for (const role of [variant.background, variant.foreground, variant.border]) {
        if (role !== null) buttonRoles.push(role)
      }
    }

    const used = new Set<string>([
      ...Object.values(TONE_FOREGROUND),
      ...Object.values(MOBILE_TEXT_TONE_ROLE),
      ...buttonRoles,
    ])

    // Roles reserved for adapters that do not exist yet are listed explicitly,
    // so an accidental orphan is still caught.
    const knownUnused: SemanticColor[] = [
      'surface.base',
      'surface.elevated',
      'surface.overlay',
      'border.strong',
      'interactive.primaryHover',
      'interactive.primaryLight',
      'interactive.secondary',
      'interactive.accent',
      'status.onSuccess',
      'status.onWarning',
      'status.onInfo',
    ]

    const orphans = SEMANTIC_COLOR_ROLES.filter((r) => !used.has(r) && !knownUnused.includes(r))
    expect(orphans).toEqual([])
  })
})

describe('dialog roles cover all three platforms', () => {
  it.each(Object.entries(DIALOG_SURFACE))('%s declares web, desktop and mobile', (_role, map) => {
    expect(Object.keys(map).sort()).toEqual(['desktop', 'mobile', 'web'])
  })
})
