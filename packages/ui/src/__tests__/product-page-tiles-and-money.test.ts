// ============================================
// The product page as the owner asked for it (17 October 2026), checked so
// the pieces cannot drift apart:
//
//   · the cards tell the money: a price to buy and a price to sell one unit,
//     then the two shelf totals — «ارزش کل خرید» and «ارزش کل فروش»
//   · under them three lines: the category, the stock WITH its unit, and
//     where it sits — «موجودی در هر انبار» as its own section is gone
//   · the four panels (ساخت و تولید، فیلدهای اختصاصی، عکس‌ها، بارکدها) are
//     square buttons that open OVER the page, not sections in its middle
//   · the movements table splits «نوع» from «جهت», searches, and exports
//     Excel and Markdown built from the same reading it renders
//   · every text exists in fa, af and en
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (p: string) => strip(readFileSync(join(ROOT, p), 'utf8'))
/** For JSX mounts: a formatter's line breaks must not hide or fake them. */
const flat = (s: string) => s.split(/\s+/).join(' ')

const DIR = 'packages/ui/src/components/ui/warehouse-detail'
const PAGE = `${DIR}/warehouse-detail-page.tsx`
const CONTAINER = `${DIR}/containers/warehouse-detail-container.tsx`
const MOVEMENTS = `${DIR}/product-movements-panel.tsx`
const JOURNEY = `${DIR}/product-journey-panel.tsx`

describe('the cards tell the money', () => {
  it('two unit prices, then what the shelf cost and what it can sell for', () => {
    const page = read(PAGE)
    expect(page).toContain("t('warehouse.totalBuyValue', 'ارزش کل خرید')")
    expect(page).toContain("t('warehouse.totalSellValue', 'ارزش کل فروش')")
    expect(page).toContain('{fmt(purchaseValue)} AFN')
    expect(page).toContain('{fmt(totalValue)} AFN')
    // The bare «۵ عدد» card is gone: the stock is a strip line WITH its unit.
    expect(page).not.toContain("label={t('warehouse.quantity'")
    // Both totals are derived in the domain layer, not by the page.
    const container = flat(read(CONTAINER))
    expect(container).toContain('purchaseValue(productData)')
    expect(container).toContain('stockValue(productData)')
  })

  it('the strip is three lines: the category, the stock with its unit, the placement', () => {
    const page = read(PAGE)
    expect(page).toContain("t('warehouse.currentStock', 'موجودی فعلی')")
    expect(page).toContain("t('warehouse.stockPosition'")
    expect(page).toContain('{stockPosition')
    // The old «ارزش کل» line moved into a card — it is not repeated here.
    expect(page).not.toContain("t('warehouse.totalValue'")
  })
})

describe('the four panels are tiles that open over the page', () => {
  it('square buttons: two on a phone, three on a tablet, four on a laptop', () => {
    const page = read(PAGE)
    expect(page).toContain('data-section-tile={tile.id}')
    expect(page).toContain('grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4')
    expect(page).toContain('aspect-square')
    for (const id of ["'manufacturing'", "'customFields'", "'images'", "'barcodes'"])
      expect(page, id).toContain(id)
    for (const key of [
      "t('manufacturing.panel.title'",
      "t('customFields.title'",
      "t('productImages.title'",
      "t('barcode.extraTitle'",
    ])
      expect(page, key).toContain(key)
    // Inside a dialog, with a screen-reader title beside the panel's own header.
    expect(page).toContain('<DialogContent')
    expect(page).toContain('<DialogTitle className="sr-only">')
    expect(page).toContain('data-section-modal')
  })

  it('the container mounts every panel in its embedded shape', () => {
    const container = flat(read(CONTAINER))
    expect(container).toContain(
      "<ProductManufacturingPanel t={safeT} locale={locale} productId={id} productName={product?.name ?? ''} embedded />",
    )
    expect(container).toContain(
      "<ProductImagesPanel t={safeT} productId={id} productName={product?.name ?? ''} embedded />",
    )
    expect(container).toContain('<ProductBarcodesPanel t={safeT} productId={id} embedded />')
    // A dialog must show its data: the custom fields open showing, not behind
    // a «نمایش» click.
    expect(container).toContain(
      '<CustomFieldsPanel entity="product" entityId={id} embedded defaultOpen />',
    )
  })

  it('embedded drops the card chrome, and the custom fields start open', () => {
    expect(read(`${DIR}/product-images-panel.tsx`)).toContain('embedded = false')
    expect(read(`${DIR}/product-barcodes-panel.tsx`)).toContain('embedded = false')
    expect(
      read('packages/ui/src/components/ui/manufacturing/product-manufacturing-panel.tsx'),
    ).toContain('embedded = false')
    const customFields = read('packages/ui/src/components/ui/custom-fields-panel.tsx')
    expect(customFields).toContain('const [open, setOpen] = useState(defaultOpen)')
  })

  it('notes and expiry stay on the page itself, below the tiles', () => {
    const page = read(PAGE)
    expect(page.indexOf('{notes}')).toBeGreaterThan(page.indexOf('data-product-tiles'))
    expect(page.indexOf('{expiry}')).toBeGreaterThan(page.indexOf('{notes}'))
  })
})

describe('the movements table', () => {
  const panel = read(MOVEMENTS)

  it('«نوع» and «جهت» are two columns — the type is not a direction', () => {
    expect(panel).toContain("t('warehouse.direction', 'جهت')")
    expect(panel).toContain("t('common.type', 'نوع')")
    expect(panel).toContain("id: 'direction',")
    expect(panel).toContain("id: 'type',")
  })

  it('searches what is on screen, and «nothing matched» is not «never moved»', () => {
    expect(panel).toContain('matchesSearch(search, [')
    expect(panel).toContain('searchValue={search}')
    expect(panel).toContain('onSearchChange={setSearch}')
    expect(panel).toContain("t('warehouse.movementsNoMatch'")
    expect(panel).toContain("t('warehouse.noMovements'")
  })

  it('exports Excel and Markdown of the WHOLE history, warning included', () => {
    expect(panel).toContain('exportToXlsx(')
    expect(panel).toContain('exportToMarkdown(')
    expect(panel).toContain('movementExportRecords(table)')
    expect(panel).toContain('movementExportFilename(productName, new Date())')
    // A search narrows the screen; the file stays the whole history.
    expect(panel).toContain('movementExportTable(rows,')
    expect(panel).not.toContain('movementExportTable(shown')
    expect(panel).toContain('rows={shown}')
    // A history that does not add up is warned about IN the file too.
    expect(panel).toContain("t('warehouse.exportNote'")
    expect(panel).toContain('{ [note]: gapText }')
  })
})

describe('the money journey', () => {
  it('opens showing, inside the movements card, with no frame of its own', () => {
    const journey = read(JOURNEY)
    expect(journey).toContain('useState(true)')
    expect(journey).toContain('rounded-xl bg-[hsl(var(--surface-muted))]')
    // The journey is not a page section any more.
    expect(read(PAGE)).not.toContain('{journey}')
  })
})
