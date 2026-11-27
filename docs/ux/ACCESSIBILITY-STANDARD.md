# Hisabche UX Reconstruction — Accessibility Standard

> **Phase 1 Deliverable** | Generated: `2026-11-26` | Reference: WCAG 2.2 AA & WAI-ARIA Authoring Practices

## 1. Baseline Measurement (`packages/ui/src/components/ui/`, 565 files)

- Files with `aria-*` attributes: `318`
- Files with `focus-visible` styling: `54` (shared ring token in `focus-ring.ts`)
- Files with `sr-only` labels: `23`
- Files respecting `prefers-reduced-motion` / `motion-reduce`: `95`

## 2. Mandatory Per-Route Acceptance Checks (Phase 2+)

1. **Keyboard & Focus:** Every interactive control (buttons, tabs, `SegmentedControl`, `DataTable` rows/actions, `Dialog`/`Sheet` triggers & close) must be reachable via `Tab`/`Shift+Tab`, support `Enter`/`Space`/`Escape`, and display `focus-ring.ts` (`focus-visible`).
2. **Semantic Structure & Landmarks:** One `<main>` inside the shell, proper heading hierarchy (`h1` -> `h2` -> `h3`), native `<button>`/`<a>` rather than clickable `<div>`.
3. **Form Labels & Errors:** Every `Input`, `MoneyInput`, `PhoneInput`, `SelectField`, `Textarea` must have an associated `<Label>` (`htmlFor`) and `aria-invalid` / `aria-describedby` for server/Zod validation errors.
4. **Contrast & Color Independence:** Never convey status (`success`, `warning`, `destructive`) by color alone—pair with text/icon `Badge`. Maintain >= 4.5:1 text contrast in both `darkTheme` and `lightTheme`.
5. **Touch Targets & Motion:** >= `44px` on mobile (`< md`), and respect `prefers-reduced-motion` on all transitions/skeletons.
6. **Note on Claims (§3.4):** Accessibility compliance is never claimed from static inspection alone; each route requires keyboard/DOM verification during its Phase 2/3+ gate.
