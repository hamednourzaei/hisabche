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
