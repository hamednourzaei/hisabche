# Hisabche 3D Landing Page v2 Master Specification

**Conversion, Narrative, Accessibility, Performance, SEO, Analytics, QA & Rollout**

---

## 1. Executive Summary & Goals

The Hisabche 3D Landing Page presents an interactive, high-converting journey of a single sale flowing through an offline-first business operating system (POS, cash register, inventory & loading dock, double-entry ledger, reporting, central data core).

### Core Goals:

1. **Conversion:** Increase free workspace registrations with prominent primary CTAs, a persistent sticky header CTA, clear reassurances (30-second signup, no credit card, offline-ready), and zero friction.
2. **Product Truth & Positioning:** Zero fabricated testimonials, fake metrics, or placeholder logos. All marketing claims map directly to shipped capabilities in `@hisabche/validation` and backend domain services.
3. **Inclusive Performance:** Smooth 60 FPS performance across device tiers (Tier S to Tier D) with automatic degradation, battery awareness, reduced motion support, and full no-JS accessibility.
4. **HTML-First & SEO Superiority:** Search engines and accessibility screen readers receive 100% semantic server-rendered markup without requiring WebGL or client-side JavaScript.

---

## 2. Narrative & Beat System (7 Beats)

The story is structured into exactly 7 sequential beats (Beats 0 through 6), each representing a critical operational milestone:

1. **Beat 0 — The Invoice Origin (The Printer):**
   - _Theme:_ Creation of the sale document.
   - _Visual:_ Real-time printing of a sample invoice emerging from a precision printer slot.
   - _Key Action:_ User begins scroll; agent robot stands ready.
2. **Beat 1 — Instant Payment (Pay Station):**
   - _Theme:_ Modern multi-currency POS payment.
   - _Visual:_ Terminal on stainless steel stand, keypad, interactive card swipe, status LED.
   - _Ledger Effect:_ Customer receivables & payment verification.
3. **Beat 2 — Cash & Till Management (Cash Register):**
   - _Theme:_ Strict cash drawer accountability.
   - _Visual:_ Sloped register keyboard, overhead customer pole display, animated cash drawer sliding open to reveal gold coins and sorted banknotes.
   - _Ledger Effect:_ Till balance update and cash receipt journal entry.
4. **Beat 3 — Stock Movement & Dispatch (Stock Rack & Loading Dock):**
   - _Theme:_ Real-time inventory tracking and delivery dispatch.
   - _Visual:_ 3-tier warehouse racking; central carton lifted by hydraulic platform, loaded into delivery van; barrier gate opens, van departs with exhaust puffs.
   - _Offline Simulation:_ Connection drops to offline mode (lighting dims, amber warning); local processing continues smoothly; network restores with a glowing green wave sweep.
5. **Beat 4 — Double-Entry Accounting (Ledger Desk):**
   - _Theme:_ Mathematical balance ($Debit = Credit$).
   - _Visual:_ Open leather-bound ledger on lectern with silk ribbon, debit and credit balance verification.
   - _Ledger Effect:_ Formal posting to journal lines with automated reconciliation.
6. **Beat 5 — Executive Business Intelligence (Report Desk):**
   - _Theme:_ Instant profit, margin, and trend analysis.
   - _Visual:_ Ergonomic monitor station; multi-column animated bar charts rising dynamically as transaction settles.
7. **Beat 6 — Unified Data Core & Invitation (The Core Burst):**
   - _Theme:_ Seamless consolidation of all business operations.
   - _Visual:_ Central crystalline icosahedron core surrounded by 3 rotating gyroscope rings and 12 protective fins; invoice merges into core, triggering an energetic 420-spark burst and transitioning into a quiet, warm closing invitation.

---

## 3. Semantic HTML-First Page Structure & Sticky Navigation

The page renders a complete, accessible semantic HTML structure on the server before client hydration:

- **Hero Area:** Semantic `<h1>`, subtitle, primary CTA («شروع رایگان»), secondary CTA («مستندات و راهنما»), and skip-3D link.
- **Sticky Header CTA:** A lightweight, non-obtrusive bar with the logo, navigation pills, and an action button appearing once the user scrolls past the hero.
- **Post-Journey Modules:**
  1. _Modules Scene (01):_ Comprehensive 4-pillar ledger of modules (Finance, Sales, Operations, Management).
  2. _Offline Capability (02):_ Deep dive into SQLite local engine, sync queue, and conflict resolution.
  3. _Trades & Industries (03):_ Business types Hisabche is built for (Retail, Wholesale, Manufacturing, Services).
  4. _AI Assistant (04):_ Four bounded read-only analytical capabilities.
  5. _Trust & Security (05):_ Workspace isolation, RBAC capabilities, segregation of duties, audit trails.
  6. _Comparison Matrix (06):_ Old scattered methods vs. unified Hisabche operating system.
  7. _Pricing & Editions (07):_ Real plans from `/api/billing/plans` with Online vs. Offline edition selector.
  8. _Frequently Asked Questions (08):_ Native `<details>/<summary>` accordion with structured FAQPage schema.
  9. _Final CTA (09):_ High-contrast closing statement.
  10. _Site Footer:_ Crawlable links to documentation, legal terms, and feature landing pages.

