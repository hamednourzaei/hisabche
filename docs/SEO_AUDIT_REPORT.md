# Hisabche — Technical SEO & Performance Audit

Scope: `apps/web` (Next.js 16 App Router) + `packages/ui/src/components/ui/landing`.
Method: direct source review of routing, metadata, middleware, sitemap, robots, redirects, landing-page component tree, dashboard layout, and a sample of auth/legal pages. No live crawl, no Lighthouse run, no network/CrUX data was available in this environment — CWV numbers below are structural inferences from the code, not measured field data. Get real numbers from PageSpeed Insights / CrUX / Search Console before re-prioritizing.

Note on locales: `apps/web/app/[lang]/i18n-config.ts` defines the *only* valid route locales as `fa` (default, unprefixed), `af`, `en`. A large number of files in this codebase key their translated content by `"fa-IR"` / `"fa-AF"` instead — those keys never match the actual `lang` param, so they silently fall through to the default-locale fallback string. This single root cause explains several issues below and recurs in ~30 files; I fixed it where it affected indexed pages and flagged the rest as P2 (they're all `noindex` pages, so the SEO cost is low, but it's still a real i18n bug).

---

## Executive Summary

The marketing site's technical foundation (Next.js Metadata API, `next/image`, App Router, dynamic imports for below-the-fold sections, security headers, FAQ JSON-LD) is solid. But several concrete bugs were actively undermining it: the homepage served **identical Persian metadata to every locale** (so `/en` and `/af` had a Persian `<title>` and description — a direct contradiction of their own `hreflang` tags), the **canonical tag for the default locale never fired** due to a case-sensitivity typo, the **sitemap listed URLs that don't exist** (wrong locale codes, a `/pricing` route that was never built), and the **apex-domain redirect double-prefixed locales** (`hisabche.com/fa/x` → `.../en/fa/x`, a dead link). These are exactly the kind of issues that cap organic growth regardless of how much content is added on top — they tell Google the site is inconsistent about its own canonical identity. All of these are now fixed.

## Overall SEO Score: 58 / 100

Breakdown: Technical foundation 7/10 (good Metadata API usage, broken by execution bugs — now largely fixed) · Content/E-E-A-T 5/10 (thin, template-y dashboard descriptions; no blog/topical content) · Performance 6/10 (good code-splitting, but `unoptimized` on hero screenshots) · Accessibility 7/10 (good landmark/heading structure, some contrast/focus items to verify visually) · International SEO 4/10 → now 7/10 after fixes · Structured Data 6/10 → 8/10 after fixes.

## Business Impact

Hisabche competes for high-intent, high-volume Persian/Dari terms ("نرم‌افزار حسابداری", "حسابداری آنلاین"). Because the homepage metadata was hardcoded to Persian, `/en` and `/af` pages were effectively invisible to their own language's search intent — Google indexes what's in `<title>`/`<meta description>`, not what renders after hydration. Fixing this alone should materially improve `/en` and `/af` impressions within a few weeks of re-crawl. The sitemap pointing at non-existent/wrong-locale URLs also risked Search Console "Submitted URL not found (404)" errors, which erode crawl trust for the whole property.

## Biggest Opportunities

1. **Localize the homepage** (`[lang]/page.tsx`) — fixed. This was the single highest-leverage bug on the site.
2. **Fix canonical/hreflang consistency** — fixed. Was actively working against Google's ability to trust the canonical URL.
3. **Correct the sitemap** — fixed. Was submitting dead/wrong URLs.
4. **Re-enable image optimization on the two largest LCP-adjacent images** (dashboard screenshots) — flagged, not applied (see Performance).
5. **Build out topical content** (comparison pages, "چطور فاکتور بسازیم", industry landing pages) — recommendation only, requires content strategy.

## Critical Issues (P0)

