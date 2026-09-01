// ============================================
// backend/src/__tests__/client-route-contract.test.ts
//
// Every path a client calls must exist on the server, with that method.
//
// ---------------------------------------------------------------------------
// THE DEFECTS THIS EXISTS FOR
//
// Both were found in production, by a person clicking a control that did
// nothing:
//
//   · `useSaveSodSettings` POSTed to `/governance/sod`. The route is
//     `fastify.put('/sod')`. POST matched nothing, every attempt to change the
//     separation-of-duties mode answered 404, and the switch appeared to work
//     while changing nothing.
//
//   · `sales-followup.ts` called `/sales-followups` — a path with no route, no
//     service and no table. It had 404'd on every request since the day it was
//     written.
//
// Nothing connects `apiClient.post('/x')` to `fastify.put('/x')`. They are two
// strings in two packages, and TypeScript has no opinion about whether they
// agree. This test compares them.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT CLAIM
//
// A matching path and method is not proof the request works — the body shape,
// the guards and the response are all still open questions. It only rules out
// the failure where the client is talking to an address nobody is at.
// ============================================

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..')
const ROUTES = join(ROOT, 'backend', 'src', 'routes')
const HOOKS = join(ROOT, 'packages', 'api', 'src', 'hooks')

/** Prefixes registered in index.ts, so a route file's paths can be resolved. */
function routePrefixes(): Map<string, string> {
  const index = readFileSync(join(ROOT, 'backend', 'src', 'index.ts'), 'utf8')
  const prefixes = new Map<string, string>()

  for (const match of index.matchAll(/register\((\w+),\s*\{\s*prefix:\s*'([^']+)'/g)) {
    prefixes.set(match[1]!, match[2]!)
  }

  return prefixes
}

/** Every `METHOD path` the server actually serves. */
function serverRoutes(): Set<string> {
  const prefixes = routePrefixes()
  const served = new Set<string>()

  for (const file of readdirSync(ROUTES).filter((name) => name.endsWith('.routes.ts'))) {
    const source = readFileSync(join(ROUTES, file), 'utf8')

    // `crmRoutes` -> the prefix it was registered under, if any.
    const exported = /export async function (\w+)\(/.exec(source)?.[1]
    const prefix = exported ? (prefixes.get(exported) ?? '') : ''

    for (const match of source.matchAll(
      /fastify\.(get|post|put|patch|delete)\(\s*\n?\s*'([^']+)'/g,
    )) {
      const method = match[1]!.toUpperCase()
      const path = match[2]!

      // A route file either carries its own `/api/...` paths or is mounted
      // under a prefix. Both spellings are recorded so neither is missed.
      served.add(`${method} ${path}`)
      if (prefix) served.add(`${method} ${prefix}${path}`)
    }
  }

  return served
}

/** Every `METHOD path` the client calls, with template parts normalised. */
function clientCalls(): Array<{ file: string; method: string; path: string }> {
  const calls: Array<{ file: string; method: string; path: string }> = []

  for (const file of readdirSync(HOOKS).filter((name) => name.endsWith('.ts'))) {
    const source = readFileSync(join(HOOKS, file), 'utf8')

    for (const match of source.matchAll(
      /apiClient\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*[`'"]([^`'"]+)[`'"]/g,
    )) {
      calls.push({ file, method: match[1]!.toUpperCase(), path: match[2]! })
    }
  }

  return calls
}

/** `/pos/sessions/${id}/orders` and `/pos/sessions/:id/orders` are one route. */
function normalise(path: string): string {
  return path
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/:[A-Za-z_][\w]*/g, ':param')
    .replace(/\/+$/, '')
}

const served = new Set(
  [...serverRoutes()].map((entry) => {
    const [method, ...rest] = entry.split(' ')
    return `${method} ${normalise(rest.join(' '))}`
  }),
)

const calls = clientCalls()

describe('the client and the server agree on the API surface', () => {
  it('finds both sides', () => {
    expect(served.size).toBeGreaterThan(80)
    expect(calls.length).toBeGreaterThan(60)
  })

  /**
   * Calls with no route on the server today.
   *
   * Every one of these 404s right now, and the screen behind it does nothing.
   * They are listed rather than ignored so that:
   *
   *   · the failures are visible instead of being discovered by a user,
   *   · a NEW mismatch still fails this test immediately,
   *   · the list can only shrink — adding to it should feel like a decision.
   *
   * Fixing one means building the endpoint, which is a separate change with
   * its own tests. Deleting the line is how it leaves this list.
   */
  /**
   * ⚠️ EMPTY, and it must stay that way.
   *
   * This set once held seven addresses the client called and nobody was at.
   * Every one of them 404'd, and the screen behind it quietly showed nothing —
   * an empty party statement, a purchase order that could not be opened, a
   * delete button that did not delete.
   *
   * They are all built now. The set stays here rather than being deleted so
   * that the next person who wants to ship a hook against a route that does
   * not exist has to write their excuse down, in this file, where a reviewer
   * will see it.
   */
  const KNOWN_MISSING = new Set<string>([])

  it('every path a hook calls is served, with that method', () => {
    // `apiClient` has `baseURL` ending in `/api`, so a hook's `/governance/sod`
    // is the server's `/api/governance/sod`.
    const missing = calls
      .filter((call) => {
        const path = normalise(call.path)
        return !served.has(`${call.method} ${path}`) && !served.has(`${call.method} /api${path}`)
      })
      .map((call) => `${call.file}: ${call.method} ${normalise(call.path)}`)
      .filter((entry) => !KNOWN_MISSING.has(entry))

    expect(
      missing,
      'these call an address nobody is at — the request 404s and the screen does nothing',
    ).toEqual([])
  })
})
