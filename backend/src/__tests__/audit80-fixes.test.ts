// ============================================
// Guards for the confirmed findings of docs/audit/AUDIT-80-*.md (7 Nov 2026).
// The full verdict list is docs/audit/AUDIT-80-VERIFICATION.md.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const read = (rel: string) =>
  readFileSync(join(SRC, rel), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')

describe('AUDIT-80 #14 — /api/debug is for platform admins only', () => {
  const source = read('routes/debug.routes.ts')

  it('declares the admin guard', () => {
    expect(source).toContain('platformAdminGuard')
    expect(source).toContain('const adminOnly = { preHandler: [authenticate, platformAdminGuard] }')
  })

  it('every debug route carries it', () => {
    const routes = [...source.matchAll(/fastify\.get\(\s*'([^']+)'\s*,\s*(\w+)/g)]
    expect(routes.map((r) => r[1])).toEqual([
      '/api/debug/routes',
      '/api/debug/check/:path',
      '/api/debug/info',
    ])
    for (const route of routes) expect(route[2]).toBe('adminOnly')
  })
})

describe('AUDIT-80 #160 — workflow cache clears stay inside the workspace', () => {
  const source = read('routes/workflow.routes.ts')

  it('no cross-workspace or never-matching workflow pattern', () => {
    expect(source).not.toContain("clearCache('workflows:*')")
    expect(source).not.toContain("clearCache('workflow-instances:*')")
    expect(source).not.toMatch(/clearCache\(`workflow-instance:\$\{id\}`\)/)
  })

  it('every workflow clear names the workspace', () => {
    const clears = [...source.matchAll(/clearCache\(([^)]*)\)/g)].map((m) => m[1]!)
    const workflowClears = clears.filter((arg) => /workflow/.test(arg))
    expect(workflowClears.length).toBeGreaterThan(0)
    for (const arg of workflowClears) expect(arg).toMatch(/workspaceId/)
  })
})
