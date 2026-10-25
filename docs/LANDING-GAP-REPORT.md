# Hisabche 3D Landing Page v2 — Forensic Gap Report

This document audits the current implementation of the 3D landing page against every section of `docs/landing-v2-spec.md` and `docs/landing-3d-spec.md`.

---

## Summary Matrix

| v2 Section | Title                                 |  Status   | Gap Description / Required Action                                                                                                                                                                                                     |
| :--------: | :------------------------------------ | :-------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|   **§1**   | Executive Summary & Goals             |  `DONE`   | Zero fake metrics/testimonials; marketing claims match backend contracts (`landing-claims.test.ts`).                                                                                                                                  |
|   **§2**   | Narrative & Beat System (7 Beats)     | `PARTIAL` | 5 stations and 7 machine beats exist, but lack single source of truth in `journey.config.ts`. Needs centralization.                                                                                                                   |
|   **§3**   | Semantic HTML-First Page & Navigation | `PARTIAL` | Server-rendered H1/sub/CTA present; missing explicit skip-3D link in server markup and sticky header CTA transition on scroll past hero.                                                                                              |
|   **§4**   | Scroll Architecture & Determinism     | `PARTIAL` | Native sticky scroll works; particle effects (exhaust, sparks) rely partly on time elapsed rather than pure scroll progress $p$; missing `#beat-N` hash sync, replay CTA, and station hotspots.                                       |
|   **§5**   | DOM Overlays, Accessibility & RTL     | `PARTIAL` | Semantic overlays & RTL mirroring are functional; mobile body text needs strict 16px minimum (`text-base`); suppress speech bubble on mobile when caption is open.                                                                    |
|   **§6**   | Performance Budgets & Device Tiers    | `PARTIAL` | Currently binary `light` vs `desktop` in `runtime.ts`; needs full Tier S/A/B/C/D heuristic, 60-frame benchmark, and battery saver mode.                                                                                               |
|   **§7**   | Scene Asset & Render Optimization     | `PARTIAL` | Render pause on offscreen/hidden is done; active-station $\pm 1$ culling needs explicit matrix pass skip; canvas textures must await `document.fonts.ready`.                                                                          |
|   **§8**   | i18n & Localization in Canvas         |  `DONE`   | Full RTL flow symmetry ($flow = -1$), 3 locales (`fa-IR`, `fa-AF`, `en`), localized digits and sample financial data.                                                                                                                 |
|   **§9**   | Analytics & Experimentation Taxonomy  | `MISSING` | The 7 standardized events (`journey_view_hero`, `journey_beat_reached`, `journey_offline_sim_viewed`, `journey_core_burst_completed`, `journey_cta_clicked`, `journey_skip_clicked`, `journey_performance_tier`) are not yet emitted. |
|  **§10**   | SEO, Metadata & Structured Data       | `PARTIAL` | `SoftwareApplication` JSON-LD is active; needs `Organization`, `WebSite`, and `FAQPage` schemas in `apps/web/app/[lang]/page.tsx`.                                                                                                    |
|  **§11**   | Rollout & Feature Flags               | `PARTIAL` | Fallback exists on WebGL error; needs explicit `NEXT_PUBLIC_LANDING_3D_ENABLED` environment toggle / kill-switch in `LandingPage`.                                                                                                    |
|  **§12**   | Inconsistencies & Conflict Resolution | `PARTIAL` | Station boards formatted dynamically; need to finalize Beat 0-6 indexing and mobile bubble containment in `journey.config.ts`.                                                                                                        |
|  **§13**   | Definition of Done & Verification     | `PENDING` | Ready for end-to-end test execution and checklist delivery.                                                                                                                                                                           |

---

## Detailed Gap Analysis & Execution Plan

### Step 1: `journey.config.ts` as Single Source of Truth

- **Files to create/modify:**
  - Create: `packages/ui/src/components/ui/landing/journey/journey.config.ts`
  - Refactor: `journey-machine.ts`, `journey-shots.ts`, `journey-industries.ts`, `journey-screens.ts`
- **Actions:**
  - Define beats 0..6 with progress thresholds, labels, camera parameters, and scroll heights.
  - Export types and constants for stations, phases, and analytics events.

### Step 2: Semantic HTML-First Page & Sticky Navigation

- **Files to modify:**
  - `packages/ui/src/components/ui/landing/journey/journey-hero.tsx`
  - `packages/ui/src/components/ui/landing/landing-shell.tsx`
- **Actions:**
  - Add semantic skip-to-content `<a href="#features">` link in the server-rendered hero.
  - Ensure sticky header displays CTA when scrolled past the hero section.

### Step 3: Scroll Engine & Pure Determinism

- **Files to modify:**
  - `packages/ui/src/components/ui/landing/journey/journey-stage.tsx`
  - `packages/ui/src/components/ui/landing/journey/scene.ts`
- **Actions:**
  - Eliminate time drift: particles and lighting become pure mathematical functions of progress $p$.
  - Add `#beat-N` URL hash synchronization using `window.history.replaceState`.
  - Add replay button in the finale screen.

### Step 4: DOM Overlays & Accessibility Guard

- **Files to modify:**
  - `packages/ui/src/components/ui/landing/journey/journey-stage.tsx`
- **Actions:**
  - Enforce minimum 16px (`text-base`) for captions on mobile viewports.
  - Suppress speech bubble on mobile when station caption card is active to prevent text collisions.

### Step 5 & 6: Device Quality Tiers (S/A/B/C/D) & Optimizations

- **Files to modify:**
  - `packages/ui/src/components/ui/landing/three/runtime.ts`
  - `packages/ui/src/components/ui/landing/three/scene-canvas.tsx`
  - `packages/ui/src/components/ui/landing/journey/scene.ts`
- **Actions:**
  - Implement tier detector (`getDeviceQualityTier()`): S, A, B, C, D.
  - Add 60-frame benchmark monitoring average frame time.
  - Add active-station $\pm 1$ culling in `scene.ts`.
  - Wrap canvas board texture drawing in `document.fonts.ready`.
  - Add WebGL context loss and restoration handling (`webglcontextrestored`).

### Step 7: i18n & Canvas Flow

- Verify yaw mirroring and dynamic font loading across `fa`, `af`, `en`.

### Step 8: SEO & Structured Data

- **Files to modify:**
  - `apps/web/app/[lang]/page.tsx`
- **Actions:**
  - Add JSON-LD for `Organization`, `WebSite`, and `FAQPage`.
  - Ensure canonicals and hreflangs are clean.

### Step 9: Analytics & Event Emitter

- **Files to create/modify:**
  - Create: `packages/ui/src/components/ui/landing/journey/journey-analytics.ts`
  - Wire into `journey-stage.tsx`.

### Step 10: Tests & Debug Hooks

- **Files to create/modify:**
  - Add `window.__journey` debug object.
  - Add comprehensive unit tests in `packages/ui/src/__tests__/landing-journey-v2.test.ts`.

### Step 11: Rollout & Feature Flag Kill Switch

- **Files to modify:**
  - `packages/ui/src/components/ui/landing/landing-page.tsx`
  - Fallback to flat/static hero when `NEXT_PUBLIC_LANDING_3D_ENABLED === 'false'`.
