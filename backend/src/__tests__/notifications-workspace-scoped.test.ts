// Audit F-04 (8 Nov 2026): notifications were read and marked by `user_id`
// alone. A member removed from a business kept reading its notifications —
// titles, bodies, amounts — from any other workspace. Every read and write now
// runs inside the requester's active workspace (plus account-level rows with
// no workspace), and every route resolves that workspace first.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*\r?\n/gm, '')
    .replace(/\r\n/g, '\n')
const service = strip(
  readFileSync(join(__dirname, '..', 'services', 'notification.service.ts'), 'utf8'),
)
const routes = strip(
  readFileSync(join(__dirname, '..', 'routes', 'notification.routes.ts'), 'utf8'),
)

describe('notifications — workspace boundary', () => {
  it('the workspace filter is this workspace or none', () => {
    expect(service).toContain('`workspace_id.eq.${scope.workspaceId},workspace_id.is.null`')
  })

  it('every read or write of notifications other than create names the person AND the workspace', () => {
    const methods = ['list', 'markAsRead', 'markAllAsRead', 'getUnreadCount']
    for (const m of methods) {
      const start = service.indexOf(`async ${m}(`)
      expect(start, m).toBeGreaterThan(0)
      const end = service.indexOf('\n  async ', start + 1)
      const body = service.slice(start, end < 0 ? undefined : end)
      expect(body, m).toContain(".eq('user_id', scope.userId)")
      expect(body, m).toContain('.or(inWorkspace(scope))')
      expect(body, m).toMatch(/async \w+\(scope: NotificationScope/)
    }
  })

  it('no method takes a bare user id any more', () => {
    expect(service).not.toMatch(/async (list|markAsRead|markAllAsRead|getUnreadCount)\(userId/)
  })

  it('every notification route resolves the workspace, and no read is cached per user', () => {
    const preHandlers = routes.match(/preHandler: \[[^\]]*\]/g) ?? []
    expect(preHandlers.length).toBe(5)
    for (const p of preHandlers) expect(p).toContain('requireWorkspaceContext')
    expect(routes).not.toContain("scope: 'user'")
    expect(routes).not.toMatch(/notificationService\.\w+\(request\.userId/)
  })

  it('a 500 never echoes the internal error text', () => {
    expect(routes).not.toMatch(/code\(500\)\.send\(\{\s*error: err\.message/)
  })
})
