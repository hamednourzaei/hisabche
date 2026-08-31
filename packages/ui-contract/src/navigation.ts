// ============================================
// Navigation contract — the one place that decides what destinations the
// product has, what they are called, and how they are grouped.
//
// This lives in `ui-contract` rather than `packages/ui` because mobile cannot
// import `packages/ui`: that package is written against the DOM and pulls in
// `lucide-react`. Keeping the *data* here and the *icons* in each renderer is
// what lets web, desktop and mobile share one information architecture without
// sharing a rendering technology.
//
//   NAV_CONTRACT  ->  packages/ui/lib/menu   (lucide icons)   -> web, desktop
//                 ->  apps/mobile tab bar    (Ionicons)       -> mobile
//
// Every entry answers one sentence: "I came here because I want to ___".
// Primary = the six things a shop owner does every day.
// Secondary = everything they do occasionally, grouped by who/what it is about.
//
// Paths are web paths. Desktop resolves them against its hash router and mobile
// against expo-router; all three therefore address a destination by the same
// string, which is what makes a deep link portable between platforms.
// ============================================

export type NavId =
  // primary — daily intents
  | 'today'
  | 'sell'
  | 'get-paid'
  | 'stock'
  | 'buy'
  | 'money'
  // secondary — people
  | 'buyers'
  | 'follow-up'
  | 'team'
  | 'coworkers'
  | 'sales-followup'
  // secondary — work
  // `projects` is gone: the module was deleted, not hidden.
  | 'production'
  | 'approvals'
  | 'workflow-templates'
  | 'billing'
  | 'governance'
  // The till. Somewhere a person STANDS, which is why it is primary and the
  // rest of this batch is not.
  | 'till'
  // Month-end work. Real destinations, but nobody opens them daily.
  | 'expiry'
  | 'budgets'
  | 'timesheets'
  | 'assets'
  | 'bank'
  | 'conflicts'
  // secondary — system
  | 'data-and-sync'
  | 'data-migration'
  | 'settings'
  | 'access'
  | 'history'
  | 'events'
  | 'sync'

export type NavGroupId = 'primary' | 'people' | 'work' | 'system'

/**
 * A destination, minus its icon. Renderers attach an icon from their own
 * platform set — `lucide-react` on web/desktop, `Ionicons` on mobile.
 */
export interface NavItemContract {
  id: NavId
  /** Text glyph for surfaces that render copy rather than components (command palette). */
  emoji: string
  /** Key into the shared `common.json` catalogs. Same key on all three platforms. */
  labelKey: string
  descriptionKey: string
  path: string
  group: NavGroupId
}

export interface NavGroupContract {
  id: Exclude<NavGroupId, 'primary'>
  labelKey: string
  items: NavItemContract[]
}

