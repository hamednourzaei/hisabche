// ============================================
// A product whose stock runs out must stay visible.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT THE OWNER SAW
//
// «kartoon» was oversold to -98. Its own page
// (`/warehouse/846534ae-…`) still worked, but the warehouse LIST no longer
// showed it at all — so it looked deleted.
//
// The cause was one line in `backend/src/routes/product.routes.ts`:
//
//     lowStock: query.lowStock === 'true'
//
// An ABSENT parameter became `false`, and the service reads `false` as «only
// products ABOVE their minimum». Every plain list request therefore hid every
// low, empty and negative product — exactly the items that needed attention.
//
// Three follow-ups the owner asked for:
//   * the table spells the status out («تمام شده»), not only a red number —
//     `stockLabel` had been passed all the way to the table and never rendered
//   * an exhausted product stays in the invoice picker but cannot be picked on
//     a SALE (a purchase is how it comes back, so purchases still allow it)
//   * confirming an invoice that drives stock negative WARNS — it does not
//     block, because goods genuinely get sold before the purchase is entered
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*/g, '')
}

const ROOT = join(__dirname, '..', '..', '..', '..')
const UI = join(__dirname, '..')

const route = code(join(ROOT, 'backend', 'src', 'routes', 'product.routes.ts'))
const hook = code(join(UI, 'hooks', 'warehouse', 'use-warehouse.ts'))
const mappers = code(join(UI, 'lib', 'warehouse', 'warehouse-mappers.ts'))
const list = code(join(UI, 'components', 'ui', 'warehouse', 'warehouse-product-list.tsx'))
const picker = code(join(UI, 'components', 'ui', 'invoice-builder', 'grid', 'description-cell.tsx'))
const preview = code(
  join(UI, 'components', 'ui', 'invoice-builder', 'containers', 'invoice-preview-container.tsx'),
)

describe('the warehouse list does not hide low stock', () => {
  it('⚠️ an absent lowStock parameter is undefined, not false', () => {
    expect(route).not.toContain("lowStock: query.lowStock === 'true',")
    expect(route).toContain("query.lowStock === 'false' ? false : undefined")
  })
})

describe('a negative quantity is out of stock', () => {
  it('⚠️ status and label treat <= 0 as out, not only === 0', () => {
    // -98 was being reported as merely «low».
    expect(hook).not.toContain('qty === 0')
    // The rule now lives once in lib/warehouse/stock-state.ts (BUG-003), shared
    // with the product page; the hook must use it, and it must say <= 0.
    expect(hook).toContain('STOCK_TONE[stockStateOf(qty, min)]')
    expect(readFileSync(join(__dirname, '../lib/warehouse/stock-state.ts'), 'utf8')).toMatch(
      /if \(quantity <= 0\) return ["']out["']/,
    )
    // The client-side totals were later moved server-side, so the mapper may
    // no longer count at all — it just must never use the `=== 0` test again.
    expect(mappers).not.toContain('quantity === 0')
  })

  it('the table has a status column that renders the label', () => {
    expect(list).toContain("id: 'stockStatus'")
    expect(list).toContain('stockLabel(product.quantity, product.minStockLevel)')
  })
})

describe('the invoice picker', () => {
  it('⚠️ keeps an exhausted product visible but unpickable on a sale', () => {
    expect(picker).toContain("transactionType !== 'purchase'")
    // The figure is now the stock of the invoice's warehouse when it names one
    // (#94); with no warehouse it is still the product total.
    expect(picker).toContain("typeof stock === 'number' && stock <= 0")
    expect(picker).toContain('warehouseStock.quantityOf(product.id)')
    expect(picker).toContain('disabled={isExhausted(product)}')
    expect(picker).toContain('if (isExhausted(product)) return')
  })

  it('does not filter exhausted products out of the list', () => {
    expect(picker).not.toMatch(/products\.filter\([^)]*quantity/)
  })
})

describe('confirming an oversell', () => {
  // The check moved into use-oversold-lines.ts, shared by the form and the
  // preview (behaviour tested in invoice-oversold-warning.test.ts).
  const hook = readFileSync(
    join(ROOT, 'packages/ui/src/components/ui/invoice-builder/use-oversold-lines.ts'),
    'utf8',
  )
  const warning = readFileSync(
    join(ROOT, 'packages/ui/src/components/ui/invoice-builder/oversold-warning.tsx'),
    'utf8',
  )

  it('⚠️ warns but does not block', () => {
    expect(preview).toContain('<OversoldWarning t={t} lines={oversoldLines} />')
    expect(warning).toContain('role="alert"')
    expect(preview).not.toContain('disabled={oversoldLines')
  })

  it('sums lines for the same product', () => {
    // Two lines of 60 against a stock of 100 is an oversell neither shows alone.
    expect(hook).toContain('(current?.quantity ?? 0) + (Number(item.quantity) || 0)')
  })

  it('⚠️ does not compare across different units', () => {
    expect(hook).toContain('line.unit !== product.unit')
  })

  it('a purchase never warns', () => {
    expect(hook).toContain("if (transactionType === 'purchase') return []")
  })
})

describe('strings exist in every locale', () => {
  for (const locale of ['fa', 'af', 'en']) {
    it(locale, () => {
      const bundle = JSON.parse(
        readFileSync(join(ROOT, 'packages', 'i18n', 'messages', locale, 'common.json'), 'utf8'),
      ) as { warehouse: Record<string, string>; invoiceBuilder: Record<string, string> }
      expect(bundle.warehouse.stockStatus).toBeTruthy()
      expect(bundle.warehouse.outOfStock).toBeTruthy()
      expect(bundle.invoiceBuilder.oversoldTitle).toBeTruthy()
      expect(bundle.invoiceBuilder.oversoldHint).toBeTruthy()
    })
  }
})
