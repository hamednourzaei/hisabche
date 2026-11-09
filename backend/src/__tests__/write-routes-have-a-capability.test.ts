// ============================================
// backend/src/__tests__/write-routes-have-a-capability.test.ts
//
// Every route that CHANGES something inside a workspace names the capability it needs, or is in a closed ledger
// that says why not.
//
// `requireWorkspaceContext` answers «which books» — membership, any role. `requireCapability` answers «may this
// person do this». A write route with only the first lets a read-only member change the books by calling the API
// directly; hiding the button is not a control. The server is the final authority, so the route is where it is stated.
//
// ⚠️ THE LEDGER ONLY SHRINKS.
//   · a NEW write route without a capability fails (add the capability, or — with a reason — a ledger line)
//   · a ledger line whose route now HAS a capability fails too: delete the line
//   · NEEDS_OWNER_DECISION are routes where NO capability exists for what they do (projects, campaigns, shifts…).
//     Choosing the capability name and its lowest role is permission policy, so it is not guessed here; the routes
//     are listed so the gap is counted, not forgotten. The count is asserted so it can only go down.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'
import { readRoutes } from './helpers/route-source'

type Why =
  /** acts only on the caller's own per-person state (read marks, saved views, personal visibility) */
  | 'OWN_STATE'
  /** any member may use it by design; metered or harmless (AI asks within quota, reporting an app) */
  | 'MEMBER_USE'
  /** the service behind the route decides; the guard here cannot see it — reviewed by family, not per route */
  | 'SERVICE_DECIDES'
  /** the handler itself calls requireRole(...) or holds(...) before it writes — proven below, per route */
  | 'CHECKED_IN_HANDLER'
  /** no capability exists for this action yet — a permission-policy decision for the owner */
  | 'NEEDS_OWNER_DECISION'

