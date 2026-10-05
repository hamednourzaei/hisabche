// ============================================
// «شعبه» and «انبار» — where an invoice and a batch belong.
//
// What can go wrong: the create route dropping the warehouse the form chose
// (it did: the service never received it, so no warehouse's stock moved); the
// form never naming a branch; a branch filter that filters one page in the
// browser; a non-uuid reaching a query; a restricted member reading another
// branch through the filter; a filter drawn for a business with nothing to
// choose; the expiry figures popping in after load; the removed issue plan
// creeping back.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { expiryFigures, NO_WAREHOUSE } from '../components/ui/expiry/expiry-view'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

const route = code(read('backend', 'src', 'routes', 'invoice.routes.ts'))
const service = code(read('backend', 'src', 'services', 'invoice.service.ts'))
const schema = code(read('packages', 'validation', 'src', 'schemas', 'invoice.schema.ts'))

describe('the server', () => {
  it('forwards the warehouse the form chose — it used to be dropped', () => {
    expect(route).toContain('? { warehouseId: body.warehouseId as string }')
  })

  it('checks a branch named in the body against the member’s own branches', () => {
    expect(route).toContain(
      '? await branches.resolveActive(request.tenancy, body.branchId as string)',
    )
    expect(route).toContain('await invoiceService.create(request.tenancy, data, branchId, {')
  })

  it('filters the list by branch and by warehouse — in the query, not after it', () => {
    expect(service).toContain("if (filters.branchId) q = q.eq('branch_id', filters.branchId)")
    expect(service).toContain(
      "if (filters.warehouseId) q = q.eq('warehouse_id', filters.warehouseId)",
    )
    expect(schema).toContain('branchId: uuidSchema.optional(),')
    expect(schema).toContain('warehouseId: uuidSchema.optional(),')
  })

  it('ignores anything that is not a uuid, and refuses a branch the member does not hold', () => {
    expect(route).toContain(
      "branchId: UUID_PATTERN.test(q.branchId ?? '') ? q.branchId : undefined",
    )
    expect(route).toContain(
      "warehouseId: UUID_PATTERN.test(q.warehouseId ?? '') ? q.warehouseId : undefined",
    )
    expect(route).toContain(
      'if (filters.branchId) await branches.resolveActive(request.tenancy, filters.branchId)',
    )
    // A refusal is answered as a refusal, not as a 500.
    expect(route).toContain('if (err instanceof BaseError && err.statusCode < 500) {')
  })
})

describe('the invoice form', () => {
  const select = ui('invoice-builder', 'invoice-branch-select.tsx')
  const builder = ui('invoice-builder', 'containers', 'invoice-builder-container.tsx')
  const preview = ui('invoice-builder', 'containers', 'invoice-preview-container.tsx')

  it('offers the branch with the shared select — and nothing when there are no branches', () => {
    expect(builder).toContain('<InvoiceBranchSelect t={t} value={draft.branchId}')
    expect(select).toContain('<SelectField')
    expect(select).toContain('if (branches.length === 0) return null')
  })

  it('«کل کسب‌وکار» is a real answer and is never sent as an id', () => {
    expect(select).toContain('onChange(next === WHOLE_BUSINESS ? null : next)')
  })

  it('sends the branch with the invoice, on both submit paths', () => {
    expect(
      preview.split('...(draft.branchId ? { branchId: draft.branchId } : {}),').length - 1,
    ).toBe(2)
  })

  it('the draft remembers it', () => {
    const store = code(read('packages', 'store', 'src', 'slices', 'invoice-draft.slice.ts'))
    expect(store).toContain('branchId: string | null')
    expect(store).toContain('branchId: state.branchId,')
  })
})