---

## 4. Scroll Architecture & Determinism

- **Native Scrolling:** Canvas pinned via sticky viewport container (`sticky top-0 h-dvh`); no hijacked touch or wheel listeners.
- **Pure Function of Progress:** Every visual state (exhaust particles, sparks, offline wave, gate angles, light dimming) is calculated as a deterministic function of scroll progress $p \in [0, 1]$. Reverse scrolling or jumping via URL hash renders identical frames without desynchronization.
- **Navigation Controls:**
  - Clickable progress indicators / dots for direct jumping to any beat.
  - `#beat-0` to `#beat-6` URL hash synchronization.
  - Station hotspot markers with contextual tooltip previews.
  - Replay and skip buttons.

---

## 5. DOM Overlays, Accessibility & RTL

- **Semantic Overlays:** Station titles, descriptions, and clerks' speech bubbles reside in standard semantic DOM elements with `aria-live="polite"` and `role="status"`.
- **Safe Zone Positioning:** Overlays are constrained outside `journeyState.free` to prevent obscuring 3D interactive subjects.
- **RTL Logical Layout:** Logical CSS properties (`start-`, `end-`, `ms-`, `me-`, `text-start`, `text-end`); text direction mirrors naturally for `fa-IR`, `fa-AF`, and `en`.
- **Minimum Font Sizes:** Never below 16px on mobile devices for body/captions to guarantee readability without zooming.
- **Color Independence:** Status is never communicated by color alone (always paired with icons, checkmarks `✓`, or text badges).

---

## 6. Performance Budgets & Device Quality Tiers

Dynamic device adaptation ensures battery-friendly, high-performance rendering:

### Quality Tiers:

| Tier  | Criteria                                | Target FPS  | Pixel Ratio |    Shadows    | Ambient Reflection | Antialias | Max Sparks |
| :---: | :-------------------------------------- | :---------: | :---------: | :-----------: | :----------------: | :-------: | :--------: |
| **S** | High-end Desktop (GPU > 4GB, Cores > 8) |     60      |     2.0     |   PCF Soft    |     PMREM Room     |  MSAA 4x  |    420     |
| **A** | Standard Desktop / M1+ Mac              |     60      |    1.75     | Basic Shadow  |     PMREM Low      |  Fast AA  |    300     |
| **B** | High-end Mobile / Modern iPad           |     60      |     1.5     | Contact Discs |        Off         |   SMAA    |    200     |
| **C** | Budget Mobile (<= 4 Cores)              |    30-60    |    1.25     | Contact Discs |        Off         |    Off    |    120     |
| **D** | Low-end Mobile / Battery Saver          | Static / 30 |     1.0     |      Off      |        Off         |    Off    | 0 (Static) |

### Core Web Vitals Budgets:

- **LCP (Largest Contentful Paint):** $\le 2.0$s (driven by semantic HTML hero before 3D initializes).
- **TBT (Total Blocking Time):** $\le 150$ms.
- **CLS (Cumulative Layout Shift):** $\le 0.05$.
- **Draw Calls:** $\le 45$ calls per frame (using `InstancedMesh`).
- **Triangle Count:** $\le 85,000$ triangles per frame.

---

## 7. Scene Asset & Render Optimization

- **Active-Station Culling ($\pm 1$):** Stations outside the immediate window ($\text{active} \pm 1$) are culled from matrix calculations and hidden from render passes.
- **Offscreen & Idle Freezing:** `IntersectionObserver` halts render loops when canvas scrolls out of view; `document.hidden` halts rendering in background tabs.
- **Font-Ready Repaints:** Canvas textures for station boards and trade boards only paint when `document.fonts.ready` resolves.
- **Clean Teardown (Dispose):** Full recursive geometry, material, texture, and WebGL context disposal on route navigation, locale switch, or replay.

---

## 8. Internationalization & Localization in Canvas (i18n)

