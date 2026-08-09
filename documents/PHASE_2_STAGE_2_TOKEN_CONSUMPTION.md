# PHASE 2 — STAGE 2: TOKEN CONSUMPTION

**Status: complete.** Mobile now derives its tokens from the canonical source.
**Zero rendered colours changed** — proved, not asserted. Mobile light mode is untouched.

Constraints honoured: no EUR, no schema change, no backend change, no exchange-rate
change, `globals.css` still the DOM source of truth and still loaded by the browser.

---

## Method — freeze, then migrate

Same discipline as Stage 0. Before editing `colors.ts`, its exports were **executed** and
serialised, then written as explicit literals in
`packages/mobile-ui/src/tokens/__tests__/colors.snapshot.test.ts` (67 assertions, both
themes, every key).

- Baseline captured against the **old** hand-copied file → 67 passed.
- File rewritten to derive from `@hisabche/design-tokens`.
- Same 67 assertions re-run against the **new** implementation → 67 passed, unchanged.

That is the proof the migration is visually neutral. The literals are hand-written rather
than a jest snapshot file specifically so they cannot be silently regenerated with `-u`.

---

## What changed

### Mobile — the only real work

`packages/mobile-ui/src/tokens/colors.ts` was a hand-copied port. Now:

| Group                             | Before    | After                                                                                      |
| --------------------------------- | --------- | ------------------------------------------------------------------------------------------ |
| Brand (6)                         | hardcoded | **derived** from `brand`                                                                   |
| Semantic (8)                      | hardcoded | **derived** from `semantic`                                                                |
| Dark theme (11)                   | hardcoded | **derived** from `darkTheme`                                                               |
| `*Soft` tints + `scrim` (6/theme) | hardcoded | still literal — **no web counterpart exists**; the web composes these inline per component |
| Light theme (11)                  | hardcoded | still literal, in an explicit `LEGACY_LIGHT` block                                         |

`@hisabche/mobile-ui` now declares `@hisabche/design-tokens` as a dependency.

**New helper: `hslLegacy()`.** Canonical `hsl()` emits the modern space-separated form
(`hsl(165 75% 51%)`). React Native's colour parser is not guaranteed to accept that on
every engine, and the previous mobile values used the comma form. `hslLegacy()` emits
`hsl(165, 75%, 51%)` — identical colour, byte-identical to what mobile rendered before.
This is why the snapshot passes unchanged.

### Desktop — no change was correct

Investigated and deliberately left alone:

- Desktop already consumes the full canonical set: `apps/desktop/src/styles.css` line 2 is
  `@import '@hisabche/ui/globals.css'`.
- Its four density variables are consumed **only** through CSS `var()`
  (`sidebar.tsx:95,103`, `toolbar.tsx:27`). Routing them through TypeScript would need
  runtime injection or a build step — churn with a visual-regression risk and no gain,
  since `parity.test.ts` already fails if those CSS values and `density.desktop` diverge.
- A sweep for hardcoded colours in desktop TS found **5**, all in
  `shared/print/invoice-template.ts`. Print output must be ink-appropriate and standalone;
  feeding it dark-theme tokens would print black pages. Correctly left hardcoded.

### Web — no change, by instruction and by fact

`globals.css` remains the file the browser loads. `@hisabche/design-tokens` is a checked
mirror, not a replacement. Removing or generating `globals.css` is explicitly **not** part
of this stage.

---

## The drift ratchet moved and got sharper

The Stage 1 drift test parsed `colors.ts` as **text**, which the refactor would have
broken. It was deleted and replaced by
`packages/mobile-ui/src/tokens/__tests__/canonical-drift.test.ts`, which **imports** both
sides. No dependency cycle: `mobile-ui → design-tokens` only.

It now asserts three things:

1. **Derived stays derived** — brand, semantic and the whole dark theme equal canonical.
   Goes red if anyone hardcodes a value back in.
2. **The light theme still diverges** — 8 stale tokens, asserted by name.
3. **Exactly 8, no more and no fewer** — a count assertion, so partial alignment or new
   drift both fail.

Fails in both useful directions: further drift → red; alignment → red, with instructions
to delete `LEGACY_LIGHT` and derive from `lightTheme`.

---

## Results

| Suite                     | Tests          | Δ                             |
| ------------------------- | -------------- | ----------------------------- |
| `@hisabche/design-tokens` | 87             | −34 (drift suite relocated)   |
| `@hisabche/mobile`        | **147**        | +102 (67 snapshot + 35 drift) |
| `@hisabche/ui`            | 39             | —                             |
| `@hisabche/desktop`       | 43             | —                             |
| `@hisabche/backend`       | 5              | —                             |
| **Total**                 | **321 passed** |                               |

`type-check` clean on `design-tokens`, `mobile-ui`, `desktop`, and `apps/mobile`
(`tsc --noEmit`, exit 0) — the new workspace dependency resolves correctly.

---

## Bundle / performance impact

Negligible and structural only. `colors.ts` went from literal strings to ~30 `hslLegacy()`
calls evaluated once at module load. No new runtime dependency reaches the bundle —
`design-tokens` is plain data plus pure string functions, no framework, no polyfill.

---

## New risks

1. **`hslLegacy` is a second colour-string format in the codebase.** Web/desktop use
   space-separated via CSS vars; mobile uses comma-separated. Both are correct for their
   platform, and the canonical triplet is the single source behind both — but a future
   reader may see two formats and assume drift. The function is documented for this.
2. **`*Soft` tints and `scrim` are still mobile-only literals.** They have no canonical
   home because the web has no equivalent named tokens. If the web ever grows them, they
   must be promoted to `design-tokens`, not duplicated.
3. **Mobile light mode still differs from web light mode** — unchanged, intentional,
   now enforced by test rather than memory.
4. **Two sources of truth remain by design** (`globals.css` + `design-tokens`), safe only
   while `parity.test.ts` runs in CI. It does.

---

## Next

Stage 3 — semantic UI contract (`packages/ui-contract`, types only, zero runtime).

The separate, reviewable change now unblocked and ready when wanted: **align mobile light
mode to canonical.** It is nine lines in `LEGACY_LIGHT`, and the ratchet test will tell
whoever does it exactly what to delete.

**Stage 2 is complete and visually neutral.**
