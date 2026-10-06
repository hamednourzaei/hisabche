// ============================================
// PARITY — these tokens vs packages/ui/src/styles/globals.css.
//
// This is the whole point of the package. globals.css is still the file the
// browser loads; this module is a transcription of it. A transcription that
// nobody checks is just a second source of truth waiting to drift — which is
// exactly what happened to packages/mobile-ui (see the mobile drift suite
// below, which documents a divergence that already exists in production).
//
// The test parses the real CSS at run time. If either side changes without
// the other, this fails.
// ============================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  brand,
  darkTheme,
  focusRing,
  gradients,
  leading,
  lightTheme,
  motion,
  radius,
  semantic,
  space,
  typography,
  zIndex,
} from '../index'

const here = dirname(fileURLToPath(import.meta.url))
const GLOBALS = resolve(here, '../../../ui/src/styles/globals.css')
const css = readFileSync(GLOBALS, 'utf8')

/**
 * Reads a custom property out of a specific CSS block.
 * `blockStart` must be a unique selector string in the file.
 */
function readVar(blockStart: string, name: string): string {
  const from = css.indexOf(blockStart)
  if (from === -1) throw new Error(`Block not found in globals.css: ${blockStart}`)

  const blockOpen = css.indexOf('{', from)
  const blockEnd = css.indexOf('\n}', blockOpen)
  const block = css.slice(blockOpen, blockEnd)

  // `--name: value;` — tolerate arbitrary whitespace, capture up to the `;`.
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block)
  if (!match) throw new Error(`Var ${name} not found in block ${blockStart}`)
  return match[1]!.trim()
}

const inRoot = (name: string) => readVar(':root {', name)
const inLight = (name: string) => readVar(':root[data-theme="light"], .light', name)

describe('PARITY: brand colours', () => {
  it.each([
    ['--color-primary', brand.primary],
    ['--color-primary-fg', brand.primaryFg],
    ['--color-primary-hover', brand.primaryHover],
    ['--color-primary-light', brand.primaryLight],
    ['--color-secondary', brand.secondary],
    ['--color-accent', brand.accent],
    ['--color-dark', brand.dark],
    ['--color-black', brand.black],
  ])('%s matches globals.css', (cssName, token) => {
    expect(inRoot(cssName)).toBe(token)
  })
})

describe('PARITY: semantic colours', () => {
  it.each([
    ['--color-success', semantic.success],
    ['--color-success-fg', semantic.successFg],
    ['--color-warning', semantic.warning],
    ['--color-warning-fg', semantic.warningFg],
    ['--color-destructive', semantic.destructive],
    ['--color-destructive-fg', semantic.destructiveFg],
    ['--color-info', semantic.info],
    ['--color-info-fg', semantic.infoFg],
  ])('%s matches globals.css', (cssName, token) => {
    expect(inRoot(cssName)).toBe(token)
  })
})

describe('PARITY: dark theme (the :root default)', () => {
  it.each([
    ['--surface-base', darkTheme.surfaceBase],
    ['--surface-muted', darkTheme.surfaceMuted],
    ['--surface-elevated', darkTheme.surfaceElevated],
    ['--surface-overlay', darkTheme.surfaceOverlay],
    ['--fg-primary', darkTheme.fgPrimary],
    ['--fg-secondary', darkTheme.fgSecondary],
    ['--fg-tertiary', darkTheme.fgTertiary],
    ['--border-default', darkTheme.borderDefault],
    ['--border-strong', darkTheme.borderStrong],
    ['--glass-bg', darkTheme.glassBg],
    ['--glass-border', darkTheme.glassBorder],
    ['--shadow-premium', darkTheme.shadowPremium],
    ['--color-cyan', darkTheme.cyan],
    ['--color-emerald', darkTheme.emerald],
  ])('%s matches globals.css', (cssName, token) => {
    expect(inRoot(cssName)).toBe(token)
  })
})