- **Three Supported Locales:** Persian (`fa-IR`), Dari (`fa-AF`), and English (`en-US`).
- **Flow Symmetry:** In RTL locales (`fa-IR`, `fa-AF`), camera yaw, workstation placement, and road trajectories invert via `flow = -1`.
- **Formatted Typography:** Canvas text rendering uses native system fonts with proper Persian/Dari digits (`۱ ۲ ۳`) and correct number formatting.
- **Sample Financial Data:** All figures in the demo invoice and station boards are strictly fictional sample data with zero unverified commercial claims.

---

## 9. Analytics & Experimentation Taxonomy

Standardized event emission for funnel analysis and performance monitoring:

- `journey_view_hero`: User views the landing hero.
- `journey_beat_reached`: Fired with `{ beat: number, stationId: string, progress: number }`.
- `journey_offline_sim_viewed`: User witnesses the offline disconnect & reconnection wave.
- `journey_core_burst_completed`: User completes the 3D journey to the core explosion.
- `journey_cta_clicked`: Primary or secondary conversion click with `{ location: 'hero' | 'header' | 'finale' | 'footer' }`.
- `journey_skip_clicked`: User skips the 3D journey.
- `journey_performance_tier`: Emitted with `{ tier: 'S'|'A'|'B'|'C'|'D', fps: number, dropRate: number }`.

---

## 10. SEO, Metadata & Structured Data

- **Structured Data (JSON-LD):**
  - `Organization` (name, URL, logo, contactPoint).
  - `WebSite` (canonical URL, search action).
  - `SoftwareApplication` (category: BusinessApplication, operatingSystem: Web, iOS, Android, pricing currency).
  - `FAQPage` (all questions and answers aligned with visible copy).
- **OpenGraph & Twitter Card:** Dynamic localized meta tags with high-res poster preview of the 3D journey.
- **Hreflang Alternates:** Clean canonicals for `/fa`, `/af`, `/en` without redirect hops or trailing slashes.

---

## 11. Rollout & Feature Flags

- **Kill Switch:** Environment / config toggle (`NEXT_PUBLIC_LANDING_3D_ENABLED=true|false`). When disabled, the page cleanly renders a high-speed fallback hero with optimized static imagery.
- **Graceful Fallback:** Automatic transition to static fallback if WebGL is unavailable or context creation fails twice.

---

## 12. Inconsistencies & Conflict Resolution (Pre-v2 Discrepancies)

The following legacy discrepancies are explicitly resolved by this v2 specification:

1. _Discrepancy 1:_ `journey-machine.ts` defined 5 stations (`pay`, `cash`, `stock`, `post`, `report`), while UI chapter sections had 7.
   _Resolution:_ The 3D journey machine strictly has **7 beats** (Beat 0: Printer, Beats 1-5: The 5 stations, Beat 6: The Core Burst). Subsequent marketing scenes downpage handle extra thematic chapters.
2. _Discrepancy 2:_ Station boards carried hardcoded currency assumptions.
   _Resolution:_ Station boards and demo data format currency dynamically via `formatDemoAmount` based on active locale (`toman` vs `afghani` vs `USD`).
3. _Discrepancy 3:_ Static scenes used divergent container max-widths (`max-w-4xl` vs `max-w-7xl`).
   _Resolution:_ All post-journey sections share `LANDING_CONTAINER` (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-10`) with centered section headers.
4. _Discrepancy 4:_ Mobile speech bubble and caption overlap.
   _Resolution:_ Speech bubble anchor is bounded and suppressed in mobile view when caption card is active; clerk line displays inside caption on small screens.

---

## 13. Definition of Done & Verification Checklist

Every item must pass before deployment:

- [ ] `journey.config.ts` established as the single source of truth.
- [ ] Server-rendered semantic HTML hero and post-journey sections pass no-JS audit.
- [ ] Scroll progress calculation is 100% deterministic under forward, reverse, and jump scrubbing.
- [ ] DOM overlays pass WCAG AA contrast and keyboard accessibility.
- [ ] Device tier manager successfully benchmarks and classifies hardware into S/A/B/C/D.
- [ ] Active-station $\pm 1$ culling active; draw calls $\le 45$.
- [ ] i18n in canvas properly mirrors in RTL and formats digits for `fa`, `af`, `en`.
- [ ] Structured JSON-LD validates with zero errors.
- [ ] Analytics events fire accurately at each milestone.
- [ ] TypeScript typecheck (`npx tsc --noEmit`) passes with 0 errors across touched packages.
- [ ] Vitest unit and integration test suites pass 100%.
