# SEO tests — what is guarded, and how to reproduce a red

Everything below runs inside the existing pipeline. No second CI workflow was
created: `.github/workflows/ci.yml` already runs `pnpm lint`, `pnpm type-check`,
`pnpm test` and the web build, so the guards are part of `pnpm test`.

## 1. The guard file

`packages/ui/src/__tests__/seo-public-pages.test.ts` — 10 tests in 6 groups.

| Group                    | Test                                                                                                                                                                                                                    | Guards against                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| server-side API fetchers | never hands `fetch` a relative URL, even when `NEXT_PUBLIC_API_URL=/api`                                                                                                                                                | the 500 on `/blog` and `/market`                                                                       |
| landing JSON-LD          | does not repeat `Organization`, `WebSite`, `FAQPage`                                                                                                                                                                    | duplicate structured data                                                                              |
| docs breadcrumb          | no breadcrumb item points at `/docs`                                                                                                                                                                                    | a `BreadcrumbList` item that is a 308                                                                  |
| sitemap output           | absolute `https://hisabche.com/` URLs, unique, no query, no `/login`, `/signup`, `/dashboard`, `/docs`, no `/market`                                                                                                    | a private/redirect/404 URL in the sitemap                                                              |
| public → private links   | `/login` and `/signup` in the public header carry `rel="nofollow"`                                                                                                                                                      | leaking crawl budget and confusing the landing's intent                                                |
| internal link graph      | the measured raw-HTML graph has ≥150 pages, ≥2,000 links, 0 broken, 0 through redirect, 0 non-canonical, 0 generic anchors, 0 orphans, every Tier 1/2 page at depth ≤2 with ≥3 inbound, every indexable page ≥1 inbound | orphan pages, redirect chains, anchor-text drift, a regression that only appears in the assembled page |

The link-graph group reads `docs/SEO/internal-link-report.json`, which is the
committed output of the crawler in §2. It deliberately does **not** re-fetch the
network in CI: the artifact is the measured production HTML, and the generator
is repeatable.

## 2. The two generators (not tests, but the evidence behind them)

| Script                                                             | What it does                                                                                                                                                                        | Output                                                                        |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/seo/crawl-inventory.mjs --base …`                         | walks the sitemap, every public `page.tsx`, and all redirect sources with `redirect: 'manual'`; records status chain, canonical, robots, hreflang, title, h1 count, JSON-LD         | `docs/SEO/URL-INVENTORY.csv`, `docs/SEO/audit-summary.json`                   |
| `scripts/seo/internal-link-audit.mjs --base … --depth 3 --max 400` | parses every `<a href>` from the raw server HTML (no JS), builds the graph, records status/redirect/canonical/robots/depth/anchor, checks each unfetched target with a real request | `docs/SEO/internal-link-report.json`, `.md`, `INTERNAL-LINKING-INVENTORY.csv` |
| `scripts/seo/build-decisions.mjs`                                  | derives the per-URL keep/exclude verdict from the measured inventory                                                                                                                | `docs/SEO/DISCOVERED-DECISIONS.csv`                                           |

Reproduce:

```bash
cd apps/web && pnpm run build
pnpm exec next start -p 3111
node scripts/seo/crawl-inventory.mjs --base http://localhost:3111
node scripts/seo/internal-link-audit.mjs --base http://localhost:3111 --depth 3 --max 400
node scripts/seo/build-decisions.mjs
```

On Windows set `TEMP`/`TMP` to `.pgtest/tmp` before the build if esbuild reports
`Access is denied` on a temp path. Do not leave `.pgtest` inside `apps/web`: the
`rtl-logical-properties` guard scans the repo for colour literals and will flag
JIT temp files.

## 3. Injection test — every fix was removed once

Command:

```bash
node .pgtest/injection-seo.mjs
```

For each case the harness writes the broken version, runs only
`seo-public-pages.test.ts`, and restores the file byte-for-byte.

| Injected defect                                     | File                                       | Result          |
| --------------------------------------------------- | ------------------------------------------ | --------------- |
| relative API base (`value \|\| fallback` → `value`) | `apps/web/lib/blog-api.ts`                 | red as expected |
| duplicate `Organization` on the landing             | `apps/web/app/[lang]/page.tsx`             | red as expected |
| breadcrumb item → `/docs`                           | `apps/web/app/[lang]/docs/[slug]/page.tsx` | red as expected |
| missing `rel="nofollow"` on login                   | `packages/ui/.../public-auth-actions.tsx`  | red as expected |
| `/docs` added to the sitemap routes                 | `apps/web/app/sitemap.ts`                  | red as expected |
| `linksThroughRedirect: 1` in the measured graph     | `docs/SEO/internal-link-report.json`       | red as expected |

`6/6` went red; all files were restored. A guard that cannot fail is not a guard.

## 4. Neighbouring guards that must stay green

These already existed and were not modified; a failure in one of them is a
failure of this work:

- `robots-does-not-block-public.test.ts`
- `robots-dashboard-routes.test.ts`
- `landing-claims.test.ts`
- `route-parity.test.ts`
- `public-page-namespaces.test.ts`
- `index-exports-server-safe.test.ts`
- `no-import-cycles.test.ts`
- `one-ux.test.ts`
- `dashboard-page-structure.test.ts`
- `rtl-logical-properties.test.ts` (design tokens, not colours)

## 5. Running the suites

Run sequentially, from each package:

```bash
cd packages/ui   && pnpm exec tsc --noEmit && pnpm exec vitest run
cd apps/web      && pnpm exec tsc --noEmit && pnpm run build
cd packages/api  && pnpm exec tsc --noEmit
```

Last measured run: UI **2,444 passed / 2 skipped / 0 failed** across
**184 files (1 skipped)**; web type-check 0; web build 128 static pages; API
type-check 0; eslint on every changed file 0 errors.
