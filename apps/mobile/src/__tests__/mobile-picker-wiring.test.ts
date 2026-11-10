// ============================================
// apps/mobile/src/__tests__/mobile-picker-wiring.test.ts
//
// V55 final completion — the variant and serial pickers on the PHONE.
//
// The registry used to carry `MOBILE_NO_VARIANT_PICKER`. That was stale: the
// mobile app draws ONE UI — the shared shell (`@hisabche/app-shell`, see
// one-ui-two-hosts.test.ts) — and the shell's invoice builder IS the web
// builder. So the variant picker a shop sees on Android is the same
// `RowVariantPicker` web sees, in both the grid and the mobile
// item-editor-sheet; the serial/IMEI picker is the invoice-detail panel; and
// the local engine answers the reads both need while offline:
//
//   GET /products/:x/variants      available (product.variants)
//   GET /operations/serials        available (inventory.serial_items, v21)
//   POST /operations/serials/issue available (inventory.serial_items, v21)
//
// These assertions pin the wiring so the drift the old limitation described
// cannot silently come back — and so nobody "fixes" it by building a second,
// private mobile picker.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { OFFLINE_ENDPOINT_MATRIX } from '@hisabche/validation'

const repoRoot = join(__dirname, '..', '..', '..', '..')
const read = (relPath: string): string =>
  readFileSync(join(repoRoot, relPath), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('the phone shows the shared pickers', () => {
  it("the shell's invoice builder is the shared container (one builder, two hosts)", () => {
    const page = read('packages/app-shell/src/features/sales/invoice-builder-page.tsx')
    expect(page).toContain("from '@hisabche/ui/screens'")
    expect(page).toContain('InvoiceBuilderContainer')
  })

  it("the shared builder's GRID carries the variant picker", () => {
    const grid = read('packages/ui/src/components/ui/invoice-builder/grid/invoice-items-grid.tsx')
    expect(grid).toContain('RowVariantPicker')
  })

  it("the shared builder's MOBILE editor carries the same variant picker", () => {
    const sheet = read('packages/ui/src/components/ui/invoice-builder/mobile/item-editor-sheet.tsx')
    expect(sheet).toContain("from '../row-variant-picker'")
    expect(sheet).toContain('<RowVariantPicker')
  })

  it('the invoice detail carries the serial/IMEI panel, and it claims through the shared endpoint', () => {
    const detail = read(
      'packages/ui/src/components/ui/invoice-detail/containers/invoice-detail-container.tsx',
    )
    expect(detail).toContain('InvoiceSerialsPanel')
    const panel = read('packages/ui/src/components/ui/invoice-detail/invoice-serials-panel.tsx')
    expect(panel).toContain('useAssignSerialsToSale')
    expect(panel).toContain('useSerials')
  })

  it('the reads both pickers need are answered OFFLINE by the local engine', () => {
    expect(OFFLINE_ENDPOINT_MATRIX['GET /products/:x/variants']).toEqual([
      'product.variants',
      'available',
    ])
    expect(OFFLINE_ENDPOINT_MATRIX['GET /operations/serials']).toEqual([
      'inventory.serial_items',
      'available',
    ])
    expect(OFFLINE_ENDPOINT_MATRIX['POST /operations/serials/issue']).toEqual([
      'inventory.serial_items',
      'available',
    ])
    expect(OFFLINE_ENDPOINT_MATRIX['GET /operations/batches']).toEqual([
      'inventory.batch_items',
      'available',
    ])
  })

  it('the mobile host still imports no web UI of its own (the drift guard, restated)', () => {
    const host = read('apps/mobile/src/host/shell-webview.tsx')
    expect(host).not.toContain('@hisabche/ui')
  })
})
