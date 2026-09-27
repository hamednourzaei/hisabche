// ============================================
// packages/ui-contract/src/shell.ts
//
// PHASE 2 — the global frame, and PHASE 7 — the domain workspaces inside it.
//
// ---------------------------------------------------------------------------
// BREADCRUMBS ARE DERIVED, NEVER HAND-WRITTEN
//
// Every screen that writes its own breadcrumb writes a slightly different one,
// and then the trail disagrees with the sidebar about where you are. The path
// already knows; this turns it into a trail using NAV_CONTRACT, so a renamed
// destination renames its own breadcrumb and cannot drift.
//
// ---------------------------------------------------------------------------
// A WORKSPACE IS AN ENTRY POINT, NOT A DASHBOARD
//
// §11 asks each business domain for a predictable way in: overview, quick
// actions, work queue, reports. The trap is building six dashboards full of
// charts nobody reads. What is defined here is the COMPOSITION — which
// destinations belong to which domain, and which actions are worth a button —
// so a domain page is assembled from things that already exist rather than
// inventing another set of tiles.
// ============================================

import { NAV_CONTRACT, type NavId } from './navigation'

/* ─── Breadcrumbs ─────────────────────────────────────────────────────────── */

export interface Crumb {
  /** i18n key, never text. Empty when the contract does not know this path. */
  labelKey: string
  /** The raw URL segment, so a renderer can fall back without re-splitting the
   *  path and re-deriving which segment this crumb came from. */
  segment: string
  /** Absent on the last crumb: you do not link to where you already are. */
  path?: string
}

/** The root of every trail. */
const HOME: Crumb = { labelKey: 'nav.today', segment: '', path: '/dashboard' }

/**
 * The trail for a path.
 *
 * Locale prefixes are stripped first: web serves `/fa/invoices` and desktop
 * serves `/invoices`, and a trail that differed between the two would be two
 * trails. Unknown segments become a crumb with no label key rather than
 * disappearing — a detail page under an unrecognised route should still show
 * that it is one level deeper.
 */
export function breadcrumbsFor(path: string, localeCodes: readonly string[] = []): Crumb[] {
  const cleaned = stripLocale(path, localeCodes)
  if (cleaned === '' || cleaned === '/dashboard') return [{ labelKey: HOME.labelKey, segment: '' }]

  const segments = cleaned.split('/').filter(Boolean)
  const crumbs: Crumb[] = [HOME]

  let walked = ''
  segments.forEach((segment, index) => {
    walked += `/${segment}`
    const destination = NAV_CONTRACT.find((item) => item.path === walked)
    const isLast = index === segments.length - 1

    crumbs.push({
      labelKey: destination?.labelKey ?? '',
      segment,
      // The last crumb is where you are, so it is not a link.
      ...(isLast ? {} : { path: walked }),
    })
  })

  return crumbs
}

function stripLocale(path: string, localeCodes: readonly string[]): string {
  const match = /^\/([^/]+)(\/.*)?$/.exec(path)
  if (match && localeCodes.includes(match[1]!)) return match[2] ?? ''
  return path
}

/**
 * The address a shared screen navigates to, on the host it is running on.
 *
 * Web serves `/fa/invoices`; desktop and mobile serve `/invoices`. A screen
 * knows the route (`/invoices`), and the host knows the language — web through
 * its `[lang]` segment, the other hosts not at all. So the prefix goes on only
 * when a language IS known.
 *
 * ⚠️ No default language. The first version of this rule lived inside the
 * approvals screen and fell back to `'fa'`, so on Windows every button sent
 * the user to `/fa/…` — a route desktop does not have — and the catch-all
 * quietly dropped them on the dashboard.
 */
export function localizePath(path: string, lang: string | null | undefined): string {
  if (!lang || !path.startsWith('/')) return path
  if (path === `/${lang}` || path.startsWith(`/${lang}/`)) return path
  return `/${lang}${path}`
}

/* ─── Domain workspaces ───────────────────────────────────────────────────── */

export const DOMAINS = ['accounting', 'sales', 'inventory', 'people'] as const
export type DomainId = (typeof DOMAINS)[number]

export interface DomainSpec {
  readonly id: DomainId
  readonly labelKey: string
  /** Destinations that belong to this domain, in the order they are offered. */
  readonly destinations: readonly NavId[]
  /** The one or two things somebody opens this domain to DO. */
  readonly primaryActions: readonly NavId[]
}

/**
 * Which destinations belong to which domain.
 *
 * Every id here must exist in NAV_CONTRACT — `shell.test.ts` holds that, so a
 * domain cannot advertise a page that was deleted.
 *
 * Note what is absent: there is no `manufacturing` domain and no `purchasing`
 * domain, even though both have screens. Neither has enough destinations to be
 * worth a hub of its own, and a domain page listing one link is worse than the
 * link.
 */
export const DOMAIN_SPECS: readonly DomainSpec[] = [
  {
    id: 'accounting',
    labelKey: 'domain.accounting',
    destinations: ['money', 'bank', 'budgets', 'assets', 'approvals', 'governance'],
    primaryActions: ['money'],
  },
  {
    id: 'sales',
    labelKey: 'domain.sales',
    // 'sell' is a command-palette ACTION, not a destination — there is no
    // page at /sell. A hub linking to it would be a dead door.
    destinations: ['till', 'get-paid', 'buyers', 'follow-up'],
    primaryActions: ['till'],
  },
  {
    id: 'inventory',
    labelKey: 'domain.inventory',
    destinations: ['stock', 'buy', 'expiry', 'production'],
    primaryActions: ['stock'],
  },
  {
    id: 'people',
    labelKey: 'domain.people',
    // G1: 'team' (/human-resources) folded into 'coworkers'
    // (/team-and-payroll). They listed the same people twice, and the People
    // workspace showed both as separate destinations.
    destinations: ['coworkers', 'timesheets'],
    primaryActions: ['coworkers'],
  },
]

export function domainFor(id: DomainId): DomainSpec {
  const spec = DOMAIN_SPECS.find((domain) => domain.id === id)
  if (!spec) throw new Error(`unknown domain: ${id}`)
  return spec
}

/**
 * Which domain a destination belongs to, if any.
 *
 * Returns null rather than guessing. Plenty of destinations — settings, sync,
 * conflicts, data migration — deliberately belong to no business domain, and
 * forcing them into one would put "import customers" under Sales where nobody
 * would look for it.
 */
export function domainOf(nav: NavId): DomainId | null {
  return DOMAIN_SPECS.find((domain) => domain.destinations.includes(nav))?.id ?? null
}

/**
 * The destinations of a domain, filtered to what this actor may reach.
 *
 * ⚠️ A rendering filter, not authorization. Each destination's own routes
 * enforce their capabilities server-side; this only avoids offering a door
 * that will refuse to open.
 */
export function domainDestinations(id: DomainId, authorized: readonly NavId[]): readonly NavId[] {
  return domainFor(id).destinations.filter((nav) => authorized.includes(nav))
}
