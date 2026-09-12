// ============================================
// packages/ui/src/components/ui/focus-ring.ts
//
// The ONE definition of the brand focus ring.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// Ten call sites across `data-table`, `invoices`, `warehouse` and `workflow`
// each wrote the same three utilities by hand:
//
//     focus-visible:ring-4 focus-visible:ring-[rgba(18,200,160,0.18)]
//     focus-visible:outline-none
//
// Two problems, one of them a real defect:
//
//   1. DUPLICATION — ten literal copies of the same string, so the ring could
//      (and did) drift: `globals.css` defines `--focus-ring` as
//      `rgba(36,224,176,0.2)`, a different teal at a different alpha, for the
//      same job on `.auth-input`.
//
//   2. ⚠️ THE HARDCODED `rgba()` IS NOT THEME-AWARE. `--color-primary` is
//      redefined under the dark and high-contrast themes; a literal
//      `rgba(18,200,160,…)` is not. So the focus ring stayed the light-theme
//      teal on every theme, while every other brand-coloured affordance beside
//      it shifted. `hsl(var(--color-primary) / 0.18)` follows the theme.
//
// ---------------------------------------------------------------------------
// ⚠️ CLASS STRINGS, NOT A COMPONENT — same reasoning as `stat-surface.ts`.
//
// The consumers are a toolbar button, three card actions, a view header and a
// pair of approval buttons. They share nothing but the ring, so the ring is
// what is shared.
//
// ⚠️ TAILWIND CANNOT PREFIX A CLASS STRING. Do not write
// `` `sm:${FOCUS_RING}` `` — that produces one nonsense class rather than
// three prefixed ones, and it fails silently by simply not styling anything.
// ============================================

/**
 * The brand focus ring: a 4px teal glow, keyboard-only.
 *
 * `focus-visible:` rather than `focus:` on purpose — a mouse click on a button
 * should not leave a glow behind, only keyboard traversal should.
 *
 * `outline-none` is paired with the ring and never used alone: removing the UA
 * outline without drawing a replacement makes the control invisible to
 * keyboard users.
 */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--color-primary)/0.18)]'
