// ONE icon, everywhere (owner, 24 Oct 2026): apps/mobile/assets/icon.png.
// Windows had a different, wide artwork; the site's favicon.svg / logo-icon.svg
// still carried it. Every copy of the full-size icon must be that file, and the
// small ones are derived from it by `scripts` — not drawn again.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = join(__dirname, '..', '..', '..', '..')
const md5 = (file: string) =>
  createHash('md5')
    .update(readFileSync(join(repo, file)))
    .digest('hex')
const ICON = 'apps/mobile/assets/icon.png'

describe('the Hisabche icon is one file', () => {
  it.each([
    'apps/mobile/assets/adaptive-icon.png',
    'apps/mobile/assets/splash-icon.png',
    'apps/web/public/android-chrome-512x512.png',
    'apps/desktop/resources/icon.png',
  ])('%s is the icon', (file) => {
    expect(md5(file)).toBe(md5(ICON))
  })

  it('the Windows installer icon is a real multi-size .ico', () => {
    const ico = readFileSync(join(repo, 'apps/desktop/resources/icon.ico'))
    expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1])
    expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(6)
  })

  it('the build points at that .ico', () => {
    const builder = readFileSync(join(repo, 'apps/desktop/electron-builder.yml'), 'utf8')
    expect(builder).toContain('icon: resources/icon.ico')
  })

  it('the site SVGs no longer carry the old artwork (they were 1–2 MB)', () => {
    for (const file of ['apps/web/public/favicon.svg', 'apps/web/public/logo-icon.svg']) {
      expect(existsSync(join(repo, file))).toBe(true)
      expect(readFileSync(join(repo, file)).length).toBeLessThan(100_000)
    }
  })
})