const LEDGER: Readonly<Record<string, Why>> = {
  'activity.routes.ts PATCH /api/v1/activities/mark-read': 'OWN_STATE',
  'activity.routes.ts PATCH /api/v1/activities/mark-all-read': 'OWN_STATE',
  'activity.routes.ts DELETE /api/v1/activities/:id': 'OWN_STATE',
  // Not new exemptions: these routes were OUTSIDE any workspace until 8 Nov 2026
  // (audit F-04) and so outside this guard. Marking one's own notifications read
  // is the same kind of write as the two activity lines above.
  'notification.routes.ts PATCH /api/v1/notifications/mark-read': 'OWN_STATE',
  'notification.routes.ts PATCH /api/v1/notifications/mark-all-read': 'OWN_STATE',
  'permission.routes.ts POST /api/permissions/check': 'OWN_STATE',
  'personalization.routes.ts PATCH /visibility': 'OWN_STATE',
  'personalization.routes.ts POST /visibility/reset': 'OWN_STATE',
  'saved-views.routes.ts POST /api/saved-views': 'OWN_STATE',
  'saved-views.routes.ts PATCH /api/saved-views/:id': 'OWN_STATE',
  'saved-views.routes.ts DELETE /api/saved-views/:id': 'OWN_STATE',
  // 9 Nov 2026: the cards a person added to their own dashboard (keyed by userId).
  'dashboard-kpis.routes.ts PUT /api/me/dashboard-kpis': 'OWN_STATE',
  'ai-chat.routes.ts POST /api/ai/ask': 'MEMBER_USE',
  'ai.routes.ts POST /api/ai/query': 'MEMBER_USE',
  'marketplace.routes.ts POST /api/marketplace/apps/:app/report': 'MEMBER_USE',
  'translate.routes.ts POST /api/ai/translate': 'MEMBER_USE',
  'ai-pipeline.routes.ts PUT /api/ai/pipeline/settings': 'SERVICE_DECIDES',
  'ai-pipeline.routes.ts POST /api/ai/pipeline/runs': 'SERVICE_DECIDES',
  'ai-pipeline.routes.ts POST /api/ai/pipeline/runs/:id/answers': 'SERVICE_DECIDES',
  'ai-pipeline.routes.ts POST /api/ai/pipeline/runs/:id/cancel': 'SERVICE_DECIDES',
  'attendance-link.routes.ts PUT /api/workplace/time-zone': 'SERVICE_DECIDES',
  'attendance-link.routes.ts PUT /api/workplace/branches/:id/time-zone': 'SERVICE_DECIDES',
  'attendance-link.routes.ts POST /api/attendance-links': 'SERVICE_DECIDES',
  'attendance-link.routes.ts DELETE /api/attendance-links/:id': 'SERVICE_DECIDES',
  'attendance-link.routes.ts DELETE /api/attendance-links/phone/:id': 'SERVICE_DECIDES',
  'attendance-link.routes.ts POST /api/attendance-submissions/:id/decision': 'SERVICE_DECIDES',
  'crm.routes.ts POST /api/interactions': 'SERVICE_DECIDES',
  'crm.routes.ts PATCH /api/interactions/:id/status': 'SERVICE_DECIDES',
  'crm.routes.ts PATCH /api/interactions/:id/customer-outcome': 'SERVICE_DECIDES',
  'crm.routes.ts POST /api/opportunities': 'SERVICE_DECIDES',
  'crm.routes.ts PATCH /api/opportunities/:id': 'SERVICE_DECIDES',
  'mcp.routes.ts POST /api/ai-requests/:id/reject': 'SERVICE_DECIDES',
  'mcp.routes.ts POST /api/ai-requests/:id/approve': 'SERVICE_DECIDES',
  'sync.routes.ts POST /api/sync/push': 'SERVICE_DECIDES',
  'sync.routes.ts POST /api/sync/lease': 'SERVICE_DECIDES',
  'sync.routes.ts DELETE /api/sync/lease': 'SERVICE_DECIDES',
  'workflow.routes.ts POST /api/v1/workflows/instances': 'SERVICE_DECIDES',
  'workflow.routes.ts POST /api/v1/workflows/instances/:id/action': 'SERVICE_DECIDES',
  'attendance-device.routes.ts POST /api/attendance-devices': 'CHECKED_IN_HANDLER',
  'attendance-device.routes.ts POST /api/attendance-devices/:id/key': 'CHECKED_IN_HANDLER',
  'attendance-device.routes.ts DELETE /api/attendance-devices/:id': 'CHECKED_IN_HANDLER',
  'attendance-device.routes.ts POST /api/attendance-devices/held/accept': 'CHECKED_IN_HANDLER',
  'attendance-device.routes.ts PUT /api/attendance-devices/:id/identities': 'CHECKED_IN_HANDLER',
  'attendance.routes.ts PUT /api/attendance-sheet': 'CHECKED_IN_HANDLER',
  'attendance.routes.ts POST /api/shifts': 'CHECKED_IN_HANDLER',
  'attendance.routes.ts PATCH /api/shifts/:id/active': 'CHECKED_IN_HANDLER',
  'attendance.routes.ts POST /api/shift-assignments': 'CHECKED_IN_HANDLER',
  'attendance.routes.ts POST /api/shift-assignments/:id/cancel': 'CHECKED_IN_HANDLER',
  'campaigns.routes.ts POST /api/campaigns': 'CHECKED_IN_HANDLER',
  'campaigns.routes.ts POST /api/campaigns/:id/launch': 'CHECKED_IN_HANDLER',
  'campaigns.routes.ts POST /api/campaigns/:id/cancel': 'CHECKED_IN_HANDLER',
  'custom-fields.routes.ts PATCH /api/custom-fields/definitions/:id/active': 'CHECKED_IN_HANDLER',
  'custom-fields.routes.ts POST /api/custom-fields/:entity': 'CHECKED_IN_HANDLER',
  'custom-fields.routes.ts PUT /api/custom-fields/:entity/:entityId/values': 'CHECKED_IN_HANDLER',
  'escalation.routes.ts PUT /api/v1/workflows/:id/escalation': 'CHECKED_IN_HANDLER',
  'notes.routes.ts POST /api/notes': 'SERVICE_DECIDES',
  'project.routes.ts POST /api/projects': 'CHECKED_IN_HANDLER',
  'project.routes.ts PATCH /api/projects/:id': 'CHECKED_IN_HANDLER',
  'project.routes.ts DELETE /api/projects/:id': 'CHECKED_IN_HANDLER',
  'project.routes.ts POST /api/projects/:projectId/tasks': 'MEMBER_USE',
  'project.routes.ts PATCH /api/tasks/:id': 'MEMBER_USE',
  'project.routes.ts DELETE /api/tasks/:id': 'MEMBER_USE',
  'project.routes.ts POST /api/projects/:projectId/members': 'CHECKED_IN_HANDLER',
  'project.routes.ts DELETE /api/projects/:projectId/members/:memberId': 'CHECKED_IN_HANDLER',
  'project.routes.ts POST /api/projects/:projectId/time-entries': 'MEMBER_USE',
  'project.routes.ts PATCH /api/time-entries/:id': 'MEMBER_USE',
  'project.routes.ts DELETE /api/time-entries/:id': 'MEMBER_USE',
  'snapshots.routes.ts POST /api/snapshots': 'CHECKED_IN_HANDLER',
}

