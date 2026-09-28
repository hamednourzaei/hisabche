// ============================================
// packages/ui/src/lib/docs/docs-content.ts
//
// T12 — the public documentation: STRUCTURE here, TEXT in the message bundles.
//
// ---------------------------------------------------------------------------
// ⚠️ NOT ONE WORD OF PROSE LIVES IN THIS FILE
//
// Every string is a key resolved against `packages/i18n/messages/<lang>`.
// Hardcoding Persian here would have made the docs a Persian-only surface in a
// product that ships Persian, Dari and English — and the docs are the one page
// an English-speaking evaluator is most likely to read.
//
// ---------------------------------------------------------------------------
// ⚠️ THE LINE THE CONTENT MUST NOT CROSS
//
// The owner's requirement: «رقبا نباید بتوانند الگوریتم‌ها و نحوه‌ی پیاده‌سازی
// را کپی کنند». The docs are public and indexable, so every sentence is a
// sentence a competitor reads.
//
//   ✅ WHAT it does · HOW to use it
//   ⛔ HOW it is computed
//
// «reorder suggestions are based on your real sales» — yes.
// «avg × leadTime + safety» — no. That sentence IS the feature.
//
// `docs-no-implementation-leak.test.ts` enforces this across EVERY language,
// because a leak in the English bundle is a leak.
// ============================================

export type DocsGroupId = 'start' | 'sell' | 'stock' | 'money' | 'team' | 'platform'

export interface DocsSectionDef {
  /** Key suffix. Resolves to `docs.<slug>.<id>.heading` / `.body` / `.steps`. */
  id: string
  /** How many body paragraphs to read from the bundle. */
  bodyCount: number
  /** How many steps, when the section is about doing something. */
  stepCount?: number
}

export interface DocsArticleDef {
  /** URL segment. Stable — these become public URLs and get indexed. */
  slug: string
  group: DocsGroupId
  sections: DocsSectionDef[]
  /**
   * Other articles a reader of this one will want next.
   *
   * ⚠️ EVERY ARTICLE MUST HAVE AT LEAST TWO, AND A GUARD ENFORCES IT.
   *
   * A docs set where each page is only reachable from the index is a set of
   * orphans: a crawler arriving on one article from a search result finds no
   * path onward, and neither does a reader. The links also spread authority
   * between pages that genuinely belong together.
   *
   * These are hand-picked rather than «other articles in this group» — the
   * useful next page is often in a different group. Someone reading about
   * invoices wants payments and units, not the other sales article.
   */
  related: string[]
  /**
   * Pages OUTSIDE the docs this article should link to.
   *
   * Docs that link only to docs form an island. These connect the set to the
   * public marketing pages, which is where a reader who arrived on a
   * how-to query converts.
   */
  outbound?: { href: string; labelKey: string }[]
}

export const DOCS_GROUPS: readonly DocsGroupId[] = [
  'start',
  'sell',
  'stock',
  'money',
  'team',
  'platform',
]

