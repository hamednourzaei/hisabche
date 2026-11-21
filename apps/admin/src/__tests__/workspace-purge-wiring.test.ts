// ============================================
// apps/admin/src/__tests__/workspace-purge-wiring.test.ts
//
// «حذف کامل اشتراک و دیتابیسشون» is irreversible, so every layer must agree:
//   1. the route needs the purge permission AND a fresh step-up;
//   2. the service calls the one Postgres function and writes an audit event;
//   3. the typed business name reaches the server, not only the browser;
//   4. the dialog refuses a mismatched name before it calls anything;
//   5. every string the screen reads exists in fa, af and en.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../../../..')
const read = (relative: string) => readFileSync(join(ROOT, relative), 'utf-8')
/** Comments describe the bug; only code is asserted on. */
const code = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')

describe('workspace purge wiring', () => {
  const route = code(read('backend/src/routes/admin-customers.routes.ts'))
  const service = code(read('backend/src/services/admin/admin-customers.service.ts'))
  const hook = code(read('apps/admin/hooks/use-admin-customers.ts'))
  const row = code(read('apps/admin/components/workspaces/workspace-row.tsx'))
  const dialog = code(read('apps/admin/components/admin-shell/step-up-dialog.tsx'))

  it('the DELETE route is guarded by permission and step-up and passes the typed name', () => {
    expect(route).toContain("fastify.delete( '/api/admin/workspaces/:id'")
    expect(route).toContain("requireAdminPermission('customers.workspaces.purge')")
    expect(route).toContain('requireAdminStepUp')
    expect(route).toContain('purgeWorkspaceBody.parse')
    expect(route).toContain('AdminCustomersService.purgeWorkspace')
  })

  it('the service runs one function and audits outside the deleted business', () => {
    expect(service).toContain("supabase.rpc('purge_workspace'")
    expect(service).toContain('p_confirm_name: params.confirmName')
    expect(service).toContain("eventType: 'WORKSPACE_PURGED'")
  })

  it('the hook sends the name in the body with the step-up header', () => {
    expect(hook).toContain('apiClient.delete(`/admin/workspaces/${input.workspaceId}`')
    expect(hook).toContain("'X-Admin-Step-Up-Timestamp'")
    expect(hook).toContain('data: { confirmName: input.confirmName, reason: input.reason }')
  })

  it('the row opens the dialog with the exact business name', () => {
    expect(row).toContain('usePurgeWorkspace')
    expect(row).toContain('confirmName={workspace.name}')
    expect(row).toContain('admin.workspaces.purgeTypeName')
    expect(row).toContain('admin.workspaces.purgeAction')
    expect(row).toContain('<StepUpDialog')
  })

  it('the dialog refuses a mismatched name and forwards the typed value', () => {
    expect(dialog).toContain('confirmName !== undefined && typedName.trim() !== confirmName')
    expect(dialog).toContain('admin.security.confirmNameMismatch')
    expect(dialog).toContain(
      'confirmName: confirmName !== undefined ? typedName.trim() : undefined',
    )
  })

  it('every screen string exists in fa, af and en', () => {
    const keys = [
      'admin.workspaces.purgeAction',
      'admin.workspaces.purgeTitle',
      'admin.workspaces.purgeDesc',
      'admin.workspaces.purgeTypeName',
      'admin.workspaces.purgeFailed',
      'admin.security.confirmNamePrompt',
      'admin.security.confirmNameMismatch',
    ]
    for (const locale of ['fa', 'af', 'en'] as const) {
      const bundle = JSON.parse(
        readFileSync(join(ROOT, `packages/i18n/messages/${locale}/common.json`), 'utf8'),
      ) as Record<string, unknown>
      for (const key of keys) {
        let node: unknown = bundle
        for (const part of key.split('.')) {
          node =
            typeof node === 'object' && node !== null
              ? (node as Record<string, unknown>)[part]
              : undefined
        }
        expect(typeof node, `${locale}:${key}`).toBe('string')
      }
    }
  })
})