const NEEDS_OWNER_DECISION_NOW = 0

const writesWithoutCapability = () =>
  readRoutes()
    .filter((route) => route.method !== 'GET')
    .filter((route) => route.guards.includes('requireWorkspaceContext'))
    .filter((route) => !route.guards.includes('requireCapability'))
    .map((route) => `${route.file} ${route.method} ${route.path}`)

describe('write routes and the capability they need', () => {
  it('finds the route table', () => {
    expect(readRoutes().filter((route) => route.method !== 'GET').length).toBeGreaterThan(300)
  })

  it('every write route inside a workspace names a capability, or is in the ledger', () => {
    const unlisted = writesWithoutCapability().filter((key) => !(key in LEDGER))
    expect(unlisted, 'these change workspace data for ANY member, whatever their role').toEqual([])
  })

  it('every ledger line is still true (a route that gained a capability leaves the ledger)', () => {
    const open = new Set(writesWithoutCapability())
    const stale = Object.keys(LEDGER).filter((key) => !open.has(key))
    expect(stale, 'these now have a capability (or no longer exist): delete the line').toEqual([])
  })

  it('the routes waiting for an owner decision can only be fewer, never more', () => {
    const waiting = Object.values(LEDGER).filter((why) => why === 'NEEDS_OWNER_DECISION').length
    expect(waiting).toBeLessThanOrEqual(NEEDS_OWNER_DECISION_NOW)
  })

  it('every CHECKED_IN_HANDLER route really calls requireRole or holds before it writes', () => {
    const missing: string[] = []
    for (const [key, why] of Object.entries(LEDGER)) {
      if (why !== 'CHECKED_IN_HANDLER') continue
      const [file, method, path] = key.split(' ') as [string, string, string]
      const text = readFileSync(join(__dirname, '..', 'routes', file), 'utf8')
      const starts = [
        ...text.matchAll(/fastify\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g),
      ]
      const at = starts.findIndex(
        (match) => match[1]!.toUpperCase() === method && match[2] === path,
      )
      if (at < 0) {
        missing.push(`${key} (route not found)`)
        continue
      }
      const end = at + 1 < starts.length ? starts[at + 1]!.index : text.length
      const body = text.slice(starts[at]!.index, end)
      if (!/requireRole\(|holds\(/.test(body)) missing.push(key)
    }
    expect(missing, 'the ledger says the handler checks; the handler does not').toEqual([])
  })

  it('every project write method stays inside the workspace of the caller', () => {
    const source = readFileSync(join(__dirname, '..', 'services', 'project.service.ts'), 'utf8')
    const methods = [
      'updateProject',
      'deleteProject',
      'createTask',
      'updateTask',
      'deleteTask',
      'addMember',
      'removeMember',
      'createTimeEntry',
      'updateTimeEntry',
      'deleteTimeEntry',
    ]
    const open: string[] = []
    for (const name of methods) {
      const start = source.indexOf(`async ${name}(`)
      expect(start, name).toBeGreaterThan(0)
      const next = source.indexOf('\n  async ', start + 10)
      const body = source.slice(start, next < 0 ? source.length : next)
      if (!/workspace_id|assertProjectOwned/.test(body)) open.push(name)
    }
    expect(open, 'a project write that never names the workspace').toEqual([])
  })

  it('the money and stock families carry no exemption at all', () => {
    const money =
      /(invoice|payment|account|inventory|warehouse|product|customer|purchas|budget|payroll|ledger|stock|till|pos)/
    const exempt = Object.keys(LEDGER).filter((key) => money.test(key.split(' ')[0]!))
    expect(exempt, 'a money or stock route must name its capability').toEqual([])
  })
})
