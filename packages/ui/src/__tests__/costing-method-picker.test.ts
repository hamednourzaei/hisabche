// ============================================
// «بهای تمام‌شده: FIFO / میانگین موزون» in the warehouse hub (owner, 18 Oct 2026).
//
// `GET|PUT /inventory/settings` had zero callers: every business was on FIFO
// with no way to choose. The picker sits on the warehouse LIST (one setting
// for the whole business), offers the two methods, and is disabled without
// `inventory.configure`. The consumption itself is Postgres's
// (docs/inventory-avco-01-migration.sql, proven in inventory-avco-01.pg.test).
// ============================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

const picker = code('components/ui/warehouse/costing-method-picker.tsx')
const container = code('components/ui/warehouse/containers/Warehouse-container.tsx')
const hooks = readFileSync(
  resolve(__dirname, '../../../api/src/hooks/inventory-operations.ts'),
  'utf8',
)

describe('costing method picker', () => {
  it('reads and writes /inventory/settings', () => {
    expect(hooks).toContain("apiClient.get('/inventory/settings')")
    expect(hooks).toContain("apiClient.put('/inventory/settings', { costingMethod })")
  })

  it('offers FIFO and weighted average, and only a configurer can change it', () => {
    expect(picker).toContain("const CHOICES: readonly CostingMethod[] = ['fifo', 'avco']")
    expect(picker).toContain("capabilities.can('inventory.configure') === true")
    expect(picker).toContain('disabled={!canConfigure || setMethod.isPending}')
  })

  it('a change is confirmed first, and the server logs it (from → to, who)', () => {
    expect(picker).toContain('if (next !== current) setPending(next as CostingMethod)')
    expect(picker).toContain('setMethod.mutate(pending, { onSuccess: () => setPending(null) })')
    const route = readFileSync(
      resolve(__dirname, '../../../../backend/src/routes/inventory-costing.routes.ts'),
      'utf8',
    )
    expect(route).toContain("entityType: 'inventory_settings'")
    expect(route).toContain('oldData: { ...before }')
    expect(route).toContain('workspaceId: request.tenancy.workspaceId')
  })

  it('is on the warehouse list, not inside one warehouse', () => {
    expect(container).toContain('headerExtra: <CostingMethodPicker t={safeT} />')
  })

  it('has its labels in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const messages = JSON.parse(
        readFileSync(resolve(__dirname, `../../../i18n/messages/${lang}/common.json`), 'utf8'),
      ) as { warehouse: { costing: Record<string, string> } }
      for (const key of [
        'label',
        'fifo',
        'avco',
        'hint',
        'confirmTitle',
        'confirmBody',
        'confirmYes',
      ]) {
        expect(messages.warehouse.costing[key], `${lang}.${key}`).toBeTruthy()
      }
    }
  })
})
