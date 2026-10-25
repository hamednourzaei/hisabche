# Internal linking architecture — Hisabche public web

Measured 25–26 Oct 2026 on the production build (`http://localhost:3111`), from
raw server HTML with JavaScript disabled. Generator:
`scripts/seo/internal-link-audit.mjs`; evidence:
`docs/SEO/internal-link-report.json` / `.md` and
`docs/SEO/INTERNAL-LINKING-INVENTORY.csv`.

This document describes the graph that exists, not a graph that should be
invented. If a page type is absent from the product, it is absent here too.

## 1. Hierarchy

Three tiers, derived from the real routes in `apps/web/app/[lang]` and the
`routes` array in `apps/web/app/sitemap.ts`.

| Tier                         | Pages                                                 |      Count (sitemap) | Parent                           |
| ---------------------------- | ----------------------------------------------------- | -------------------: | -------------------------------- |
| **1 — entry**                | `/{locale}` landing, `/about`, `/contact`             |                    9 | — (root)                         |
| **2 — hubs**                 | 6 feature pages × 3 locales                           |                   18 | landing                          |
| **2 — hub**                  | `/docs/getting-started` (guide entry)                 |                    3 | landing / footer / every article |
| **2 — hubs (conditional)**   | `/blog`, `/market`                                    |       0 while closed | landing / footer                 |
| **3 — leaves**               | 22 guide articles × 3                                 |                   66 | guide entry + sibling articles   |
| **3 — leaves**               | 10 legal pages × 3                                    |                   30 | footer on every page             |
| **3 — leaves (conditional)** | blog posts, tags, categories, market sellers/listings | 0 while empty/closed | their hub                        |

Landing → feature is one hop. Landing → guide entry is one hop. Landing → any
article is two hops (guide entry → article). Measured maximum depth is **3** and
average **1.80**; every Tier 1/2 page sits at depth **≤1**, well inside the
depth-2 requirement.

`fa`, `af` and `en` are independent trees: `/fa/*` links only to `/fa/*`,
`/af/*` to `/af/*`, `/en/*` to `/en/*`. The only deliberate cross-locale links
are the language switcher and the `hreflang` cluster.

## 2. Header

`packages/ui/src/components/ui/navigation/top-nav.tsx`

- The logo is a real `<a href>` to `/{locale}`.
- Section links are `<a href="#features">`, `#pricing`, `#security`, `#faq` —
  fragments of the landing, prefixed with the locale so they do not depend on
  `<base>`.
- The primary CTA is `<Link href="./signup">` (locale-prefixed by the caller).
- The language switcher stays a link and is the only intentional cross-locale
  navigation.
- On mobile the same anchors are rendered by `landing-mobile-menu.tsx` in the
  DOM; the hamburger changes visibility, not the server HTML.

Auth links (`/login`, `/signup`) in the public header carry
`rel="nofollow"` (`public-auth-actions.tsx`) because they lead to private,
`noindex` routes. Important public links are never `nofollow`.

## 3. Footer

`packages/ui/src/components/ui/landing/site-footer-view.tsx`

| Column  | Links                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product | landing fragments `#features`, `#pricing`, `#security`, `#faq`, then 6 feature pages: customer-debt, offline, shop-accounting, invoicing, inventory, daybook |
| Company | `/blog`, `/docs/getting-started`, `/about`, `/contact`                                                                                                       |
| Legal   | all 10 legal pages                                                                                                                                           |
| Social  | Telegram, Facebook, Instagram (external)                                                                                                                     |

The footer is on every public page, so every feature page, the guide entry, the
blog hub, about, contact and all legal pages get an inbound link from the whole
site. It is deliberately bounded — no full sitemap in the footer.

`/docs` itself is **not** linked: the footer and every contextual link target
`/docs/getting-started`, the 200 page, never the 308.

## 4. Breadcrumbs

Only where a real hierarchy exists:

| Page                       | Visible breadcrumb                           | JSON-LD                          |
| -------------------------- | -------------------------------------------- | -------------------------------- |
| Blog article               | Home → Blog → post (`blog-article-view.tsx`) | `BreadcrumbList`                 |
| Blog list / tag / category | Home → section                               | `BreadcrumbList`                 |
| Guide article              | none (the sidebar is the hierarchy)          | `BreadcrumbList`: Home → article |

