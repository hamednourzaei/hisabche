// ============================================
// Three things asked for on 13 October, on the warehouse and product pages:
//
//   · a product's category is the business's own word, chosen or typed, and
//     the warehouse list can be narrowed to one
//   · the product page has the table it lacked: every increase and decrease
//   · «بارکدهای دیگر» has the scan button its hint always promised
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  MAX_CATEGORY_LENGTH,
  SEEDED_CATEGORIES,
  categoryLabel,
} from '../components/ui/warehouse/category-field'
import { MOVEMENT_TYPES } from '../components/ui/warehouse-detail/product-movements-panel'

const ROOT = join(__dirname, '../../../..')
const read = (path: string) =>
  readFileSync(join(ROOT, path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')
const messages = (lang: string) =>
  JSON.parse(readFileSync(join(ROOT, 'packages/i18n/messages', lang, 'common.json'), 'utf8')) as {
    warehouse: Record<string, unknown>
  }

const t = (key: string, fallback?: string) =>
  key === 'warehouse.categories.clothing' ? 'پوشاک' : (fallback ?? key)

describe('a category is the business’s own word', () => {
  it('the six the app once fixed keep their translated names; anything else reads as typed', () => {
    expect(categoryLabel(t, 'clothing')).toBe('پوشاک')
    expect(categoryLabel(t, 'شال')).toBe('شال')
    expect(categoryLabel(t, 'دستبند طلا')).toBe('دستبند طلا')
    expect(categoryLabel(t, '  ')).toBe('')
    expect(categoryLabel(t, null)).toBe('')
  })

  it('⚠️ the schema takes any word up to sixty characters — not one of six trades', () => {
    const schema = read('packages/validation/src/schemas/common.schema.ts')
    expect(schema).toContain(
      'export const productCategorySchema = z.string().trim().min(1).max(60)',
    )
    expect(schema).not.toContain("z.enum([ 'general', 'food'")
    expect(MAX_CATEGORY_LENGTH).toBe(60)
    expect(SEEDED_CATEGORIES).toContain('general')
  })

  it('the choices are what THIS business has used — read from the server, inside the workspace', () => {
    const field = read('packages/ui/src/components/ui/warehouse/category-field.tsx')
    expect(field).toContain('const known = useProductCategories()')
    expect(field).not.toContain('<select')
    const service = read('backend/src/services/product.service.ts')
    const categories = service.slice(service.indexOf('async categories(ctx: TenancyContext)'))
    expect(categories.slice(0, 500)).toContain(".eq('workspace_id', ctx.workspaceId)")
    // Declared before /:id, or «categories» is read as a product id.
    const routes = read('backend/src/routes/product.routes.ts')
    expect(routes.indexOf("'/api/products/categories'")).toBeGreaterThan(-1)
    expect(routes.indexOf("'/api/products/categories'")).toBeLessThan(
      routes.indexOf("'/api/products/:id'"),
    )
  })

  it('it is chosen when a product is added to a warehouse, and editable on its page', () => {
    const modal = read('packages/ui/src/components/ui/warehouse/add-to-warehouse-modal.tsx')
    expect(modal).toContain("category: form.category.trim() || 'general',")
    expect(modal).toContain('<CategoryField')
    const page = read('packages/ui/src/components/ui/warehouse-detail/warehouse-detail-page.tsx')
    expect(page).toContain("onChange={(next) => handleEditChange('category', next)}")
    const container = read(
      'packages/ui/src/components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
    )
    expect(container).toContain("category: String(values.category ?? '').trim() || 'general',")
  })

  it('⚠️ the warehouse list shows it (it was always a dash) and filters by it', () => {
    const container = read(
      'packages/ui/src/components/ui/warehouse/containers/Warehouse-container.tsx',
    )
    expect(container).toContain("category: product.category ?? '',")
    expect(container).not.toContain("category: '',")
    const list = read('packages/ui/src/components/ui/warehouse/warehouse-product-list.tsx')
    expect(list).toContain('rows={shown}')
    expect(list).toContain('<TableFilterSelect')
    // A filter left over from another warehouse must not hide everything.
    expect(list).toContain(
      'const activeCategory = categories.includes(category) ? category : ALL_CATEGORIES',
    )
    // The server sends it with each product of a warehouse.
    expect(read('backend/src/services/inventory/warehouse-summary.domain.ts')).toContain(
      "category: product.category ?? '',",
    )
  })
})

describe('the product page: increases and decreases', () => {
  const panel = read('packages/ui/src/components/ui/warehouse-detail/product-movements-panel.tsx')

  it('is on the product page, under where the stock is', () => {
    expect(
      read(
        'packages/ui/src/components/ui/warehouse-detail/containers/warehouse-detail-container.tsx',
      ),
    ).toContain('<ProductMovementsPanel t={safeT} productId={id} />')
  })

  it('⚠️ adds nothing up: the balance after each row is the server’s', () => {
    expect(panel).toContain('formatNumber(movement.balance, locale, 3)')
    expect(panel).not.toContain('.reduce(')
    expect(panel).toContain('<DataTable tableId="product-movements"')
    expect(panel).not.toContain('<table')
  })

  it('says which way each one went in a word, and a failed read is not «no movements»', () => {
    expect(panel).toContain(
      "? t('warehouse.movementOut', 'کاهش') : t('warehouse.movementIn', 'افزایش')",
    )
    const failed = panel.indexOf(') : history.error || !history.data ? (')
    expect(failed).toBeGreaterThan(-1)
    expect(panel.indexOf("t('warehouse.noMovements'")).toBeGreaterThan(failed)
  })

  it('⚠️ a history that does not add up to the stored quantity is said, not hidden', () => {
    expect(panel).toContain('data-movements-gap')
    expect(panel).toContain('stored !== summed')
  })

  it.each(['fa', 'af', 'en'])('every word of it exists in %s', (lang) => {
    const warehouse = messages(lang).warehouse
    for (const key of [
      'movementsTitle',
      'movementsHint',
      'movementsFailed',
      'movementsGap',
      'movementIn',
      'movementOut',
      'categoryAdd',
      'categoryNewPlaceholder',
      'categoryFilter',
    ]) {
      expect(typeof warehouse[key], key).toBe('string')
    }
    const types = warehouse.movementType as Record<string, unknown>
    for (const type of MOVEMENT_TYPES) expect(typeof types[type], type).toBe('string')
    const categories = warehouse.categories as Record<string, unknown>
    for (const seeded of SEEDED_CATEGORIES) expect(typeof categories[seeded], seeded).toBe('string')
  })
})

describe('«بارکدهای دیگر»', () => {
  it('has the scan button: the code read is put in the field, to be added by the person', () => {
    expect(
      read('packages/ui/src/components/ui/warehouse-detail/product-barcodes-panel.tsx'),
    ).toContain('<CameraScanButton t={t} onCode={setCode} />')
  })
})
