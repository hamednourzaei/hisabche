# PHASE 2 — STAGE 1: CANONICAL DESIGN TOKENS

**Status: complete.** `packages/design-tokens` exists, is held to `globals.css` by an
executable parity test, and is **consumed by nothing yet**. Zero visual change.

---

## Correction to Phase 1.5 (third one)

**"Desktop has no tokens" was wrong.** `apps/desktop/src/styles.css` line 2 reads:

```css
/* Desktop reuses the production web design system verbatim. */
@import '@hisabche/ui/globals.css';
```

Desktop already consumes the full canonical token set and adds only four density
variables on top (`--row-height: 40px`, `--sidebar-width: 248px`,
`--sidebar-width-collapsed: 64px`, `--toolbar-height: 52px`).

This changes the architecture picture materially. The real situation is:

```
globals.css (canonical)
   ├──► packages/ui   — imports directly          ✅ single source
   ├──► apps/desktop  — @import's it              ✅ single source
   └──► mobile-ui     — HAND-COPIED TypeScript    ⚠️  the only true fork
```

Web and desktop were never diverging on tokens. **Mobile is the only fork — and it has
already drifted.**

---

## The drift, found and now locked

`packages/mobile-ui/src/tokens/colors.ts` is a manual port. Comparing it token by token:

| Group                | Result                 |
| -------------------- | ---------------------- |
| Brand (8)            | ✅ exact               |
| Semantic (8)         | ✅ exact               |
| **Dark theme (11)**  | ✅ exact               |
| **Light theme (10)** | ❌ **8 of 10 diverge** |

| Token             | Canonical (`globals.css`)     | Mobile (stale)              |
| ----------------- | ----------------------------- | --------------------------- |
| `surfaceBase`     | `40 16% 97%` — warm off-white | `hsl(168, 25%, 98%)` — teal |
| `surfaceMuted`    | `40 12% 94%`                  | `hsl(166, 22%, 95%)`        |
| `surfaceOverlay`  | `40 14% 96%`                  | `hsl(166, 22%, 95%)`        |
| `fgPrimary`       | `220 18% 13%` — cool grey     | `hsl(210, 33%, 9%)`         |
| `fgSecondary`     | `220 9% 40%`                  | `hsl(174, 15%, 38%)`        |
| `fgTertiary`      | `220 7% 55%`                  | `hsl(168, 8%, 53%)`         |
| `borderDefault`   | `40 10% 88%`                  | `hsl(166, 22%, 87%)`        |
| `borderStrong`    | `40 10% 79%`                  | `hsl(166, 22%, 77%)`        |
| `glassBg`         | `rgba(255,255,255,0.78)`      | `rgba(255,255,255,0.82)`    |
| `surfaceElevated` | `0 0% 100%`                   | ✅ agrees                   |

**Cause.** Web's light theme was deliberately re-tuned in v3.1 — the Persian comment in
`globals.css` explains the move to a warm, low-saturation off-white (hue 40) inspired by
Linear/Notion/Vercel, with pure-white cards lifting off it. Mobile never received that
update and still runs the older teal-tinted light theme.

**Not fixed in this stage.** Aligning mobile's light theme is a _visible change to the
mobile app_ and needs sign-off. It is now recorded as a failing-when-fixed ratchet test
(see below) rather than a note somebody has to remember.

---

## What was built

```
packages/design-tokens/          zero dependencies, zero JSX, zero framework
├── src/color.ts       brand · semantic · darkTheme · lightTheme · gradients · focusRing
├── src/scale.ts       typography · leading · space · radius · motion · zIndex · density
├── src/css.ts         hsl() · hsla() · cssVars(theme) · resolvedColors(theme)
├── src/index.ts
└── src/__tests__/
    ├── parity.test.ts        87 tests — parses globals.css + desktop styles.css
    └── mobile-drift.test.ts  34 tests — parses mobile-ui/tokens/colors.ts
```

**Design choices**

- Colours are stored as bare HSL triplets (`165 75% 51%`) because that is the shape
  Tailwind's `hsl(var(--x) / <alpha-value>)` needs. `hsl()` converts to a string both
  DOM and React Native parse.
- `typography` carries both the CSS `clamp()` expression and resolved `minPx`/`maxPx`,
  because React Native cannot parse `clamp`.
- `space`/`radius` ship in rem **and** px (`spacePx`, `radiusPx`) — RN has no rem.
- `cssVars()` emits the exact variable names `globals.css` uses today, **including the
  legacy `--hisab-*` aliases**, so the ~80 components referencing them keep working when
  Stage 2 wires it up.
- **Z-index and density are now first-class tokens.** Both were flagged missing in Phase
  1.5. Z-index values are transcribed from `globals.css`; desktop density is lifted
  verbatim from `apps/desktop/src/styles.css`, so nothing moves.
- `density.web` and `density.mobile` are **declared but unused** — the contract is
  complete, applying them is a later, visible change.

**The parity test is the deliverable, not the token file.** A transcription nobody checks
is just a second source of truth waiting to drift — which is exactly what happened to
mobile-ui. `parity.test.ts` reads the real `globals.css` at test time and compares every
brand, semantic, surface, text, border, type, spacing, radius, z-index, motion and
gradient value in both themes. Neither side can move without a red test.

---

## Results

| Suite                     | Tests          | Note                       |
| ------------------------- | -------------- | -------------------------- |
| `@hisabche/design-tokens` | **121 passed** | new — 87 parity + 34 drift |
| `@hisabche/desktop`       | 43 passed      | unchanged                  |
| `@hisabche/mobile`        | 45 passed      | unchanged                  |
| `@hisabche/ui`            | 39 passed      | unchanged                  |
| `@hisabche/backend`       | 5 passed       | unchanged                  |
| **Total**                 | **253 passed** |                            |

`type-check` clean. All 87 parity assertions passed on the **first** run, which is the
evidence that the transcription is exact rather than approximately right.

---

## Bundle / performance impact

**None.** Nothing imports `@hisabche/design-tokens` yet. No CSS was modified, no
component changed, no build output differs.

---

## New risks

1. **Two sources of truth exist right now, on purpose.** `globals.css` is still what the
   browser loads; the TS package is a checked mirror. That is safe _only_ while the
   parity test runs in CI. It does — `packages/*` is in `pnpm-workspace.yaml` and the
   package declares a `test` script, so `turbo run test` picks it up.
2. **Mobile light-theme alignment is an unresolved product decision.** Until it is made,
   mobile light mode looks different from web light mode.
3. **`density.web` / `density.mobile` are guesses**, not measured from existing CSS.
   They are unused, but they must be verified against real layout before anything
   consumes them.
4. `radius.sm/md/xl/2xl` and the full type scale existed in `globals.css` but were
   missing from my Phase 1.5 audit, which under-reported token coverage.

---

## Next — Stage 2 (token consumption)

Now much smaller than planned, because web and desktop already share `globals.css`:

1. Point `packages/mobile-ui/src/tokens/colors.ts` at `@hisabche/design-tokens`,
   preserving today's mobile values via an explicit override for the eight drifted light
   tokens — so Stage 2 stays visually neutral and the alignment becomes its own reviewed
   change.
2. Replace desktop's four hardcoded density vars with `density.desktop` (identical
   values — the parity test proves it).
3. Leave `globals.css` as the DOM source until there is a visual-regression check worth
   trusting. Generating it from `cssVars()` is possible but not yet worth the risk.

**Stage 1 is complete and visually neutral.**
