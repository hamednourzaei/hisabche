// ============================================
// The active workspace travels with every request — and the server's answers
// about workspaces agree with each other.
//
// Reported on the live site (5 Oct 2026): pressing «محیط آزمایشی» answered 403
// to every request, on every screen, with no way back.
//
// The server reads a requested workspace from `x-workspace-id`; NO client sent
// it. With one workspace the server picks it. With two it refuses («an explicit
// workspace must be selected»). A sandbox is a person's second workspace.
//
// What can go wrong again: the header dropped from the client; the header
// missing from CORS (the browser then blocks every request — BUG-006); the
// workspace list naming a workspace the authorization path refuses; a per-user
// cache serving one workspace's rows inside another; a membership created
// without `has_access`, leaning on a column default that has gone missing on a
// live database before.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. Flattened: the formatter wraps. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|--)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

describe('the request says which business', () => {
  const client = code(read('packages', 'api', 'src', 'lib', 'client.ts'))

  it('the shared client sends the active workspace on every request', () => {
    expect(client).toContain("export const WORKSPACE_HEADER = 'x-workspace-id'")
    expect(client).toContain('const workspace = getActiveWorkspaceId()')
    expect(client).toContain('config.headers[WORKSPACE_HEADER] = workspace')
  })

  it('the server reads that same header, and CORS lets the browser send it', () => {
    const middleware = code(read('backend', 'src', 'middleware', 'workspace.middleware.ts'))
    expect(middleware).toContain("request.headers['x-workspace-id']")
    const index = code(read('backend', 'src', 'index.ts'))
    const allowed = index.slice(index.indexOf('allowedHeaders: ['), index.indexOf('maxAge: 86400'))
    expect(allowed).toContain("'x-workspace-id'")
    expect(allowed).toContain("'Idempotency-Key'")
  })

  it('it is still only a request: the server checks it against the membership', () => {
    const tenancy = code(read('backend', 'src', 'services', 'tenancy.service.ts'))
    expect(tenancy).toContain(
      'const match = authorized.find((ctx) => ctx.workspaceId === requestedWorkspaceId)',
    )
  })
})

describe('the workspace list and the authorization path agree', () => {
  const service = code(read('backend', 'src', 'services', 'workspace.service.ts'))
  const list = service.slice(
    service.indexOf('async getMyWorkspaces('),
    service.indexOf('async getWorkspace('),
  )

  it('the list names only workspaces the server lets this person into', () => {
    expect(list).toContain(".eq('has_access', true)")
    expect(list).toContain(".is('suspended_at', null)")
    // Oldest first: the one the app falls back to is the same on every load.
    expect(list).toContain(".order('joined_at', { ascending: true })")
  })

  it('a failed read is thrown, never answered (and cached) as «you have none»', () => {
    expect(list).toContain("if (membersError) throw new DatabaseError('Failed to fetch workspaces'")
    expect(list.indexOf('if (membersError) throw')).toBeLessThan(
      list.indexOf('await memoryCache.set(cacheKey, [], 60)'),
    )
  })
})

describe('a per-user cache never crosses workspaces', () => {
  it('no route that resolves a workspace caches per user', () => {
    const dir = join(ROOT, 'backend', 'src', 'routes')
    const offenders: string[] = []
    for (const file of readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
      const source = code(readFileSync(join(dir, file), 'utf8'))
      // Each route's options object: from one `preHandler:` to the next.
      for (const options of source.split('preHandler:').slice(1)) {
        const own = options.slice(0, options.indexOf(']') + 1)
        if (own.includes('requireWorkspaceContext') && own.includes("scope: 'user'")) {
          offenders.push(file)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('a membership is created with has_access written', () => {
  it('in the backend', () => {
    const service = code(read('backend', 'src', 'services', 'workspace.service.ts'))
    const inserts = service
      .split("from('workspace_members')")
      .slice(1)
      .map((after) => after.trimStart())
      .filter((after) => after.startsWith('.insert('))
      .map((after) => after.slice(0, after.indexOf(')')))
    expect(inserts).toHaveLength(3)
    for (const insert of inserts) {
      // Either the flag is in the literal, or the row is the one built above it.
      expect(insert.includes('has_access') || insert === '.insert(memberRow', insert).toBe(true)
    }
    expect(service).toContain('has_access: data.hasAccess,')
  })

  it('in the sandbox function', () => {
    const migration = code(read('docs', 'developer-platform-06b-sandbox-access-migration.sql'))
    expect(migration).toContain(
      "INSERT INTO public.workspace_members (workspace_id, user_id, role, has_access) VALUES (v_id, p_user, 'owner', true)",
    )
  })
})

describe('the server tells ITSELF which business, too', () => {
  // An approved assistant action is run through the server's own router with
  // the approver's session. A session carries no workspace; an approver with a
  // second workspace was refused AFTER the approval had been recorded.
  it('an approved MCP action runs in the workspace it was approved in', () => {
    const routes = code(read('backend', 'src', 'routes', 'mcp.routes.ts'))
    // The call itself lives in one module, shared with the in-app AI pipeline.
    expect(code(read('backend', 'src', 'services', 'mcp', 'own-route.ts'))).toContain(
      "...(workspaceId ? { 'x-workspace-id': workspaceId } : {})",
    )
    const approve = routes.slice(routes.indexOf("'/api/ai-requests/:id/approve'"))
    expect(approve).toContain('request.tenancy.workspaceId, )')
  })
})

describe('a signed-in user is not a platform administrator', () => {
  // The global role table and the event log had write routes that asked only
  // for a session: any account could assign a role to any user id, write an
  // event with another workspace's ids, or purge the log.
  it.each(['permission.routes.ts', 'event.routes.ts'])(
    '%s has no write guarded by a session alone',
    (file) => {
      const source = code(read('backend', 'src', 'routes', file))
      expect(source).not.toContain('preHandler: [authenticate],')
      expect(source).toContain('preHandler: [authenticate, platformAdminGuard],')
    },
  )

  it('nobody reads another person’s roles with a session alone', () => {
    const source = code(read('backend', 'src', 'routes', 'permission.routes.ts'))
    for (const route of ["'/api/users/:userId/roles',", "'/api/users/:userId/permissions',"]) {
      const options = source.slice(source.indexOf(route), source.indexOf(route) + 160)
      expect(options, route).toContain('authenticate, platformAdminGuard,')
    }
  })
})