export const NAV_CONTRACT: readonly NavItemContract[] = [
  // ─── کارهای هر روز ───
  {
    id: 'today',
    emoji: '☀️',
    labelKey: 'nav.today',
    descriptionKey: 'nav.today_description',
    path: '/dashboard',
    group: 'primary',
  },
  // «فروش» used to sit here, pointing first at /quick-invoice and then at the
  // invoice builder. It is gone from the navigation at every width: creating an
  // invoice is something you do FROM the invoice list («دریافت پول» → فاکتور
  // جدید), not a destination of its own. `/invoices/new` is still a real route
  // and still reachable from the list, the command palette and any bookmark.
  {
    id: 'get-paid',
    emoji: '💰',
    labelKey: 'nav.getPaid',
    descriptionKey: 'nav.getPaid_description',
    path: '/invoices',
    group: 'primary',
  },
  {
    id: 'stock',
    emoji: '📦',
    labelKey: 'nav.stock',
    descriptionKey: 'nav.stock_description',
    path: '/warehouse',
    group: 'primary',
  },
  // `buy` (/purchasing) is intentionally absent from the navigation: purchases
  // are recorded through the unified transaction form, so a separate
  // destination duplicated the entry point. The route and its screens stay in
  // the codebase and remain reachable by URL.
  {
    id: 'money',
    emoji: '📈',
    labelKey: 'nav.money',
    descriptionKey: 'nav.money_description',
    path: '/accounting',
    group: 'primary',
  },

  // ─── مردم ───
  {
    id: 'buyers',
    emoji: '📒',
    labelKey: 'nav.buyers',
    descriptionKey: 'nav.buyers_description',
    path: '/customers',
    group: 'people',
  },
  {
    id: 'follow-up',
    emoji: '🤝',
    labelKey: 'nav.followUp',
    descriptionKey: 'nav.followUp_description',
    path: '/crm',
    group: 'people',
  },
  // team (/human-resources) is gone from navigation: colleagues and payroll
  // are one section now (/team-and-payroll), and having both entries meant two
  // places to add the same person. The route still resolves.

  // ─── کارها ───
  // `production` (/manufacturing) is hidden from navigation for now; its route
  // and screens remain. `projects` was removed outright — module deleted.
  {
    id: 'approvals',
    emoji: '✅',
    labelKey: 'nav.approvals',
    descriptionKey: 'nav.approvals_description',
    path: '/approvals',
    group: 'work',
  },

  // ─── تنظیمات و امنیت ───
  {
    id: 'settings',
    emoji: '⚙️',
    labelKey: 'nav.settings',
    descriptionKey: 'nav.settings_description',
    path: '/settings',
    group: 'system',
  },
  {
    id: 'access',
    emoji: '🔑',
    labelKey: 'nav.access',
    descriptionKey: 'nav.access_description',
    path: '/permissions',
    group: 'system',
  },
  {
    id: 'events',
    emoji: '🔔',
    labelKey: 'nav.events',
    descriptionKey: 'nav.events_description',
    path: '/activities',
    group: 'system',
  },
  {
    id: 'sync',
    emoji: '🔄',
    labelKey: 'nav.sync',
    descriptionKey: 'nav.sync_description',
    path: '/sync-center',
    group: 'system',
  },

  // ── Destinations added by the Tier 1 and Tier 2 sweep ──
  //
  // Six, not eighteen. Tax rates, exchange rates and accounting dimensions
  // have services and routes but are NOT here: they configure areas that
  // already exist and are reached from settings. Nobody "goes to" a tax rate
  // the way they go to a till, and one nav entry per backend capability is
  // how a sidebar becomes a list nobody reads.
  {
    id: 'till',
    emoji: '🧾',
    labelKey: 'nav.till',
    descriptionKey: 'nav.till_description',
    path: '/till',
    group: 'primary',
  },
  {
    id: 'expiry',
    emoji: '⏳',
    labelKey: 'nav.expiry',
    descriptionKey: 'nav.expiry_description',
    path: '/expiry',
    group: 'work',
  },
  {
    id: 'budgets',
    emoji: '🎯',
    labelKey: 'nav.budgets',
    descriptionKey: 'nav.budgets_description',
    path: '/budgets',
    group: 'work',
  },
  {
    id: 'timesheets',
    emoji: '⏱️',
    labelKey: 'nav.timesheets',
    descriptionKey: 'nav.timesheets_description',
    path: '/timesheets',
    group: 'work',
  },
  {
    id: 'assets',
    emoji: '🏗️',
    labelKey: 'nav.assets',
    descriptionKey: 'nav.assets_description',
    path: '/assets',
    group: 'work',
  },
  {
    id: 'bank',
    emoji: '🏦',
    labelKey: 'nav.bank',
    descriptionKey: 'nav.bank_description',
    path: '/bank',
    group: 'work',
  },

  // Offline conflicts.
  //
  // Next to sync, because that is what it is about: a row here is a sale or a
  // payment that has NOT been recorded, waiting on a decision, and there is
  // nowhere else to make it. Not a notification — a destination.
  //
  // For an offline-first product this is the screen that says whether the
  // books can be trusted.
  {
    id: 'conflicts',
    emoji: '⚖️',
    labelKey: 'nav.conflicts',
    descriptionKey: 'nav.conflicts_description',
    path: '/conflicts',
    group: 'system',
  },

  // The hub §20 asks for. It does NOT replace sync-center, conflicts or
  // data-migration — those are six distinct areas that fail differently, and
  // merging them into one page with one spinner is the mistake. This is the
  // way in, and each area keeps working when reached directly.
  {
    id: 'data-and-sync',
    emoji: '🗄️',
    labelKey: 'nav.data_and_sync',
    descriptionKey: 'nav.data_and_sync_description',
    path: '/data-and-sync',
    group: 'system',
  },

  // Bringing an existing business in. Sits beside conflicts rather than in
  // 'work' because it is something a shop does once, near the start, not part
  // of anybody's week.
  {
    id: 'data-migration',
    emoji: '📥',
    labelKey: 'nav.data_migration',
    descriptionKey: 'nav.data_migration_description',
    path: '/data-migration',
    group: 'system',
  },

  // ── Destinations that had a page and no way to reach it ──
  //
  // Each of these has existed under `apps/web/app/[lang]/(dashboard)/` the
  // whole time and was absent from this list, so the only way in was to type
  // the URL. A page nobody can navigate to is a page nobody uses.
  //
  // `nav-destinations.test.ts` checks the other direction — that every entry
  // here HAS a page. Nothing checked this direction until these were found by
  // listing both and comparing.
  {
    id: 'team',
    emoji: '👷',
    labelKey: 'nav.team',
    descriptionKey: 'nav.team_description',
    path: '/human-resources',
    group: 'people',
  },
  {
    id: 'coworkers',
    emoji: '💵',
    labelKey: 'nav.coworkers',
    descriptionKey: 'nav.coworkers_description',
    path: '/team-and-payroll',
    group: 'people',
  },
  {
    id: 'sales-followup',
    emoji: '📞',
    labelKey: 'nav.sales_followup',
    descriptionKey: 'nav.sales_followup_description',
    path: '/sales-followup',
    group: 'people',
  },
  {
    id: 'production',
    emoji: '🏭',
    labelKey: 'nav.production',
    descriptionKey: 'nav.production_description',
    path: '/manufacturing',
    group: 'work',
  },
  {
    id: 'buy',
    emoji: '🧺',
    labelKey: 'nav.buy',
    descriptionKey: 'nav.buy_description',
    path: '/purchasing',
    group: 'work',
  },
  {
    id: 'workflow-templates',
    emoji: '🧭',
    labelKey: 'nav.workflow_templates',
    descriptionKey: 'nav.workflow_templates_description',
    path: '/workflow-templates',
    group: 'work',
  },
  {
    id: 'billing',
    emoji: '💳',
    labelKey: 'nav.billing',
    descriptionKey: 'nav.billing_description',
    path: '/billing',
    group: 'system',
  },
  {
    id: 'governance',
    emoji: '⚖️',
    labelKey: 'nav.governance',
    descriptionKey: 'nav.governance_description',
    path: '/governance',
    group: 'system',
  },
]

