// ============================================
// ⚠️ THE STYLESHEET WAS 200 KB AND HAD NO UTILITY CLASSES IN IT.
//
// This is the THIRD way this app has shipped without a design (after the
// missing `crossorigin` fix and the blank dev window), and the only one where
// the CSS file was present, correct and loaded. The design tokens, the fonts,
// the component classes — all there. What was missing was every single
// `flex`, `grid`, `rounded-lg` and `ms-2` the components actually use.
//
// The cause: Vite searches for `postcss.config.*` upward from its `root`, and
// the shared root is `packages/app-shell/src`. The config sat in
// `apps/desktop/`, which is not on that path. The search found nothing,
// `@tailwind utilities` was emitted verbatim as an unknown at-rule, and
// nothing anywhere reported a problem.
//
// Checking for `@tailwind` is not enough — an unprocessed directive and a
// processed one that generated nothing both leave the file without it. The
// only honest check is that the utilities the UI uses are really in there.
// ============================================

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const assets = join(__dirname, '..', '..', 'out/renderer/assets')

describe('the built stylesheet carries the utilities the UI is written in', () => {
  it('⚠️ the build exists to be checked', () => {
    // Saying so beats passing silently on a machine that has not built.
    expect(existsSync(assets)).toBe(true)
  })

  const files = existsSync(assets) ? readdirSync(assets).filter((f) => f.endsWith('.css')) : []
  const css = files.map((f) => readFileSync(join(assets, f), 'utf8')).join('\n')

  it('⚠️ exactly one stylesheet is emitted', () => {
    // A second one means the CSS was split, and `index.html` links only the
    // first — the same missing design with a different cause.
    expect(files).toHaveLength(1)
  })

  it('⚠️ no @tailwind directive survives unprocessed', () => {
    expect(css).not.toContain('@tailwind')
  })

  it.each([
    ['.flex', 'display: flex'],
    ['.items-center', 'align-items: center'],
    ['.rounded-lg', 'border-radius'],
    // A logical-property utility: RTL is not optional in this app, and these
    // come from the same generator as the rest.
    ['.ms-2', 'margin-inline-start'],
  ])('⚠️ %s is generated', (selector, declaration) => {
    const rule = new RegExp(`\\${selector}\\s*\\{[^}]*${declaration}`)
    expect(rule.test(css)).toBe(true)
  })

  it('⚠️ Tailwind preflight ran', () => {
    // Preflight is `@tailwind base`. Without it every element keeps its
    // browser defaults and the layout is wrong in ways no single class fixes.
    expect(css).toContain('box-sizing: border-box')
  })
})