| # | Issue | File | Status |
|---|---|---|---|
| 1 | Homepage metadata/JSON-LD hardcoded to Persian for all locales (`/en`, `/af` got Persian `<title>`) | `apps/web/app/[lang]/page.tsx` | **Fixed** |
| 2 | Canonical tag comparison used `lang === "FA"` (uppercase) against a lowercase `lang` value — condition never true, so the default locale's canonical was always `/fa` instead of `/` | `apps/web/app/[lang]/layout.tsx` | **Fixed** |
| 3 | Sitemap used locale codes `fa-IR`/`fa-AF` that don't match the actual routes (`fa`/`af`); `af` pages were submitted as `/fa-AF` which doesn't exist | `apps/web/app/sitemap.ts` | **Fixed** |
| 4 | Sitemap listed `/pricing` as a route — no such page exists (pricing is an in-page anchor `#pricing` on the homepage) | `apps/web/app/sitemap.ts` | **Fixed** (removed) |
| 5 | Sitemap listed 5 `noindex` auth/onboarding routes, wasting crawl budget and risking "submitted URL marked noindex" Search Console warnings | `apps/web/app/sitemap.ts` | **Fixed** (removed) |
| 6 | Apex-domain redirect forced every path to `/en`, including paths that already had a locale prefix, producing dead double-locale URLs (`hisabche.com/fa/x` → `www.../en/fa/x`) | `apps/web/next.config.js` | **Fixed** |
| 7 | `hreflang` links pointed at `hisabche.com` (apex, no `www`) while `metadataBase`/canonical use `www.hisabche.com` — combined with #6, these hreflang URLs themselves redirected into broken locale-doubled paths | `apps/web/app/[lang]/layout.tsx` | **Fixed** |
| 8 | `dir="rtl"` check used `lang === "fa-AF"`, which never matches the real route value `"af"` — Dari (`/af`) pages rendered `dir="ltr"`, breaking RTL layout/reading order for that entire locale | `apps/web/app/[lang]/layout.tsx` | **Fixed** |
| 9 | FAQ `FAQPage` JSON-LD always emitted the Persian fallback text, never the translated `en`/`af` copy — structured data didn't match visible content on non-Persian pages (a Rich Results policy violation, risks losing the FAQ rich snippet) | `packages/ui/src/components/ui/landing/faq-scene.tsx` | **Fixed** |
| 10 | `/login` page's `<title>`/description/keywords were a verbatim copy of the `/signup` page's ("Sign Up") — wrong title for the page's actual content | `apps/web/app/[lang]/login/layout.tsx` | **Fixed** |
| 11 | Footer links to `/contact` and `/legal/privacy` — neither route exists in the app (404 on click, and a crawl trap for bots) | `packages/ui/src/components/ui/landing/site-footer.tsx` | **Reported only** — creating new pages is a content decision, out of auto-apply scope. Either build these pages or remove the links. |
| 12 | Dashboard hero screenshots (`dashboard-desktop.png`, `dashboard-mobile.png`) use `<Image unoptimized>`, disabling AVIF/WebP conversion and responsive `srcset` that `next.config.js` is otherwise configured for | `packages/ui/src/components/ui/landing/dashboard-showcase-scene.tsx` | **Reported only** — a prior comment ("unoptimized for large files") suggests this was a deliberate workaround for an infra issue; removing it without verifying the image pipeline in a real deploy could reintroduce whatever broke it. Recommend: convert the source PNGs to pre-compressed WebP/AVIF assets and drop `unoptimized`, or confirm the optimizer now handles the file size and remove the flag. |

## Technical SEO (Detailed)

**Fixed this pass:**
- Canonical URL logic corrected for the default locale (`fa`) — was silently broken by a case-sensitivity bug (Priority: P0, Impact: high — canonical is a primary signal for de-duplicating `/` vs `/fa`, Risk: none, purely a logic correction).
- `alternates.languages` in the root layout now points `en`→`/en`, `af`→`/af`, `fa`→`/`, `x-default`→`/` (was inconsistently mixing apex/`www` and had `fa` pointing at itself). (P0, high impact, no risk.)
- Sitemap rebuilt to only include real, indexable URLs (`/` and `/legal/terms`) across the three real locale prefixes, with correct `hreflang` alternates per entry. (P0, high impact — a wrong sitemap can suppress indexing of pages that *do* exist, since Google partially uses it as a trust signal for the whole property. No risk — sitemap is regenerated at build/request time, not cached content.)
- `robots.ts` (already present, not modified) correctly disallows `/api/` and `/_next/` and points to the correct sitemap URL — no changes needed there.
- Apex → `www` redirect no longer clobbers the path. (P0, prevents dead links from any inbound backlinks to the bare `hisabche.com` domain, Risk: low — this is a strict correctness fix, the old behavior was never intentional given it silently produced 404s.)