export const DOCS_ARTICLES: readonly DocsArticleDef[] = [
  {
    slug: 'getting-started',
    group: 'start',
    sections: [
      { id: 'setup', bodyCount: 2, stepCount: 4 },
      { id: 'existing', bodyCount: 1 },
    ],
    related: ['invoices', 'inventory', 'data-and-backup'],
    outbound: [{ href: '/features/offline', labelKey: 'landing.featurePage.offline.h1' }],
  },
  {
    slug: 'invoices',
    group: 'sell',
    sections: [
      { id: 'kinds', bodyCount: 2 },
      { id: 'columns', bodyCount: 3, stepCount: 3 },
      { id: 'payment', bodyCount: 3 },
    ],
    related: ['customers', 'inventory', 'accounting'],
    outbound: [
      { href: '/features/customer-debt', labelKey: 'landing.featurePage.customerDebt.h1' },
      { href: '/features/invoicing', labelKey: 'landing.featurePage.invoicing.h1' },
    ],
  },
  {
    slug: 'customers',
    group: 'sell',
    sections: [
      { id: 'balance', bodyCount: 2 },
      { id: 'overdue', bodyCount: 1 },
    ],
    related: ['invoices', 'accounting', 'pos'],
    outbound: [
      { href: '/features/customer-debt', labelKey: 'landing.featurePage.customerDebt.h1' },
    ],
  },
  {
    slug: 'inventory',
    group: 'stock',
    sections: [
      { id: 'source', bodyCount: 2 },
      { id: 'units', bodyCount: 3, stepCount: 3 },
      { id: 'insights', bodyCount: 2 },
    ],
    related: ['invoices', 'pos', 'accounting', 'barcodes'],
    outbound: [{ href: '/features/inventory', labelKey: 'landing.featurePage.inventory.h1' }],
  },
  {
    slug: 'barcodes',
    group: 'stock',
    sections: [
      { id: 'codes', bodyCount: 2 },
      { id: 'scan', bodyCount: 2, stepCount: 3 },
      { id: 'scale', bodyCount: 2 },
    ],
    related: ['inventory', 'invoices', 'pos'],
    outbound: [{ href: '/features/inventory', labelKey: 'landing.featurePage.inventory.h1' }],
  },
  {
    slug: 'accounting',
    group: 'money',
    sections: [
      { id: 'automatic', bodyCount: 2 },
      { id: 'closing', bodyCount: 1 },
      { id: 'currency', bodyCount: 2 },
    ],
    related: ['invoices', 'customers', 'branches'],
    outbound: [{ href: '/features/daybook', labelKey: 'landing.featurePage.daybook.h1' }],
  },
  {
    slug: 'pos',
    group: 'money',
    sections: [
      { id: 'shift', bodyCount: 3 },
      { id: 'tills', bodyCount: 3, stepCount: 3 },
      { id: 'cash', bodyCount: 3 },
      { id: 'closing', bodyCount: 3 },
    ],
    related: ['inventory', 'customers', 'permissions', 'barcodes'],
    outbound: [{ href: '/features/offline', labelKey: 'landing.featurePage.offline.h1' }],
  },
  {
    slug: 'wallet',
    group: 'money',
    sections: [
      { id: 'what', bodyCount: 2 },
      { id: 'topup', bodyCount: 2, stepCount: 4 },
      { id: 'pay', bodyCount: 2 },
    ],
    related: ['permissions', 'getting-started', 'accounting'],
  },
  {
    slug: 'offline',
    group: 'platform',
    sections: [
      { id: 'devices', bodyCount: 2 },
      { id: 'browser', bodyCount: 1 },
    ],
    related: ['pos', 'data-and-backup', 'getting-started'],
    outbound: [{ href: '/features/offline', labelKey: 'landing.featurePage.offline.h1' }],
  },
  {
    slug: 'branches',
    group: 'team',
    sections: [
      { id: 'branches', bodyCount: 2 },
      { id: 'setup', bodyCount: 2, stepCount: 3 },
      { id: 'staff', bodyCount: 2 },
      { id: 'reports', bodyCount: 3 },
      { id: 'warehouses', bodyCount: 3 },
    ],
    related: ['permissions', 'accounting', 'inventory'],
  },
  {
    slug: 'permissions',
    group: 'team',
    sections: [
      { id: 'roles', bodyCount: 2 },
      { id: 'sod', bodyCount: 2 },
    ],
    related: ['branches', 'pos', 'assistant', 'wallet', 'developers'],
  },
  {
    slug: 'assistant',
    group: 'platform',
    sections: [
      { id: 'what', bodyCount: 2 },
      { id: 'limits', bodyCount: 3 },
      { id: 'quota', bodyCount: 1 },
    ],
    related: ['accounting', 'inventory', 'permissions'],
  },
  {
    slug: 'data-and-backup',
    group: 'platform',
    sections: [
      { id: 'backup', bodyCount: 1 },
      { id: 'contents', bodyCount: 3 },
      { id: 'limits', bodyCount: 3 },
      { id: 'export', bodyCount: 1 },
      { id: 'csv', bodyCount: 3, stepCount: 3 },
      { id: 'offline', bodyCount: 2 },
    ],
    related: ['getting-started', 'offline', 'accounting', 'developers'],
  },
  {
    slug: 'developers',
    group: 'platform',
    sections: [
      { id: 'keys', bodyCount: 2 },
      { id: 'webhooks', bodyCount: 2 },
      { id: 'storefront', bodyCount: 2 },
      { id: 'apps', bodyCount: 2 },
      { id: 'sandbox', bodyCount: 1 },
    ],
    related: ['permissions', 'data-and-backup', 'invoices'],
  },
]

/**
 * Where `/docs` sends a reader.
 *
 * ⚠️ THE INDEX PAGE NO LONGER EXISTS. `/docs` is a permanent redirect here, so
 * nobody lands on a page whose only content is a list of links to the real
 * pages. This constant is what the redirect, the sitemap and the footer all
 * read, so they cannot drift apart.
 */
export const DOCS_ENTRY_SLUG = 'getting-started'

export function findArticle(slug: string): DocsArticleDef | undefined {
  return DOCS_ARTICLES.find((article) => article.slug === slug)
}

/** Every message key the docs need, so a guard can check them all. */
export function docsMessageKeys(): string[] {
  const keys: string[] = ['docs.title', 'docs.subtitle']

  for (const group of DOCS_GROUPS) keys.push(`docs.group.${group}`)

  for (const article of DOCS_ARTICLES) {
    // `seoTitle` is separate from `title`: the sidebar wants «فاکتور», the
    // <title> wants the phrasing people actually search — «راهنمای فاکتور در
    // نرم‌افزار حسابداری». Ranking help pages in this market use that shape.
    keys.push(
      `docs.${article.slug}.title`,
      `docs.${article.slug}.summary`,
      `docs.${article.slug}.seoTitle`,
    )

    for (const section of article.sections) {
      keys.push(`docs.${article.slug}.${section.id}.heading`)
      for (let i = 0; i < section.bodyCount; i += 1) {
        keys.push(`docs.${article.slug}.${section.id}.body${i + 1}`)
      }
      for (let i = 0; i < (section.stepCount ?? 0); i += 1) {
        keys.push(`docs.${article.slug}.${section.id}.step${i + 1}`)
      }
    }
  }

  return keys
}