Rules:

- Every item is a real link except the last (the current page).
- No item points at a redirect: the guide breadcrumb used to name `/docs` (308)
  and now names the article directly.
- No item points at a 404, a `noindex` page or a non-canonical URL.
- `BreadcrumbList` is emitted **only** for these page types, matching the
  visible path. Features and legal pages have no fabricated breadcrumb.

## 5. Contextual links

| From                             | To                       | Source of the relationship                                                                                                   |
| -------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Guide article ↔ guide article    | related articles         | the docs sidebar lists every `DOCS_ARTICLES` entry, so each article links to all siblings and receives links back            |
| Feature page ↔ feature page      | 3 related features       | the `related` array beside each feature definition in `features/[slug]/page.tsx`, chosen by product behaviour — never random |
| Feature page → about             | one link                 | real company context                                                                                                         |
| Blog article → signup            | one CTA                  | real conversion path, not a keyword block                                                                                    |
| Landing → feature / guide / blog | body sections and footer | static server components                                                                                                     |

No link is generated from a tag that does not exist, and no "related products"
block exists because the product has no catalogue.

## 6. Anchor text

- Every important link uses the destination's real name (`Inventory management`,
  `راهنمای صدور فاکتور`, `Offline invoicing`).
- The closed generic set — `visit`, `here`, `click here`, `read more`, `more`,
  `بیشتر`, `مشاهده` — is measured and currently **0** occurrences in the raw
  HTML graph.
- The same keyword is not repeated across every anchor; the language of each
  anchor matches the destination page's language.
- Icons-only links carry `aria-label` with the destination name.

## 7. Orphan policy

- Every page in the sitemap has at least one meaningful inbound path from the
  landing. Measured: **0 orphans**, minimum inbound on a sitemap page **19**,
  average **20.95**.
- A page that nobody should reach (token pages, dashboard, auth) is allowed to be
  an orphan from the public graph and is excluded from the sitemap.
- A page is never linked just to remove an orphan warning. If it has no value it
  is `noindex` and out of the sitemap instead.

## 8. Redirects, canonical and sitemap

- Internal links never pass through a redirect. Measured:
  **0 links through a redirect**; 28 `moved` pairs exist for external/legacy
  URLs only.
- Internal links never use the bare `/`; they use `/{locale}`. The only `/` in
  the graph is the seed the crawler starts from, which it normalises to `/fa`.
- Canonical is absolute, self-referential, one per page. Measured:
  **0 links to a non-canonical page**, **0 broken canonical targets**.
- Sitemap ↔ link graph: all 123 sitemap URLs answer 200, are indexable,
  self-canonical, and have inbound links. No sitemap URL is `noindex`, a
  redirect or a 404. The only indexable URLs outside the sitemap are the three
  `/xx/docs` 308 sources, which are the same page as the guide entry.
- Private and token routes stay out of the sitemap and are `noindex`; token
  routes are also `Disallow`ed so customer data is never fetched.

## 9. Locale policy

- One tree per locale; no accidental cross-locale link.
- `fa` and `af` are separate locales with separate Dari/Persian copy, not
  machine translations, so both are indexed and neither canonicalises to the
  other.
- The switcher maps the current path to the same path in the target locale and
  is the only cross-locale anchor.

## 10. Tests that hold this architecture

`packages/ui/src/__tests__/seo-public-pages.test.ts` → group _internal link
graph (raw server HTML)_:

- ≥150 pages, ≥2,000 links in the committed measured graph;
- 0 broken, 0 through redirect, 0 non-canonical, 0 generic anchors, 0 orphans;
- no edge to `/`, no cross-locale edge;
- every Tier 1/2 page at depth ≤2 with ≥3 inbound;
- every indexable page ≥1 inbound.

Neighbouring guards: `route-parity`, `robots-does-not-block-public`,
`robots-dashboard-routes`, `dashboard-page-structure`, `one-ux`,
`public-page-namespaces`, `landing-claims`.

Regeneration and injection proof are in `docs/SEO/SEO-TESTING.md`.
