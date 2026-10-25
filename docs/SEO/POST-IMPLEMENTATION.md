# Post-implementation record — Hisabche technical SEO

Date: 25–26 Oct 2026.
Every number in this file was produced by a command recorded below, against the
production build served on `http://localhost:3111`. Nothing here is projected,
estimated or copied from a tool that was not run.

Status vocabulary:

| Status                                | Meaning                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `VERIFIED`                            | measured from a real HTTP response / real test run in this repository |
| `IMPLEMENTED_NOT_EXTERNALLY_VERIFIED` | code, build and tests green; Google has not recrawled yet             |
| `REQUIRES_GOOGLE`                     | only Search Console can answer it                                     |

## 1. What changed

| #   | File                                                               | Change                                                                                                                                                                 | Why                                                                                                                      |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | `apps/web/lib/blog-api.ts`                                         | server base URL must be absolute; relative `NEXT_PUBLIC_API_URL=/api` falls back to `https://api.hisabche.com/api`; one retry on network error/timeout                 | `/blog` answered **500** (`Failed to parse URL from /api/...`); a slow upstream also produced 500 under concurrent crawl |
| 2   | `apps/web/lib/market-api.ts`                                       | same absolute-base + retry rule                                                                                                                                        | `/market` had the same failure                                                                                           |
| 3   | `apps/web/app/[lang]/page.tsx`                                     | landing emits only `SoftwareApplication`; `Organization`/`WebSite` stay in the layout, `FAQPage` in `faq-scene`                                                        | crawl found `Organization, WebSite, Organization, WebSite, SoftwareApplication, FAQPage, FAQPage`                        |
| 4   | `apps/web/app/[lang]/docs/[slug]/page.tsx`                         | `BreadcrumbList` = Home → article                                                                                                                                      | the middle item pointed at `/docs`, a 308 redirect                                                                       |
| 5   | `packages/ui/src/components/ui/navigation/public-auth-actions.tsx` | `rel="nofollow"` on the public `/login` and `/signup` links                                                                                                            | public → private link without `nofollow`                                                                                 |
| 6   | `packages/ui/src/__tests__/seo-public-pages.test.ts`               | 10 guards (see `SEO-TESTING.md`)                                                                                                                                       | stops all five defects above from returning                                                                              |
| 7   | `scripts/seo/crawl-inventory.mjs`                                  | origin-safe sitemap rewrite, canonical comparison by pathname, canonical-target status, hreflang pair validation, robots-block check, per-type thin thresholds, dedupe | the first crawl mixed the production sitemap host with localhost and reported false duplicates                           |
| 8   | `scripts/seo/internal-link-audit.mjs`                              | raw-HTML link graph, `/` merged into `/fa`, redirect detection by real request, `nofollow` excluded from public→noindex count, hierarchy CSV                           | measurement was wrong before it was useful                                                                               |
| 9   | `scripts/seo/build-decisions.mjs`                                  | builds `DISCOVERED-DECISIONS.csv` from measured inventory                                                                                                              | the "Discovered – not indexed" table must be evidence-based                                                              |
| 10  | `docs/SEO/*`                                                       | audit, policy, inventory, decisions, link graph, testing, architecture                                                                                                 | the work has to be auditable by the next person                                                                          |

No page was created, no copy was invented, no dependency was added, no database
statement was run.

## 2. Before / after — crawl

Command:

```bash
cd apps/web && pnpm run build
pnpm exec next start -p 3111
node scripts/seo/crawl-inventory.mjs --base http://localhost:3111
```

| Metric                                                          |                  Before |                                                               After |
| --------------------------------------------------------------- | ----------------------: | ------------------------------------------------------------------: |
| Inventory URLs                                                  |        301 (host-mixed) |                                                             **262** |
| HTTP 500                                                        |                       6 |                                                               **0** |
| HTTP 200                                                        |                     295 |                                                             **259** |
| HTTP 404                                                        |                       0 | **3** (`/fa/market`, `/af/market`, `/en/market` — closed by design) |
| Sitemap URLs                                                    |                     123 |                                                             **123** |
| Sitemap URL not 200                                             |                       — |                                                               **0** |
| Sitemap URL `noindex`                                           |                       — |                                                               **0** |
| Sitemap URL not self-canonical                                  |                       — |                                                               **0** |
| hreflang issues                                                 |                       — |                                                               **0** |
| Broken canonical targets                                        |                       — |                                                               **0** |
| robots-blocked indexable URLs                                   |                       — |                                                               **0** |
| Duplicate titles on the same path                               | 42 (false, host mixing) |                                                               **0** |
| Indexable pages with ≠1 `<h1>`                                  |                       0 |                                                               **0** |
| Indexable thin pages                                            |                       — |              **3** (`/contact` ×3, 34–35 words, real address/phone) |
| Invalid or forbidden JSON-LD (`Review`, `Rating`, fake `Offer`) |                       — |                                                               **0** |

## 3. Before / after — internal link graph (raw HTML, JS disabled)

Command:

```bash
node scripts/seo/internal-link-audit.mjs --base http://localhost:3111 --depth 3 --max 400
```

