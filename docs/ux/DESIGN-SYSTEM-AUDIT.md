# Hisabche UX Reconstruction — Design System Audit

> **Phase 1 Deliverable** | Generated: `2026-11-26` | Sources: `packages/design-tokens/src/`, `packages/ui/tailwind.config.ts`, `packages/ui/src/styles/globals.css`

## 1. Existing Token Architecture (Single Source of Truth)

Hisabche already has a canonical token package (`@hisabche/design-tokens`) synchronized with `packages/ui/src/styles/globals.css` via `packages/design-tokens/src/__tests__/parity.test.ts`:

- **Brand Palette (`color.ts` — Emerald/Teal v3.1, HSL triplets):**
  - `brand.primary` (`165 75% 51%`), `primaryFg` (`210 40% 8%`), `primaryHover` (`164 74% 47%`), `primaryLight` (`166 76% 63%`), `secondary` (`174 79% 28%`), `accent` (`168 78% 56%`)
- **Semantic Status Tokens:**
  - `success` (`142 72% 38%`), `warning` (`38 92% 50%`), `destructive` (`0 84% 60%`), `info` (`199 89% 48%`) with paired `*Fg` contrast tokens.
- **Dual Theme Support (`darkTheme` & `lightTheme`):**
  - **Dark-first (`darkTheme`):** `surfaceBase` (`210 33% 9%`), `surfaceMuted` (`206 28% 15%`), `surfaceElevated` (`207 30% 12%`), `fgPrimary` (`165 35% 97%`), `fgSecondary` (`168 15% 65%`), `fgTertiary` (`168 10% 56%`)
  - **Warm Light (`lightTheme`):** `surfaceBase` (`40 16% 97%`), `surfaceElevated` (`0 0% 100%`), `fgPrimary` (`220 18% 13%`), `fgSecondary` (`220 9% 40%`)
- **Fluid Typography (`scale.ts`):**
  - `hero` (`clamp(2.25rem, 5vw, 4rem)`), `h1` (`clamp(1.75rem, 4vw, 2.5rem)`), `h2` (`clamp(1.35rem, 3vw, 1.75rem)`), `h3` (`clamp(1.1rem, 2.5vw, 1.35rem)`), `body` (`clamp(0.875rem, 2vw, 1rem)`), `caption` (`0.813rem`), `legal` (`0.688rem`); `leading`: `tight: 1.2`, `normal: 1.55`, `relaxed: 1.65`.
- **Spacing, Radius, Z-Index, Motion (`scale.ts`):**
  - `space`: `1` (`0.25rem`/4px) through `24` (`6rem`/96px) with `spacePx` mirror.
  - `radius`: `xs` (`6px`), `sm` (`8px`), `md` (`12px`), `lg` (`16px`), `xl` (`20px`), `2xl` (`24px`), `full` (`9999px`).
  - `zIndex`: `base(0)`, `dropdown(10)`, `fab(15)`, `sticky(20)`, `fixed(25)`, `overlay(30)`, `modalBackdrop(35)`, `modal(40)`, `popover(45)`, `tooltip(48)`, `toast(50)`, `cmdk(55)`.
  - `motion`: `easeOut` (`cubic-bezier(0.16, 1, 0.3, 1)`), `easeSoft` (`cubic-bezier(0.4, 0, 0.2, 1)`).
- **Density (`scale.ts`):**
  - `desktop`: `rowHeight: 40`, `sidebarWidth: 224`, `toolbarHeight: 52`, `minTouchTarget: 32`
  - `web`: `rowHeight: 48`, `sidebarWidth: 264`, `toolbarHeight: 56`, `minTouchTarget: 40`
  - `mobile`: `rowHeight: 64`, `sidebarWidth: 0`, `toolbarHeight: 56`, `minTouchTarget: 44`

## 2. Token Gaps & Hygiene Issues (No New Palette Needed)

1. **No new color or typography palette is needed.** Existing `@hisabche/design-tokens` covers all required surfaces, states, and scales.
2. **Existing hygiene violations to remediate during Phase 2+ route work:**
   - Replace hardcoded hex colors in `chart.tsx` and `invoice-detail-container.tsx` with semantic/CSS variables.
   - Replace physical directional utility classes in `kpi-card.tsx` with logical properties (`ms-`/`me-`/`ps-`/`pe-`/`text-start`).
   - Replace raw `<select>` elements in `grid-cell.tsx`, `warehouse-detail-page.tsx`, and `workflow-templates-view.tsx` with `SelectField`.
   - Note: `density` tokens in `scale.ts` are defined as a contract and should be progressively applied across Desktop vs Web vs Mobile views.
