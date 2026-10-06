// ============================================
// Three decisions that had a route and no button (found by
// `node scripts/audit-unwired-routes.mjs`): moving stock between warehouses,
// seeing and cancelling a pending invitation, leaving a business.
//
// What can go wrong: the route losing its caller again; the transfer schema and
// the service naming the two warehouses differently (every transfer was refused
// as «same warehouse»); a transfer sent twice moving the goods twice; an
// invitation of ANOTHER business cancelled by its id; the owner leaving and the
// business belonging to nobody; a refused invitations request drawn as «no
// invitations»; `t()` on a key that does not exist taking the page down.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stockTransferSchema } from '@hisabche/validation'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. Flattened: the formatter wraps. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'aaaaaaaa-0000-4000-8000-000000000002'
const P = 'bbbbbbbb-0000-4000-8000-000000000001'

describe('moving stock between warehouses', () => {
  const service = code(read('backend', 'src', 'services', 'warehouse.service.ts'))
  const dialog = ui('warehouse', 'warehouse-dialogs.tsx')
  const container = ui('warehouse', 'containers', 'Warehouse-container.tsx')

  it('the schema and the service name the two warehouses the same way', () => {
    const parsed = stockTransferSchema.parse({
      productId: P,
      fromWarehouseId: A,
      toWarehouseId: B,
      quantity: 2,
    })
    expect(parsed).toMatchObject({ fromWarehouseId: A, toWarehouseId: B, quantity: 2 })
    for (const key of ['fromWarehouseId', 'toWarehouseId']) {
      expect(service, key).toContain(`data.${key}`)
    }
    // The old names are refused, not silently dropped into «same warehouse».
    expect(
      stockTransferSchema.safeParse({ productId: P, fromGodamId: A, toGodamId: B, quantity: 2 })
        .success,
    ).toBe(false)
  })

  it('is a stock write: membership alone is not enough', () => {
    const routes = code(read('backend', 'src', 'routes', 'warehouse.routes.ts'))
    const route = routes.slice(routes.indexOf("'/api/stock-transfers'"))
    expect(route.slice(0, 200)).toContain("requireCapability('product.write')")
  })

  it('has a caller, with one key per opening of the dialog', () => {
    const hook = code(read('packages', 'api', 'src', 'hooks', 'warehouses.ts'))
    expect(hook).toContain("apiClient.post('/stock-transfers', body, {")
    expect(hook).toContain("headers: { 'Idempotency-Key': idempotencyKey }")
    expect(dialog).toContain('setRequestKey(crypto.randomUUID())')
    expect(dialog).toContain('idempotencyKey: requestKey,')
  })

  it('the button is in an open warehouse and the target is another LIVE one', () => {
    expect(container).toContain('onTransferAction: () => setShowTransfer(true),')
    expect(container).toContain('<TransferStockDialog')
    expect(container).toContain(
      '.filter((item) => item.isActive && item.id !== detail.data?.warehouse?.id)',
    )
  })

  it('refuses more than the source holds before asking the server, and says so after', () => {
    expect(dialog).toContain('amount <= selected.quantity')
    expect(dialog).toContain("code.includes('WAREHOUSE_INSUFFICIENT_STOCK')")
  })

  it('the quantity carries its unit', () => {
    expect(dialog).toContain("{selected ? ` (${selected.unit})` : ''}")
  })
})

describe('pending invitations', () => {
  const service = code(read('backend', 'src', 'services', 'workspace.service.ts'))
  const page = ui('workspace', 'workspace-page.tsx')
  const cancel = service.slice(
    service.indexOf('async cancelInvite('),
    service.indexOf('async resendInvite('),
  )

  it('are listed and can be cancelled — both routes have a caller', () => {
    const hook = code(read('packages', 'api', 'src', 'hooks', 'workspace.ts'))
    expect(hook).toContain('apiClient.get(`/workspaces/${workspaceId}/invites`)')
    expect(hook).toContain('apiClient.delete(`/workspaces/${workspaceId}/invites/${inviteId}`)')
    expect(page).toContain('useWorkspaceInvites(workspaceId, isAdmin)')
    expect(page).toContain('onClick={() => void handleCancelInvite(invite.id)}')
  })

  it('only THIS business’s pending invitation is cancelled', () => {
    expect(cancel).toContain(".eq('workspace_id', workspaceId)")
    expect(cancel).toContain(".eq('status', 'pending')")
    expect(cancel).toContain("if (!cancelled) throw new NotFoundError('Invite')")
  })

  it('a failed or refused read is not «no invitations»', () => {
    expect(page).toContain(') : invites.isError ? (')
    expect(page.indexOf('invites.isError ? (')).toBeLessThan(
      page.indexOf('pendingInvites.length === 0 ? ('),
    )
    // Nobody but an admin asks at all.
    const hook = code(read('packages', 'api', 'src', 'hooks', 'workspace.ts'))
    expect(hook).toContain('enabled: enabled && !!workspaceId,')
  })
})

describe('leaving a business', () => {
  const service = code(read('backend', 'src', 'services', 'workspace.service.ts'))
  const page = ui('workspace', 'workspace-page.tsx')

  it('the owner cannot, and is told why instead of a 500', () => {
    expect(service).toContain(
      "if (m.role === 'owner') throw new ConflictError('WORKSPACE_OWNER_CANNOT_LEAVE')",
    )
    expect(page).toContain('{!isOwner && workspaceId ? (')
    expect(page).toContain("message.includes('WORKSPACE_OWNER_CANNOT_LEAVE')")
  })

  it('the app forgets the business it just left', () => {
    expect(page).toContain(
      "useWorkspaceStore.setState({ workspaceId: null, workspaceName: '', members: [] })",
    )
    expect(page).toContain('window.location.reload()')
  })
})

describe('every word on these three exists in all three languages', () => {
  it.each([
    ['warehouse/warehouse-dialogs.tsx', 'warehouse'],
    ['workspace/workspace-page.tsx', 'workspace'],
  ])('%s', (file, namespace) => {
    const source = ui(...file.split('/'))
    const keys = [
      ...new Set(
        [...source.matchAll(new RegExp(`[tT]\\(\\s*'${namespace}\\.(\\w+)'`, 'g'))].map(
          (m) => m[1],
        ),
      ),
    ]
    expect(keys.length).toBeGreaterThan(8)
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))[namespace]
      for (const key of keys) {
        expect(words[key as string], `${lang} ${namespace}.${key}`).toEqual(expect.any(String))
      }
    }
  })
})
