// ============================================
// Dead-link guard.
//
// Shared screens navigate by pushing web-style paths, and every renderer
// resolves those against its own router — Next on web, a hash router on
// desktop, expo-router on mobile. A path that exists in none of them fails
// differently on each: a 404 on web, a silent bounce to the dashboard on
// desktop's catch-all, nothing at all on mobile.
//
// This scans the shared components for literal navigation targets and asserts
// each one is a destination the product actually serves. It was written after
// finding two live dead links: the dashboard chart's "full report" button
// pointing at `/reports`, and the permissions page's "manage members" button
// pointing at `/workspace`. Neither route has ever existed.
// ============================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { NAV_ITEMS } from '../nav-items'

const COMPONENTS_DIR = join(__dirname, '..', '..', '..', 'components', 'ui')

/**
 * Real routes that carry no navigation entry.
 *
 * Being absent from the sidebar is not the same as not existing. Two reasons a
 * served route is missing from `NAV_ITEMS`:
 *
 *   - reached while signed out, so there is no sidebar at all (login, signup)
 *   - deliberately hidden but still addressable: purchases are recorded
 *     through the unified transaction form rather than their own destination,
 *     manufacturing is parked, and colleagues moved under team-and-payroll —
 *     each keeps its page so existing links and deep links still resolve.
 *
 * This list is what makes the assertion "the route exists" rather than "the
 * route is in the menu".
 */
const NON_NAV_ROUTES = new Set([
  '/login',
  '/signup',
  // Invoice creation, both steps. Reached from the invoice list, the command
  // palette and the builder itself — never from a sidebar entry, because
  // creating an invoice is an action on the invoice list rather than a
  // destination of its own.
  '/invoices/new',
  '/invoices/new/preview',
  '/purchasing',
  '/manufacturing',
  '/human-resources',
  '/team-and-payroll',
])

const KNOWN_PATHS = new Set([...NAV_ITEMS.map((item) => item.path), ...NON_NAV_ROUTES])

/** `onNavigate('/x')`, `router.push('/x')`, `push('/x')` — literals only. */
const NAV_CALL = /(?:onNavigate|router\.push|\bpush)\(\s*['"](\/[a-z0-9/-]*)['"]/gi

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return entry.endsWith('.tsx') || entry.endsWith('.ts') ? [full] : []
  })
}

function literalTargets(): { file: string; path: string }[] {
  const found: { file: string; path: string }[] = []

  for (const file of sourceFiles(COMPONENTS_DIR)) {
    const source = readFileSync(file, 'utf8')

    for (const match of source.matchAll(NAV_CALL)) {
      const target = match[1]
      // Root and bare-prefix pushes are template bases (`/invoices/${id}`),
      // not destinations in their own right.
      if (target && target !== '/') found.push({ file, path: target })
    }
  }

  return found
}

describe('shared screens never navigate to a route that does not exist', () => {
  it('finds navigation calls to check — the scan itself must not silently pass', () => {
    // A regex that stops matching would turn this whole file into a no-op.
    expect(literalTargets().length).toBeGreaterThan(5)
  })

  it('resolves every literal target to a real destination', () => {
    const dead = literalTargets()
      .filter(({ path }) => !KNOWN_PATHS.has(path))
      .map(({ file, path }) => `${path} (${file.split('components')[1]})`)

    expect(dead).toEqual([])
  })
})
