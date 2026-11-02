// ============================================
// backend/src/__tests__/helpers/route-source.ts
//
// The route table, read from source: method, path, the RESOLVED guard list and the handler body.
// Shared by every guard that has to look at routes (workspace resolution, capability on writes) — one reader,
// not one per guard, so two guards can never disagree about what a route declares.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROUTES = join(__dirname, '..', '..', 'routes')

export interface Route {
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
export function readRoutes(): Route[] {
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
export function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}