/** Always-visible destinations — a seller's every-day work. */
export const PRIMARY_CONTRACT: readonly NavItemContract[] = NAV_CONTRACT.filter(
  (i) => i.group === 'primary',
)

/** Everything that lives behind «بیشتر», in the order the groups are shown. */
export const MORE_GROUPS_CONTRACT: readonly NavGroupContract[] = [
  {
    id: 'people',
    labelKey: 'nav.groups.people',
    items: NAV_CONTRACT.filter((i) => i.group === 'people'),
  },
  {
    id: 'work',
    labelKey: 'nav.groups.work',
    items: NAV_CONTRACT.filter((i) => i.group === 'work'),
  },
  {
    id: 'system',
    labelKey: 'nav.groups.system',
    items: NAV_CONTRACT.filter((i) => i.group === 'system'),
  },
]

/**
 * Mobile bottom bar — the documented platform adaptation.
 *
 * Web and desktop show all six primary intents in a sidebar; a bottom tab bar
 * holds five targets before each one drops under the 44pt touch minimum. So the
 * four highest-frequency intents stay in the bar and «خرید» / «پول و سود» move
 * to the top of the More screen — still primary, still first thing seen there,
 * one tap deeper. Nothing is removed and the vocabulary is unchanged.
 */
// Three tabs plus «بیشتر». «فروش» was the fourth until invoice creation
// stopped being a destination of its own — see the note where it was removed.
export const MOBILE_TAB_IDS: readonly NavId[] = ['today', 'get-paid', 'stock']

/** Primary intents that the bottom bar could not seat. Rendered first under More. */
export const MOBILE_OVERFLOW_PRIMARY: readonly NavItemContract[] = PRIMARY_CONTRACT.filter(
  (i) => !MOBILE_TAB_IDS.includes(i.id),
)

export const SYNC_INTERVAL_MS = 30_000

