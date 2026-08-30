// ============================================
// Mobile navigation adapter.
//
// The destinations, their copy and their grouping come from
// `@hisabche/ui-contract` — the same data the web sidebar and the desktop
// sidebar/command palette render. This file adds only what a React Native
// renderer needs on top of that: an Ionicons name per destination, and the
// list of destinations that already have a mobile screen.
//
// Nothing here decides what the product's navigation *is*. Change
// `packages/ui-contract/src/navigation.ts` for that.
// ============================================

import type { Ionicons } from '@expo/vector-icons'
import {
  MOBILE_OVERFLOW_PRIMARY,
  MOBILE_TAB_IDS,
  MORE_GROUPS_CONTRACT,
  NAV_CONTRACT,
  type NavGroupContract,
  type NavId,
  type NavItemContract,
} from '@hisabche/ui-contract'

type IconName = keyof typeof Ionicons.glyphMap

export interface MobileNavItem extends NavItemContract {
  /** Idle icon — outline, the standard iOS/Android cue for an unselected tab. */
  icon: IconName
  /** Selected icon — solid. */
  iconActive: IconName
}

export interface MobileNavGroup {
  id: NavGroupContract['id']
  labelKey: string
  items: MobileNavItem[]
}

/** Exhaustive over `NavId`: a destination added to the contract cannot compile
 *  here until mobile has chosen an icon for it. */
const ICONS: Record<NavId, readonly [IconName, IconName]> = {
  today: ['home-outline', 'home'],
  sell: ['add-circle-outline', 'add-circle'],
  'get-paid': ['receipt-outline', 'receipt'],
  stock: ['cube-outline', 'cube'],
  buy: ['cart-outline', 'cart'],
  money: ['trending-up-outline', 'trending-up'],
  buyers: ['people-outline', 'people'],
  'follow-up': ['chatbubbles-outline', 'chatbubbles'],
  team: ['briefcase-outline', 'briefcase'],
  production: ['construct-outline', 'construct'],
  approvals: ['checkmark-done-outline', 'checkmark-done'],
  settings: ['settings-outline', 'settings'],
  access: ['key-outline', 'key'],
  history: ['time-outline', 'time'],
  events: ['notifications-outline', 'notifications'],
  sync: ['sync-outline', 'sync'],
  till: ['calculator-outline', 'calculator'],
  expiry: ['hourglass-outline', 'hourglass'],
  budgets: ['flag-outline', 'flag'],
  timesheets: ['stopwatch-outline', 'stopwatch'],
  assets: ['business-outline', 'business'],
  bank: ['card-outline', 'card'],
  conflicts: ['git-compare-outline', 'git-compare'],
  coworkers: ['wallet-outline', 'wallet'],
  'sales-followup': ['call-outline', 'call'],
  'workflow-templates': ['git-branch-outline', 'git-branch'],
  billing: ['pricetag-outline', 'pricetag'],
  governance: ['shield-checkmark-outline', 'shield-checkmark'],
}

/**
 * Destinations mobile currently serves.
 *
 * The contract is the full product IA; mobile is being brought up to it screen
 * by screen. Listing what exists here — rather than trimming the contract —
 * keeps the two platforms describable by one document and means a new screen
 * lights up in navigation by adding one id, not by re-deriving the menu.
 *
 * Still to build on mobile: `team` (/human-resources), `projects`,
 * `production` (/manufacturing), `approvals` and `access` (/permissions).
 * They stay out of IMPLEMENTED and out of the menu rather than appearing and
 * going nowhere. Tracked in documents/UI_PARITY_EXECUTION.md.
 *
 * The six destinations from the Tier 1/2 sweep — `till`, `expiry`, `budgets`,
 * `timesheets`, `assets`, `bank` — now have screens under
 * `src/features/<id>/screens/` and routes under `app/<id>.tsx`, so they are
 * listed below.
 */
const IMPLEMENTED: ReadonlySet<NavId> = new Set<NavId>([
  'today',
  'get-paid',
  'stock',
  'buy',
  'money',
  'buyers',
  'follow-up',
  'settings',
  'events',
  'sync',

  // Tier 1/2 sweep. Each has a screen and a route on mobile; the containers
  // behind web and desktop are different code, but the hooks, the money
  // contract and the wording are the same.
  'till',
  'expiry',
  'budgets',
  'timesheets',
  'assets',
  'bank',

  // The offline conflict queue. The phone is where the offline writes came
  // from, so it is where the person most likely to explain them is standing.
  'conflicts',
  'governance',
])

function toMobile(item: NavItemContract): MobileNavItem {
  const [icon, iconActive] = ICONS[item.id]
  return { ...item, icon, iconActive }
}

export function isImplemented(id: NavId): boolean {
  return IMPLEMENTED.has(id)
}

/**
 * Expo Router href for a contract path.
 *
 * Tab destinations live inside the `(tabs)` group, which expo-router needs
 * named explicitly when pushing from outside the group; everything else is
 * served at the contract path verbatim.
 */
export function hrefFor(path: string): string {
  return TAB_PATHS.has(path) ? `/(tabs)${path}` : path
}

const TAB_ITEMS_INTERNAL: MobileNavItem[] = MOBILE_TAB_IDS.map((id) =>
  toMobile(NAV_CONTRACT.find((i) => i.id === id) as NavItemContract),
)

const TAB_PATHS: ReadonlySet<string> = new Set(TAB_ITEMS_INTERNAL.map((i) => i.path))

/** Bottom bar, in order. See MOBILE_TAB_IDS for why it is four and not six. */
export const TAB_ITEMS: readonly MobileNavItem[] = TAB_ITEMS_INTERNAL

/** Route name expo-router uses for a tab — the file under `app/(tabs)/`. */
export function tabRouteName(item: MobileNavItem): string {
  return item.path.replace(/^\//, '')
}

/** Primary intents the bottom bar could not seat. Shown first under More. */
export const MORE_PRIMARY: readonly MobileNavItem[] = MOBILE_OVERFLOW_PRIMARY.filter((i) =>
  IMPLEMENTED.has(i.id),
).map(toMobile)

/** Secondary groups, in contract order, minus anything without a screen yet. */
export const MORE_GROUPS: readonly MobileNavGroup[] = MORE_GROUPS_CONTRACT.map((group) => ({
  id: group.id,
  labelKey: group.labelKey,
  items: group.items.filter((i) => IMPLEMENTED.has(i.id)).map(toMobile),
})).filter((group) => group.items.length > 0)
