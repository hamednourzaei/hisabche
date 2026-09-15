// Every favicon / app icon in apps/web/public was the same 1254×1254 PNG under a
// different name (1.2 MB each; favicon.ico was a 2.2 MB PNG). PageSpeed's mobile
// run downloaded 5.9 MiB of icons on the landing page. Icons are now real sizes;
// this keeps a full-size image from being dropped in under an icon name again.
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const PUBLIC = join(__dirname, '../../../../apps/web/public')
const png = (name: string) => {
  const b = readFileSync(join(PUBLIC, name))
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), kb: b.length / 1024 }
}

describe('public icons are what their names say', () => {
  it.each([
    ['favicon-16x16.png', 16],
    ['favicon-32x32.png', 32],
    ['favicon-48x48.png', 48],
    ['favicon-64x64.png', 64],
    ['favicon-128x128.png', 128],
    ['apple-touch-icon.png', 180],
    ['android-chrome-192x192.png', 192],
    ['android-chrome-512x512.png', 512],
  ])('%s is %ipx and small', (name, size) => {
    const { w, h, kb } = png(name)
    expect([w, h]).toEqual([size, size])
    expect(kb).toBeLessThan(size <= 64 ? 8 : 120)
  })

  it('favicon.ico is a real ICO under 20 KB', () => {
    const b = readFileSync(join(PUBLIC, 'favicon.ico'))
    expect([b.readUInt16LE(0), b.readUInt16LE(2)]).toEqual([0, 1])
    expect(statSync(join(PUBLIC, 'favicon.ico')).size).toBeLessThan(20 * 1024)
  })
})

describe('icons are declared once and cached', () => {
  const root = join(__dirname, '../../../../apps/web')
  // Not comment-stripped: the layout contains '/*' inside strings, which a naive
  // block-comment regex treats as a comment start and eats real code. The
  // assertion below only matches real <link rel="icon"…> tags anyway.
  const layout = readFileSync(join(root, 'app/[lang]/layout.tsx'), 'utf8')
  const config = readFileSync(join(root, 'next.config.js'), 'utf8')

  // Pingdom HAR: every favicon was fetched twice — `metadata.icons` plus a
  // hand-written <link> for the same file.
  it('no hand-written icon/manifest <link> next to metadata.icons', () => {
    expect(layout).toContain('icons: {')
    expect(layout).not.toMatch(/<link\s+rel="(?:icon|shortcut icon|apple-touch-icon|manifest)"/)
  })

  // Root-of-public files had no Cache-Control rule and were served max-age=0.
  it('root icons, screenshots and the manifest have a Cache-Control rule', () => {
    expect(config).toContain('favicon-.*')
    expect(config).toContain('site\\.webmanifest')
    expect(config).toContain('public, max-age=86400, stale-while-revalidate=604800')
  })
})
