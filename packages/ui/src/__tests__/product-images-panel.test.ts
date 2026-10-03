// ============================================
// Product images (28 Sep → 3 Oct 2026).
//
// The panel, its hooks, the routes and the migration were committed with NO
// CALLER: nothing mounted `ProductImagesPanel`, and its texts were in no
// language bundle — the «rule exists and nobody calls it» pattern (CLAUDE.md
// §7.1). A product could have images in the database and no screen to add
// one. This keeps the three ends tied together:
//
//   - the product page mounts the panel;
//   - every text the panel reads exists in fa, af and en (t() throws);
//   - the lists carry the cover from the server to the name cell.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (...rel: string[]) => strip(readFileSync(join(SRC, ...rel), 'utf8'))

const panel = read('components', 'ui', 'warehouse-detail', 'product-images-panel.tsx')

describe('the product page shows the gallery', () => {
  it('the container mounts ProductImagesPanel for the open product', () => {
    const container = read(
      'components',
      'ui',
      'warehouse-detail',
      'containers',
      'warehouse-detail-container.tsx',
    )
    expect(container).toContain("import { ProductImagesPanel } from '../product-images-panel'")
    expect(container).toContain('<ProductImagesPanel t={safeT} productId={id}')
  })

  it('the page renders the slot it is given', () => {
    const page = read('components', 'ui', 'warehouse-detail', 'warehouse-detail-page.tsx')
    expect(page).toContain('images?: React.ReactNode')
    expect(page).toContain('{images}')
  })
})

describe('the panel says what happened', () => {
  it('not set up, failed and empty are three different answers (§7.3, §7.6)', () => {
    expect(panel).toContain("t('productImages.notConfigured')")
    expect(panel).toContain("t('productImages.loadFailed')")
    expect(panel).toContain("t('productImages.empty')")
  })

  it('the limit is the one the server enforces, not a second copy', () => {
    expect(panel).toContain('PRODUCT_IMAGE_LIMIT')
    expect(panel).not.toMatch(/rows\.length\s*>=\s*8/)
  })
})

describe('lists carry the cover', () => {
  it('the product list maps image_url and the name cell draws it', () => {
    expect(read('lib', 'warehouse', 'warehouse-mappers.ts')).toContain(
      'imageUrl: p.image_url || null',
    )
    const list = read('components', 'ui', 'warehouse', 'warehouse-product-list.tsx')
    expect(list).toContain('product.imageUrl ?')
    // Fixed size and lazy: a thumbnail must not shift the row or block paint.
    expect(list).toContain('loading="lazy"')
    expect(list).toContain('width={32}')
  })

  it("a warehouse's own product list passes the cover through too", () => {
    expect(
      read('components', 'ui', 'warehouse', 'containers', 'Warehouse-container.tsx'),
    ).toContain('imageUrl: product.imageUrl ?? null')
  })
})

describe('the Windows app can load the images', () => {
  // The packaged desktop app sets its own Content-Security-Policy. With
  // img-src limited to 'self' data: blob:, every product image, app icon and
  // screenshot (all https, in public storage) was blocked there — while web
  // and mobile showed them.
  it('the Electron CSP allows https images and still only its own scripts', () => {
    const main = readFileSync(
      join(SRC, '..', '..', '..', 'apps', 'desktop', 'electron', 'main', 'index.ts'),
      'utf8',
    )
    expect(main).toContain("img-src 'self' data: blob: https:; ")
    expect(main).toContain("script-src 'self'; ")
  })
})

describe('every text exists in all three languages', () => {
  const keys = new Set<string>()
  for (const m of panel.matchAll(/t\(\s*'(productImages\.[a-zA-Z0-9_.]+)'/g)) keys.add(m[1]!)
  for (const m of panel.matchAll(/'(PRODUCT_IMAGE[A-Z_]*)'/g))
    keys.add(`productImages.errors.${m[1]}`)
  keys.add('common.retry')

  it('found the keys', () => {
    expect(keys.size).toBeGreaterThan(15)
  })

  it.each(['fa', 'af', 'en'])('%s', (lang) => {
    const bundle = JSON.parse(
      readFileSync(join(SRC, '..', '..', 'i18n', 'messages', lang, 'common.json'), 'utf8'),
    ) as Record<string, unknown>
    const missing = [...keys].filter((key) => {
      const value = key
        .split('.')
        .reduce<unknown>(
          (node, part) =>
            node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
          bundle,
        )
      return typeof value !== 'string'
    })
    expect(missing).toEqual([])
  })
})