describe('PARITY: light theme', () => {
  it.each([
    ['--surface-base', lightTheme.surfaceBase],
    ['--surface-muted', lightTheme.surfaceMuted],
    ['--surface-elevated', lightTheme.surfaceElevated],
    ['--surface-overlay', lightTheme.surfaceOverlay],
    ['--fg-primary', lightTheme.fgPrimary],
    ['--fg-secondary', lightTheme.fgSecondary],
    ['--fg-tertiary', lightTheme.fgTertiary],
    ['--border-default', lightTheme.borderDefault],
    ['--border-strong', lightTheme.borderStrong],
    ['--glass-bg', lightTheme.glassBg],
    ['--glass-border', lightTheme.glassBorder],
    ['--color-cyan', lightTheme.cyan],
    ['--color-emerald', lightTheme.emerald],
  ])('%s matches globals.css', (cssName, token) => {
    expect(inLight(cssName)).toBe(token)
  })
})

describe('PARITY: scales', () => {
  it.each([
    ['--text-hero', typography.hero.css],
    ['--text-h1', typography.h1.css],
    ['--text-h2', typography.h2.css],
    ['--text-h3', typography.h3.css],
    ['--text-body', typography.body.css],
    ['--text-caption', typography.caption.css],
    ['--text-legal', typography.legal.css],
  ])('%s matches globals.css', (cssName, token) => {
    expect(inRoot(cssName)).toBe(token)
  })

  it.each([
    ['--leading-tight', leading.tight],
    ['--leading-normal', leading.normal],
    ['--leading-relaxed', leading.relaxed],
  ])('%s matches globals.css', (cssName, token) => {
    expect(Number(inRoot(cssName))).toBe(token)
  })

  it.each(Object.entries(space))('--space-%s matches globals.css', (n, value) => {
    expect(inRoot(`--space-${n}`)).toBe(value)
  })

  it.each(Object.entries(radius))('--radius-%s matches globals.css', (n, value) => {
    expect(inRoot(`--radius-${n}`)).toBe(value)
  })

  it.each([
    ['--z-base', zIndex.base],
    ['--z-dropdown', zIndex.dropdown],
    ['--z-fab', zIndex.fab],
    ['--z-sticky', zIndex.sticky],
    ['--z-fixed', zIndex.fixed],
    ['--z-overlay', zIndex.overlay],
    ['--z-modal-backdrop', zIndex.modalBackdrop],
    ['--z-modal', zIndex.modal],
    ['--z-popover', zIndex.popover],
    ['--z-tooltip', zIndex.tooltip],
    ['--z-toast', zIndex.toast],
    ['--z-cmdk', zIndex.cmdk],
  ])('%s matches globals.css', (cssName, token) => {
    expect(Number(inRoot(cssName))).toBe(token)
  })

  it('motion easings match', () => {
    expect(inRoot('--ease-out')).toBe(motion.easeOut)
    expect(inRoot('--ease-soft')).toBe(motion.easeSoft)
    expect(Number(inRoot('--motion-scale'))).toBe(motion.scale)
  })

  it('gradients and focus ring match', () => {
    expect(inRoot('--gradient-brand')).toBe(gradients.brand)
    expect(inRoot('--gradient-brand-hover')).toBe(gradients.brandHover)
    expect(inRoot('--gradient-success')).toBe(gradients.success)
    expect(inRoot('--focus-ring')).toBe(focusRing)
  })
})

describe('PARITY: desktop density is lifted verbatim from packages/app-shell/src/styles.css', () => {
  const desktopCss = readFileSync(
    resolve(here, '../../../../packages/app-shell/src/styles.css'),
    'utf8',
  )
  const readDesktop = (name: string): number => {
    const m = new RegExp(`${name}\\s*:\\s*(\\d+)px`).exec(desktopCss)
    if (!m) throw new Error(`${name} not found in app-shell styles.css`)
    return Number(m[1])
  }

  it('row height, sidebar widths and toolbar height match', async () => {
    const { density } = await import('../scale')
    expect(density.desktop.rowHeight).toBe(readDesktop('--row-height'))
    expect(density.desktop.sidebarWidth).toBe(readDesktop('--sidebar-width'))
    expect(density.desktop.sidebarWidthCollapsed).toBe(readDesktop('--sidebar-width-collapsed'))
    expect(density.desktop.toolbarHeight).toBe(readDesktop('--toolbar-height'))
  })
})