describe('the invoice table', () => {
  const view = ui('invoices', 'invoices-view.tsx')
  const hook = code(read('packages', 'ui', 'src', 'hooks', 'invoices', 'use-invoices-page.ts'))

  it('has both filters in its own toolbar, drawn with the shared control', () => {
    expect(view.split('<TableFilterSelect').length - 1).toBe(3)
    expect(view).toContain('{onBranchFilterChange && branches.length > 0 ? (')
    expect(view).toContain('{onWarehouseFilterChange && warehouses.length > 0 ? (')
    // Still ONE table.
    expect(view.split('<DataTable').length - 1).toBe(1)
  })

  it('sends them to the server and goes back to page one', () => {
    expect(hook).toContain("(key: 'branchId' | 'warehouseId', value: string) =>")
    expect(hook).toContain('const next = { ...prev, page: 1 }')
    expect(hook).toContain('return { ...next, [key]: value }')
    expect(hook).toContain('delete next[key]')
  })
})

describe('the expiry screen', () => {
  const view = ui('expiry', 'expiry-view.tsx')

  it('always shows four figures — they do not pop in after the report arrives', () => {
    expect(view).toContain('<BentoStats t={t} stats={stats} />')
    expect(view).not.toContain('{report ? (\n        <StatGrid>')
    expect(view).toContain("const pending = isLoading ? '…' : '—'")
    for (const id of ['fresh', 'unhealthy', 'expiredValue', 'nearest']) {
      expect(view).toContain(`id: '${id}',`)
    }
  })

  it('computes them from the report’s groups', () => {
    const batch = (daysRemaining: number | null) => ({
      batchId: 'b',
      batchNumber: 'B',
      productId: 'p',
      quantity: 1,
      expiryDate: null,
      daysRemaining,
    })
    expect(
      expiryFigures([
        { state: 'expired', totalQuantity: 4, batches: [batch(-3)] },
        { state: 'near_expiry', totalQuantity: 6, batches: [batch(12), batch(5)] },
        { state: 'fresh', totalQuantity: 1100, batches: [batch(1814)] },
        { state: 'no_expiry', totalQuantity: 9, batches: [batch(null)] },
      ]),
    ).toEqual({ fresh: 1100, unhealthy: 10, nearestDays: 5 })
    // Nothing dated ahead: «none», not zero days.
    expect(expiryFigures([]).nearestDays).toBeNull()
  })

  it('filters by state and by warehouse in the table’s toolbar', () => {
    expect(view.split('<TableFilterSelect').length - 1).toBe(2)
    expect(view).not.toContain('<SegmentedFilter')
    expect(NO_WAREHOUSE).toBe('none')
    expect(view).toContain('? batch.warehouseId === null')
  })

  it('a row opens its product; «ویرایش» edits the date without opening it', () => {
    expect(view).toContain('onRowClick={(row) => onOpenProduct(row.productId)}')
    expect(view).toContain('event.stopPropagation()')
    expect(view).toContain('await onSaveExpiry(editing.batchId, draft || null)')
    expect(ui('expiry', 'containers', 'expiry-container.tsx')).toContain('useUpdateBatchDates()')
  })

  it('the issue plan is gone — screen, hook and words', () => {
    expect(view).not.toContain('onPlanIssue')
    expect(read('packages', 'api', 'src', 'index.ts')).not.toContain('usePlanIssue')
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      expect(words.expiry.plan_title, lang).toBeUndefined()
      for (const key of [
        'unhealthy',
        'nearest',
        'nearest_none',
        'days',
        'edit_expiry',
        'warehouse',
      ]) {
        expect(words.expiry[key], `${lang} expiry.${key}`).toEqual(expect.any(String))
      }
      for (const key of ['branch', 'warehouse', 'allBranches', 'allWarehouses']) {
        expect(words.invoices[key], `${lang} invoices.${key}`).toEqual(expect.any(String))
      }
      expect(words.invoiceBuilder.branch, lang).toEqual(expect.any(String))
      expect(words.invoiceBuilder.branchNone, lang).toEqual(expect.any(String))
    }
  })
})