// ─── Command palette ───────────────────────────────────────────────────────
// Same vocabulary as navigation, without repeating a destination. The extra
// entries are *actions*, not places, which is why they are not in NAV_CONTRACT.

export interface CommandItemContract {
  id: string
  labelKey: string
  descriptionKey: string
  icon: string
  shortcut: string
  path: string
}

/** Actions — each maps onto a real capability via a query parameter. */
const COMMAND_ACTIONS: readonly CommandItemContract[] = [
  {
    id: 'record-sale',
    labelKey: 'nav.recordSale',
    descriptionKey: 'nav.recordSale_description',
    icon: '🧾',
    shortcut: '',
    path: '/invoices/new?type=sale',
  },
  {
    id: 'record-purchase',
    labelKey: 'nav.recordPurchase',
    descriptionKey: 'nav.recordPurchase_description',
    icon: '🛍️',
    shortcut: '',
    path: '/invoices/new?type=purchase',
  },
  {
    id: 'add-buyer',
    labelKey: 'nav.addBuyer',
    descriptionKey: 'nav.addBuyer_description',
    icon: '👤',
    shortcut: '',
    path: '/customers?add=true',
  },
  {
    id: 'add-product',
    labelKey: 'nav.addProduct',
    descriptionKey: 'nav.addProduct_description',
    icon: '📦',
    shortcut: '',
    path: '/warehouse?add=true',
  },
  {
    id: 'search-customer',
    labelKey: 'nav.searchCustomer',
    descriptionKey: 'nav.searchCustomer_description',
    icon: '🔍',
    shortcut: '',
    path: '/customers?q=',
  },
  {
    id: 'search-product',
    labelKey: 'nav.searchProduct',
    descriptionKey: 'nav.searchProduct_description',
    icon: '🔎',
    shortcut: '',
    path: '/warehouse?q=',
  },
]

export const COMMAND_CONTRACT: readonly CommandItemContract[] = [
  ...NAV_CONTRACT.map((item) => ({
    id: item.id as string,
    labelKey: item.labelKey,
    descriptionKey: item.descriptionKey,
    icon: item.emoji,
    shortcut: item.id === 'sell' ? 'N' : '',
    path: item.path,
  })),
  ...COMMAND_ACTIONS,
]

// ============================================================================
// Applying a user's visibility profile to the navigation.
//
// The ORDER these two arguments are applied in is the whole point, and it is
// the same order the server uses:
//
//   1. `authorized` — what the person MAY reach. Comes from the server's
//      authorization core and is the gate.
//   2. `hidden` — what they have chosen not to see. A preference.
//
// `hidden` can only ever REMOVE from `authorized`. There is deliberately no
// parameter that adds a destination: un-hiding something the server did not
// authorize must not make it appear, or a UI preference becomes a way around
// authorization.
// ============================================================================

/**
 * The destinations to render, given what the server authorized and what the
 * user has hidden.
 *
 * Contract order is preserved: navigation that reshuffles itself as people
 * hide things is navigation nobody can build muscle memory for.
 */
export function visibleNavItems(
  items: readonly NavItemContract[],
  authorized: readonly NavId[],
  hidden: readonly NavId[] = [],
): NavItemContract[] {
  const allowed = new Set(authorized)
  const suppressed = new Set(hidden)

  return items.filter((item) => allowed.has(item.id) && !suppressed.has(item.id))
}

/** The same, for the grouped "more" menu. Empty groups drop out entirely. */
export function visibleNavGroups(
  groups: readonly NavGroupContract[],
  authorized: readonly NavId[],
  hidden: readonly NavId[] = [],
): NavGroupContract[] {
  return groups
    .map((group) => ({ ...group, items: visibleNavItems(group.items, authorized, hidden) }))
    .filter((group) => group.items.length > 0)
}

/**
 * How many destinations a device should render at once, given its budget.
 *
 * The overflow is NOT dropped — it moves into the "more" menu. A destination
 * that silently disappeared on a slow phone would be indistinguishable from a
 * permission the user does not have.
 */
export function splitForBudget<T>(
  items: readonly T[],
  maxVisible: number,
): { visible: T[]; overflow: T[] } {
  if (maxVisible <= 0) return { visible: [], overflow: [...items] }
  return { visible: items.slice(0, maxVisible), overflow: items.slice(maxVisible) }
}
