---
name: hisabche-web
description: Working in apps/web outside a screen — the root layout, providers, locale-prefixed routing, metadata, canonicals, sitemap, structured data or anything about what the served HTML actually contains. Use for SSR, rendering and SEO questions.
---

# apps/web — rendering, routing and metadata

Screens themselves live in `packages/ui` — see the `hisabche-ui` skill. This
skill is about the shell around them and the HTML that reaches a crawler.

## Never disable SSR above a screen

`next/dynamic(..., { ssr: false })` and a `lazy()` component are fine for a
widget. Applied anywhere the whole app tree passes through — the root layout,
providers, an error boundary — they empty every public page.

`apps/web/app/[lang]/client-error-boundary.tsx` did exactly this and the entire
site served:

```html
<body>
  <div hidden><!--$--><!--/$--></div>
</body>
```

No `<h1>`, no copy, no crawlable `<a>`. Only the RSC payload had content.
`apps/web/app/[lang]/providers.tsx` had the same shape via
`<Suspense fallback={<>{children}</>}>` around a `lazy()` provider. Children now
render **outside** the lazy boundary. If a provider must be lazy, pass children
through it, do not render them inside the fallback path.

**Why it survived review:** title, canonical, hreflang and JSON-LD come from the
Metadata API into `<head>`, so source review and a `curl` of `<head>` both
looked perfect. Only the rendered `<body>` showed the problem.

## Verifying rendered HTML

Check the `<body>`, not the source and not `<head>`:

```bash
export MSYS_NO_PATHCONV=1     # Git Bash rewrites /fa/about into a Windows path
curl -s http://localhost:3039/fa/about | sed -n '/<body/,/<\/body>/p' | head -40
curl -s http://localhost:3039/fa/about | grep -o '<a href' | wc -l
```

`grep -c` counts **lines**, and minified HTML is one line — it will report `1`
for a page with fifty links. Use `grep -o | wc -l`.

## Locales are always in the URL

`apps/web/proxy.ts` sets next-intl `localePrefix: 'always'` — the default `fa`
is prefixed too. Code assuming `/about` serves Persian produces canonicals and
sitemap entries pointing at 307 redirects, and internal links that drop the
locale so Accept-Language picks the destination.

Use the helpers in `apps/web/app/[lang]/i18n-config.ts` rather than re-deriving:
`SITE_URL`, `resolveLocale`, `localePath`, `localeUrl`, `languageAlternates`,
`localeToBcp47`, `localeMeta`.

The route segment `af` is **not a valid BCP-47 tag** — `af` is Afrikaans. Dari
is `fa-AF`. That applies to `<html lang>`, `hreflang` and schema.org
`inLanguage`; run the segment through `localeToBcp47` every time.

## Metadata merging

Next merges metadata **field by field**: a child's `robots: {...}` replaces the
parent's whole object, nested `googleBot` included. So declare `noindex` once at
the route-group layout that owns the area — see
`apps/web/app/[lang]/(dashboard)/layout.tsx` — instead of hoping every page
remembers, and expect a child that sets `robots` at all to lose the inherited one.

## Structured data must match the served HTML

Never emit schema for content that is not in the rendered `<body>`, and never
fabricate ratings, reviews or counts. Both shipped here: a landing-page
`aggregateRating` of 4.9/340 when the codebase has no rating system at all — a
Google spam violation risking a manual action — and FAQ JSON-LD declaring 16
Q&As while only 6 were in the DOM (the rest sat behind a "show all" toggle and
were never rendered).

If the JSON-LD and the DOM disagree, fix the JSON-LD, not the count.

## Serving a production build

`apps/web` uses `output: 'standalone'`, so `next start` warns and misbehaves:

```bash
node scripts/copy-standalone-assets.js
node .next/standalone/apps/web/server.js
```

A stale `next start`/standalone process holds `.next/` and the next build fails
with `EBUSY: resource busy or locked`. Kill that specific PID — see the process
rule in CLAUDE.md.

## Common mistakes

- `ssr: false` or `lazy()` anywhere the app tree passes through.
- Reviewing `<head>` or source and calling the rendering verified.
- `grep -c` on minified HTML.
- Building a URL without the locale prefix, or emitting `hreflang="af"`.
- JSON-LD describing content the page does not render.

## SEO and landing rules (September 2026, each from a real defect)

- **No default canonical in a root layout.** `app/[lang]/layout.tsx` set
  `alternates.canonical` → every noindex dashboard page declared the home page
  as canonical. Each indexable page sets its own (page.tsx, legal-metadata.ts,
  features/[slug]).
- **robots.ts lists every `(dashboard)` route.** Guard:
  `packages/ui/src/__tests__/robots-dashboard-routes.test.ts`.
- **Page titles carry no brand** — the layout template appends `| حسابچه`.
- **Links from public pages into the app get `rel="nofollow"`**; internal links
  always carry the locale prefix (a bare `/features/x` is a 307 chain).
- **Verify SEO with a crawl of the production build** that honours robots.txt
  and nofollow (scratchpad `crawl.mjs` pattern), not by reading source.
- **Public pages ship a message subset**: `PublicPageMessagesLayout` in
  `scoped-messages.tsx` (guard `public-page-message-keys.test.ts`). The full
  catalogue is ~160 KB per page.
- **Landing sections are server components.** Decorative arrows/ticks are CSS
  characters, not lucide icons (DOM budget ~1500). `prefetch={false}` on every
  landing link. No `<Suspense>` around the page.
- **Every claim on the landing, FAQ and meta must exist in code.** Guard:
  `landing-claims.test.ts` scans the landing messages of all three locales.
- **Whitelists next to their consumer need a guard**: `SectionId` in
  `use-scroll-narrative-store.ts` silently ignored renamed sections.
