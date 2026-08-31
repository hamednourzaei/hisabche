// ============================================
// backend/src/__tests__/workspace-guard-order.test.ts
//
// Every route that touches a workspace must RESOLVE one first.
//
// ---------------------------------------------------------------------------
// THE DEFECT THIS EXISTS FOR
//
// `GET /api/boms` and `GET /api/leaves` were registered as:
//
//   preHandler: [authenticate, cacheMiddleware({ scope: 'workspace', ... })]
//
// with `requireWorkspaceContext` missing entirely. The cache middleware builds
// its key from `request.tenancy.workspaceId`, which nothing had set, so both
// answered 500 on every single call:
//
//   cacheMiddleware(scope: workspace) ran without a resolved tenancy
//
// It reached production and stayed there. Nothing caught it, because the
// handlers compile fine — `request.tenancy` is declared on the request type
// whether or not a preHandler ever populated it.
//
// The 500 is the lucky outcome. A workspace-scoped route with no workspace
// resolution and no cache would have run the handler with `request.tenancy`
// undefined, and what happens next depends on the service.
//
// ---------------------------------------------------------------------------
// WHY A SOURCE-READING TEST
//
// The link between "this handler reads request.tenancy" and "this route
// declared requireWorkspaceContext" exists only in the preHandler array. No
// type connects them, so no compiler can see the gap.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROUTES = join(__dirname, '..', 'routes')

interface Route {
  file: string
  method: string
  path: string
  guards: string
  body: string
}

/**
 * Every route registration, with its guard list resolved.
 *
 * Guards are often hoisted into a shared const — `const read = [authenticate,
 * requireWorkspaceContext, requireCapability('...')]` — which is GOOD practice
 * and must not be reported as a missing guard. So an identifier is looked up
 * rather than treated as empty.
 */
function readRoutes(): Route[] {
  const routes: Route[] = []

  for (const file of readdirSync(ROUTES).filter((name) => name.endsWith('.routes.ts'))) {
    const source = readFileSync(join(ROUTES, file), 'utf8')

    const shared = new Map<string, string>()
    for (const match of source.matchAll(/const (\w+)\s*=\s*(\[[^\]]*\])/g)) {
      shared.set(match[1]!, match[2]!)
    }

    const registrations = source.matchAll(
      /fastify\.(get|post|put|patch|delete)\(\s*\n?\s*'([^']+)'[\s\S]{0,400}?preHandler:\s*(\[[\s\S]*?\]|\w+)/g,
    )

    for (const match of registrations) {
      const declared = match[3]!
      const start = match.index! + match[0].length

      // The handler ends where the NEXT registration begins — not after a
      // fixed number of characters. A fixed window reads into the next route
      // and reports its `request.tenancy` against this one, which is how
      // `POST /api/billing/cancel` (it uses `request.userId`) was accused of a
      // bug belonging to the route below it.
      const next = source.indexOf('fastify.', start)
      const end = next === -1 ? source.length : next

      routes.push({
        file,
        method: match[1]!.toUpperCase(),
        path: match[2]!,
        guards: declared.startsWith('[') ? declared : (shared.get(declared) ?? ''),
        body: source.slice(start, end),
      })
    }
  }

  return routes
}

/** Source with `//` and block comments removed, so prose is never evidence. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

const routes = readRoutes()

describe('workspace guards', () => {
  it('finds the route table', () => {
    expect(routes.length).toBeGreaterThan(50)
  })

  it('every handler that reads request.tenancy declares requireWorkspaceContext', () => {
    const offenders = routes
      .filter((route) => route.body.includes('request.tenancy'))
      .filter((route) => !route.guards.includes('requireWorkspaceContext'))
      .map((route) => `${route.file} ${route.method} ${route.path}`)

    expect(
      offenders,
      'these read a workspace they never resolved — request.tenancy is undefined',
    ).toEqual([])
  })

  it('a workspace-scoped cache is never built before the workspace is known', () => {
    // The cache key contains the workspace id. Ordering the cache before the
    // resolution does not just fail — it fails with a message about caching,
    // which sends the next person to the wrong file.
    const offenders = routes
      .filter((route) => /cacheMiddleware\(\{[^}]*scope:\s*'workspace'/.test(route.guards))
      .filter((route) => {
        const workspace = route.guards.indexOf('requireWorkspaceContext')
        const cache = route.guards.indexOf('cacheMiddleware')
        return workspace === -1 || workspace > cache
      })
      .map((route) => `${route.file} ${route.method} ${route.path}`)

    expect(
      offenders,
      'a workspace-scoped cache runs before (or without) the workspace being resolved',
    ).toEqual([])
  })

  it('no handler decides permission from request.userRole', () => {
    // `auth.middleware.ts` sets `request.userRole` only when the caller
    // belongs to exactly ONE workspace. With two or more it is the empty
    // string — deliberately, because there is no single answer.
    //
    // `workflow.routes.ts` passed it to the approval check, so `canAct`
    // compared '' against the step's approver role and refused every approve
    // and every reject. Anyone working across two shops could not approve
    // anything, and the screen simply did nothing.
    //
    // The role that answers "may this person do this HERE" is
    // `request.tenancy.role` — the role in the resolved workspace.
    // Comments are stripped first. The first version of this check flagged
    // the route that had just been FIXED, because the comment explaining the
    // fix names the thing it stopped using — a guard that reads prose reports
    // the documentation rather than the code.
    const offenders = routes
      .filter((route) => withoutComments(route.body).includes('request.userRole'))
      .map((route) => `${route.file} ${route.method} ${route.path}`)

    expect(
      offenders,
      'these decide permission from a role that is empty for multi-workspace users',
    ).toEqual([])
  })

  it('authenticate comes before everything else', () => {
    // Every other guard reads something authenticate sets. One that runs first
    // sees an anonymous request and either crashes or, worse, decides it is
    // allowed.
    const offenders = routes
      .filter((route) => route.guards.includes('authenticate'))
      .filter((route) => {
        const auth = route.guards.indexOf('authenticate')
        const workspace = route.guards.indexOf('requireWorkspaceContext')
        const capability = route.guards.indexOf('requireCapability')

        return (workspace !== -1 && workspace < auth) || (capability !== -1 && capability < auth)
      })
      .map((route) => `${route.file} ${route.method} ${route.path}`)

    expect(offenders, 'a guard runs before the caller is even identified').toEqual([])
  })
})
