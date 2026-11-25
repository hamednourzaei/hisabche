# 15 — Accessibility (WCAG 2.2 AA), i18n & RTL Audit

> **Standards:** W3C WCAG 2.2 Level AA, Hisabche RTL & Design-Token Rules
> **Execution Date:** 2026-11-25

## 1. Automated Checks

- **i18n Parity (`fa` / `af` / `en`):** `packages/i18n` `2/2` files, `29/29` tests (`PASS`); `scripts/audit-unified-offline-i18n.mjs` `0` violations.
- **Design Token Existence:** `packages/ui/src/__tests__/design-token-existence.test.ts` `3/3 PASS` after fixing `QA-001` (`settings-page.tsx:719` `--fg-on-accent` -> `--color-destructive-fg`).
- **UI Static Scan (`packages/ui/src/components/ui`):** `0` actual raw `<select>` elements in JSX (case-sensitive check; earlier `/i` scan matched Radix `<Select>` and comments) and `0` actual JSX physical `left`/`right` classes (only 1 match in `kpi-card.tsx:299`, which is a comment).

## 2. Live Browser & Assistive Tech Status

- Live Playwright + axe-core WCAG 2.2 AA contrast/keyboard/focus-trap audit was not executed in a running browser (`UNVERIFIED_LIVE`).