**Not fixed, recommended (P1/P2):**
- The `fa-IR`/`fa-AF` vs `fa`/`af` key-mismatch pattern also exists in ~28 other files (mostly `(dashboard)/*`, `forgot-password`, `reset-password`, `accept-invite`, `onboarding`, `signup`, `public-invoice`). All of these already carry `robots: { index: false }`, so the SEO exposure is low, but the Dari (`af`) locale silently gets Persian-Iran (`fa`) copy on every one of these screens. Worth a dedicated cleanup pass — happy to scope narrowly to avoid colliding with the in-flight i18n migration to `next-intl`.
- `apps/web/app/[lang]/(dashboard)/layout.tsx` sets dashboard-wide `title`/`description`/`keywords` metadata with real keyword lists, even though every child page already sets its own `robots: { index: false }`. Not a bug (child metadata overrides), but it's dead weight — the dashboard section doesn't need SEO keywords at all since it's fully gated behind auth and noindexed. Low priority cleanup.
- No `generateStaticParams` observed for `[lang]` segment — confirm whether the three locale variants of the homepage are statically generated or always dynamically rendered; static generation would materially help TTFB/LCP for a page this metadata-heavy. Needs a build-output check I couldn't run here.

## Content SEO

- Homepage copy (hero, pain, features, FAQ, pricing) is specific and benefit-led, not generic AI filler — good baseline E-E-A-T signal.
- FAQ section (`faq-scene.tsx`) is a genuine content asset: 16 real questions with internal anchor links back to relevant sections — good internal linking pattern, already well built.
- Dashboard pages have templated, near-identical meta descriptions across sections ("Online sales, inventory and accounting management system…") — irrelevant since they're `noindex`, no action needed.
- No blog, no comparison content, no localized landing pages per business vertical (e.g. "حسابداری فروشگاهی", "حسابداری رستوران") despite these appearing in the keyword lists already embedded in the metadata — the keywords are aspirational but there's no content behind them. This is the largest content gap; it's a strategy/content decision, not something to auto-generate.

## Performance / Core Web Vitals

