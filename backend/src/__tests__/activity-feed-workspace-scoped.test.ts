// The personal activity feed is scoped to the WORKSPACE, not only the actor
// (27 Sep 2026, CLAUDE.md rule 1). It filtered by `actor_id` alone: a user in
// two businesses saw both in one feed, and someone removed from a workspace kept
// reading its invoice numbers, amounts and customer names through their own past
// actions. Every statement that narrows by actor must also narrow by workspace.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Whole comment LINES go, newline included, so a stripped comment never leaves
// the blank line that ends a statement in statementsOnActivities().
const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*\r?\n/gm, '')
    .replace(/\r\n/g, '\n')
const service = strip(
  readFileSync(join(__dirname, '..', 'services', 'activity.service.ts'), 'utf8'),
)
const routes = strip(readFileSync(join(__dirname, '..', 'routes', 'activity.routes.ts'), 'utf8'))

/** Each supabase statement on `activities`, from `.from('activities')` to the next blank line / await end. */
function statementsOnActivities(src: string): string[] {
  const out: string[] = []
  let at = src.indexOf(".from('activities')")
  while (at >= 0) {
    const end = src.indexOf('\n\n', at)
    out.push(src.slice(at, end < 0 ? undefined : end))
    at = src.indexOf(".from('activities')", at + 1)
  }
  return out
}

describe('activity feed — workspace boundary', () => {
  it('every statement that filters by actor also filters by workspace', () => {
    const byActor = statementsOnActivities(service).filter((s) => s.includes(".eq('actor_id'"))
    expect(byActor.length).toBeGreaterThanOrEqual(6)
    for (const s of byActor) expect(s, s.slice(0, 160)).toContain(".eq('workspace_id'")
  })

  it('no personal route runs without a resolved workspace', () => {
    for (const path of [
      "'/api/v1/activities'",
      "'/api/v1/activities/counts'",
      "'/api/v1/activities/unread-count'",
      "'/api/v1/activities/mark-read'",
      "'/api/v1/activities/mark-all-read'",
      "'/api/v1/activities/:id'",
    ]) {
      const at = routes.indexOf(path)
      expect(at, path).toBeGreaterThan(-1)
      const block = routes.slice(at, routes.indexOf('async (request', at))
      expect(block, path).toContain('requireWorkspaceContext')
    }
  })

  it('the route cache is keyed by user AND workspace — switching books never serves the other one', () => {
    expect(routes).not.toContain("scope: 'user'")
    expect(routes.match(/scope: 'member'/g)?.length).toBe(3)
  })
})