| Metric                                            |                    Before |         After |
| ------------------------------------------------- | ------------------------: | ------------: |
| Pages fetched                                     | 181 (with `/` duplicated) |       **180** |
| `<a href>` in server HTML                         |                     2,784 |     **2,760** |
| Unique targets                                    |                       183 |       **183** |
| Pages with 0 inbound                              |  1 (measurement artefact) |         **0** |
| Pages with exactly 1 inbound                      |                        45 |        **45** |
| Pages with ≥3 / ≥5 inbound                        |                 133 / 132 | **132 / 132** |
| Broken links                                      |                         0 |         **0** |
| Links through a redirect                          |                         0 |         **0** |
| Links to a non-canonical page                     |                         0 |         **0** |
| Generic anchors (`visit`, `here`, `read more`, …) |                         0 |         **0** |
| Important orphan pages                            |                         0 |         **0** |
| Average / maximum depth                           |                  1.79 / 3 |  **1.80 / 3** |
| Average inbound (indexable)                       |                     20.95 |     **20.95** |

The link count fell by 24 only because `/` is no longer stored as a second copy
of `/fa`. No public link was removed.

## 4. Fixed

| Defect                               | Evidence                                                                             | Status                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------- |
| `/blog`, `/market` 500               | server log `TypeError: Failed to parse URL from /api/...`; 6× 500 in the first crawl | `VERIFIED` (final crawl 0× 500, pages 200)   |
| Upstream timeout → 500               | `TimeoutError: The operation was aborted` in the server log                          | `VERIFIED` (retry added; final crawl 0× 500) |
| Duplicate landing JSON-LD            | crawl extracted the same types twice                                                 | `VERIFIED` (guard + crawl both see one copy) |
| Docs breadcrumb via a 308            | `/fa/docs` answers 308                                                               | `VERIFIED` (guard + final HTML)              |
| Public auth links without `nofollow` | raw HTML                                                                             | `VERIFIED` (guard + final HTML)              |

## 5. Deliberately excluded

| Thing                                                      | Why                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/docs` in the sitemap or as a canonical/breadcrumb target | it is a 308 to `DOCS_ENTRY_SLUG`; the entry article is the page                                     |
| Empty blog hub in the sitemap                              | `noindex` while it has zero posts; flips automatically on the first post                            |
| Closed marketplace pages                                   | backend 404 by design; not `noindex`-with-200                                                       |
| 28 `moved` redirect pairs                                  | intentional product renames; web and app-shell lists must stay identical (`route-parity`)           |
| Bare-URL 307 to a locale                                   | inherent to `localePrefix: 'always'`; internal links always carry the locale so crawlers pay 0 hops |
| `/pricing`, industry pages, product/category pages         | they do not exist in the product; creating them would be fabricated content (`landing-claims`)      |
| Adding keyword-stuffed link blocks                         | the graph already has 2,760 links and 0 orphans; volume was not the problem                         |

## 6. Unresolved / not measurable here

| Item                                        | Why                                                                                                                                                                 | Owner                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Core Web Vitals before/after                | no Lighthouse or PageSpeed Insights CLI in this environment; a browser-based lab run would not be the same metric Google uses                                       | owner: run PSI on the deployed landing and record field data |
| Search Console "Internal links: 1"          | the number is produced by Google's crawl of the deployed site, not by localhost                                                                                     | `REQUIRES_GOOGLE`                                            |
| "Discovered – currently not indexed" cohort | the real export is not in the repository; `DISCOVERED-DECISIONS.csv` maps the 123 sitemap URLs and is keyed by URL, so the real CSV can be joined without a rewrite | `REQUIRES_GOOGLE`                                            |
| Blog/market live content                    | both are API-driven; this environment has no posts and the market is closed                                                                                         | owner                                                        |

## 7. Verification actually run

| Command                                       | Result                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `cd packages/ui && pnpm exec tsc --noEmit`    | exit 0                                                                         |
| `cd packages/ui && pnpm exec vitest run`      | **184 files passed, 1 skipped; 2,444 tests passed, 2 skipped; 0 failed**       |
| `cd apps/web && pnpm exec tsc --noEmit`       | exit 0                                                                         |
| `cd apps/web && pnpm run build`               | green, **128 static pages**                                                    |
| `cd packages/api && pnpm exec tsc --noEmit`   | exit 0                                                                         |
| `pnpm exec eslint` on every changed file      | **0 errors** (2 pre-existing `any` warnings in the docs page, unrelated lines) |
| injection harness `.pgtest/injection-seo.mjs` | **6/6 guards went red when the fix was removed, then restored**                |

## 8. Search Console hand-off

Paste the real export here when it is available; the audit table is keyed by URL
so no document has to be rewritten.

| Metric                                           | Real value | Date |
| ------------------------------------------------ | ---------- | ---- |
| Pages indexed                                    | —          | —    |
| Pages "Discovered – currently not indexed"       | —          | —    |
| Internal links                                   | —          | —    |
| Core Web Vitals: Good / Needs improvement / Poor | —          | —    |

After deploy, the owner should:

1. Deploy the backend first (blog/market API), then web — the fetchers call the API.
2. In Search Console → Sitemaps, resubmit `https://hisabche.com/sitemap.xml`.
3. URL Inspection → **Request indexing** for `/fa`, `/af`, `/en` and one article.
4. Wait for the next crawl before judging "Internal links"; it will not change at deploy time.
