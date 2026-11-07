// ============================================
// V54 5.5 (7 Nov 2026) — «حاضر شد» / «نیامد» is wired end to end, on every host.
//
// The booking engine is the SERVICE SESSION (UI, device engine, sync) — not the
// `appointments` table, which has no screen. These guards keep the one path:
// screen → hook → server route / device route → sync branch → offline matrix.
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OFFLINE_ENDPOINT_MATRIX } from '@hisabche/validation'

const repo = join(__dirname, '..', '..', '..', '..')
const code = (rel: string) =>
  readFileSync(join(repo, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .split(/\s+/)
    .join(' ')

describe('status move wiring', () => {
  it('the server route uses the shared planner and puts the sources in the WHERE', () => {
    expect(code('backend/src/routes/service-delivery.routes.ts')).toContain(
      "'/api/service-delivery/sessions/:id/status'",
    )
    const service = code('backend/src/services/service-delivery/service-delivery.service.ts')
    expect(service).toContain('planSessionStatusMove(')
    expect(service).toContain(".in('status', [...sessionStatusMoveSources(target)])")
  })

  it('the device route uses the same planner', () => {
    const local = code('packages/local-engine/src/routes/service-delivery.ts')
    expect(local).toContain("router.post('/service-delivery/sessions/:id/status'")
    expect(local).toContain('planSessionStatusMove(')
  })

  it('an offline move travels to the status route, not to create', () => {
    const sync = code('packages/app-shell/src/features/sync/sync-engine.ts')
    expect(sync).toContain("payload.status === 'in_progress' || payload.status === 'no_show'")
    expect(sync).toContain('/service-delivery/sessions/${sessionId}/status')
  })

  it('the offline matrix names the route as available', () => {
    expect(
      (OFFLINE_ENDPOINT_MATRIX as Record<string, readonly [string, string]>)[
        'POST /service-delivery/sessions/:x/status'
      ]?.[1],
    ).toBe('available')
  })

  it('the screen offers the two buttons through the shared hook', () => {
    const container = code(
      'packages/ui/src/components/ui/service-delivery/containers/service-delivery-container.tsx',
    )
    expect(container).toContain('useMoveServiceSessionStatus()')
    expect(container).toContain('onMoveStatus={onMoveStatus}')
    const view = code('packages/ui/src/components/ui/service-delivery/service-delivery-view.tsx')
    expect(view).toContain("onMoveStatus(row, 'in_progress')")
    expect(view).toContain("onMoveStatus(row, 'no_show')")
  })

  it.each(['fa', 'af', 'en'])('%s has the keys', (lang) => {
    const sd = JSON.parse(
      readFileSync(join(repo, 'packages/i18n/messages', lang, 'common.json'), 'utf8'),
    ).serviceDelivery
    expect(typeof sd.actions.checkIn).toBe('string')
    expect(typeof sd.actions.noShow).toBe('string')
    expect(typeof sd.moveFailed).toBe('string')
  })
})