- Hero image (`logo-icon.png`) correctly uses `next/image` with `priority` — good LCP practice.
- Below-the-fold sections are `next/dynamic`-split (`pain-scene`, `features-scene`, `faq-scene`, etc.) with `aria-hidden` loading placeholders — solid pattern for reducing initial JS.
- `next.config.js` has `optimizeCss: true`, `optimizePackageImports` for the heavy libraries, AVIF/WebP image formats, long-lived caching for fonts/static assets, and `compress: true` — a well-configured baseline.
- **Not fixed**: `unoptimized` on the two dashboard screenshots (see Critical Issues #12) bypasses all of that image config for what are visually large, above-the-fold-adjacent assets on the landing page — likely a real LCP/bytes-over-the-wire cost. Needs verification against actual file sizes/production image-optimizer behavior before removing.
- Could not measure LCP/CLS/INP/TTFB/TBT without a live environment — recommend running PageSpeed Insights against `https://www.hisabche.com/`, `/en`, and `/af` post-deploy and feeding real numbers back into prioritization.

## Accessibility

- Heading hierarchy on the landing page is correct: exactly one `<h1>` (hero), `<h2>` per major section, `<h3>` for FAQ category groups — verified across all 11 landing components.
- All images already use `next/image` with real (non-empty, localized via `t()`) `alt` text — no raw `<img>` tags found, no missing alt attributes found.
- Footer uses proper landmarks (`<footer>`, `<nav aria-label>`, `<ul>/<li>`) — good semantic structure, not decorative divs.
- FAQ accordion buttons use `aria-expanded` correctly; decorative icons are `aria-hidden`.
- Not independently verified in this pass (would need a rendered page + axe/Lighthouse): color contrast ratios, focus-visible states beyond the one global CSS rule in `layout.tsx`, keyboard-only navigation through the scroll-narrative sections.

## Structured Data

- `SoftwareApplication` JSON-LD present in both root layout and homepage (redundant — two scripts on the same page, both now locale-correct after fixes). Recommend consolidating into a single source before adding more schema types, to avoid the two ever drifting apart again the way they had.
- `FAQPage` JSON-LD present and now correctly localized (fixed, see #9). This is a legitimate Rich Results candidate — validate at https://search.google.com/test/rich-results after deploy.
- Not present, worth adding once content exists: `BreadcrumbList` (no breadcrumbs UI currently exists outside the dashboard), `Organization` (currently only `SoftwareApplication`, no separate `Organization` entity with logo/sameAs social links — the footer already lists Telegram/Facebook/Instagram, which would slot directly into `sameAs`).

## Internal Linking

- Footer "SEO footer" pattern (`site-footer.tsx`) intentionally links to real search-intent sections (`#features`, `#pricing`, `#security`, `#faq`) rather than generic filler — good.
- Two broken footer links (`/contact`, `/legal/privacy`) — see Critical Issues #11.
- FAQ answers link back to relevant homepage sections — solid internal linking for a single-page site; the main gap is having no additional pages to link *to* (see Content SEO).

## Metadata

All metadata bugs listed under Critical Issues are now fixed: homepage localization, canonical case bug, hreflang domain consistency, `og:locale` values (`af` was emitting `"fa"` instead of a valid `og:locale` — fixed to `fa_AF`), and the `/login` title copy-paste.

## Core Web Vitals

See Performance section — no live measurement available; structural risks flagged (`unoptimized` images).

## UX

- Scroll-narrative landing page pattern (`use-scroll-narrative-store`, `NavigationRegistry`) is a deliberate, well-built UX; not evaluated further as this is a design decision, not an SEO defect.

## Security

- `next.config.js` sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` on all routes — good baseline. No `Content-Security-Policy` header configured (there's a commented-out placeholder in the headers array) — recommend adding one, but CSP authoring requires enumerating every script/style/connect source in use (GTM, Vercel Analytics, the API origin) and is easy to get wrong in a way that breaks the app, so it's left as a recommendation rather than applied blind.
- `poweredByHeader: false` set — good, reduces fingerprinting surface.

## International SEO

Fixed this pass: canonical, hreflang domain/target consistency, `dir="rtl"` locale detection, `og:locale` values, sitemap locale codes, homepage per-locale metadata. Remaining: the systemic `fa-IR`/`fa-AF` key-mismatch pattern across ~28 non-indexed files (P2, see Technical SEO).

---

## Action Plan

**P0 — done, no further action needed:**
- Homepage per-locale metadata + JSON-LD — Difficulty: M, Impact: High, Time: done, Risk: none (verified via `tsc --noEmit`).
- Canonical case-bug fix — Difficulty: S, Impact: High, Time: done, Risk: none.
- Sitemap rebuild (correct locales, drop dead/noindex URLs) — Difficulty: S, Impact: High, Time: done, Risk: none.
- Apex redirect path-preservation fix — Difficulty: S, Impact: Medium-High, Time: done, Risk: low (pure correctness fix; verify in staging that `hisabche.com/*` still lands where expected before relying on it for backlink equity).
- hreflang domain/RTL/og:locale fixes — Difficulty: S, Impact: Medium, Time: done, Risk: none.
- FAQ JSON-LD localization — Difficulty: S, Impact: Medium, Time: done, Risk: none.
- `/login` metadata copy-paste fix — Difficulty: S, Impact: Low-Medium, Time: done, Risk: none.

**P1 — recommended, not applied:**
- Decide fate of `/contact` and `/legal/privacy` (build the pages or remove the footer links) — Difficulty: S–M depending on choice, Impact: Medium (broken links hurt crawl trust and UX), Time: 1–4h, Risk: none if just removing links; content-dependent if building pages.
- Re-verify whether `unoptimized` can be safely removed from the two dashboard screenshots — Difficulty: S (test), Impact: Medium (LCP bytes), Time: 30min to test in a preview deploy, Risk: medium (prior comment suggests this broke something before; must verify against production image pipeline, not just local).
- Consolidate the duplicate `SoftwareApplication` JSON-LD (layout + homepage) into one source of truth — Difficulty: S, Impact: Low (cleanliness/maintainability), Time: 30min, Risk: low.
- Add `Content-Security-Policy` header — Difficulty: M (requires auditing every external script/connect source), Impact: Medium (security, indirectly trust/HTTPS signals), Time: 2–4h incl. testing, Risk: medium if scoped incorrectly (can break GTM/Analytics).

**P2 — backlog:**
- Fix the `fa-IR`/`fa-AF` → `fa`/`af` key mismatch across the ~28 remaining `noindex` pages — Difficulty: M (mechanical but many files, and the i18n migration to `next-intl` is running concurrently in this repo — coordinate to avoid churn), Impact: Low (all noindexed) but real for UX/i18n correctness, Time: 2–3h, Risk: low.
- Add `Organization` + `BreadcrumbList` structured data once there are more pages to attach breadcrumbs to — Difficulty: S–M, Impact: Low now / Medium once site grows, Time: 1–2h, Risk: none.
- Build topical/comparison content to give the existing keyword targeting something to rank — Difficulty: L (content strategy + writing), Impact: High (this is the actual traffic ceiling, everything else is table stakes), Time: ongoing, Risk: none technically, all upside is content-quality-dependent.

---

*Generated by automated technical SEO audit. Verified against actual source (not assumptions) for every file listed above; `npx tsc --noEmit` was run after edits and confirms no new type errors were introduced in any modified file.*
