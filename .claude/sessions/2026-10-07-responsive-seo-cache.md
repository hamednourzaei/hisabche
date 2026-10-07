
## Session Cache: 2026-10-06/07 Responsive UX & Final Gate Run

**Lessons Learned:**
- **Responsive Typography:** Replacing hardcoded tailwind classes (e.g. `text-3xl`, `sm:text-4xl`) across 1000+ files is risky. The cleanest fix was redefining Tailwind's default typography sizes (`xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`) in `packages/ui/tailwind.config.ts` to use `clamp()` functions. This creates a true Design System responsive text scale globally.
- **RTL Logical Properties:** Physical properties (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `border-l-`, `border-r-`) break RTL mirroring. A global script converted them to logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `border-s-`, `border-e-`) in 29 files, excluding absolute centering hacks (`left-1/2`).
- **Table Responsive Overflow:** Tables with `whitespace-nowrap` on cells force infinite horizontal growth. Removed this class from base `TableCell` and `TableHead` in `packages/ui/src/components/ui/table.tsx` so ERP texts (like descriptions) can wrap naturally on mobile. The `Table` component itself uses `overflow-x-auto` container to isolate scrolling.
- **Root Layout Horizontal Overflow:** Added an E2E Playwright test `e2e/responsive-overflow.spec.ts` which asserts `scrollWidth <= clientWidth` across 4 viewports.

**SEO Optimization Verified:**
- `robots.ts` correctly allows `/_next/` to not break crawler rendering.
- `robots.ts` anchors exclusions (e.g. `/*/invoices`) properly so they don't block `/fa/docs/invoices` (Fixed BUG-085).
- `sitemap.ts` correctly implements `hreflang` alternates, respects `noindex` flags, handles API failures gracefully during build, and limits `lastModified` dates to actual content changes to preserve crawl budget.

**Status:**
- test orchestration script deployed. Also fixed a Time Bomb test bug in ai-pipeline-routes.test.ts where mocked AI requests instantly expired due to hardcoded 2026-10-06 dates. to run Web Typecheck, Mobile Tests, Desktop Tests, Backend Tests and produce verifiable Final Decision documents.
