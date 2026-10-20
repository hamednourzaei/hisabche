// ============================================
// Money primitives for the backend.
//
// ⚠️ THE IMPLEMENTATION MOVED to `packages/validation/src/schemas/money.ts`
// (Phase 2 of the offline edition, 19 Oct 2026). The device needs the same
// rounding and the same comparison, and a rule that exists twice is the bug
// this repository has fixed a hundred times.
//
// This file stays because it is the name five modules and nine call sites
// already import from, and a consolidation that breaks eleven call sites to win
// four lines is not a consolidation. It declares nothing: the one
// implementation is in the shared package.
//
// ⚠️ WHY IT WAS EVER A SEPARATE CONCEPT, kept so the history is not lost.
//
// Phase 0 of the Business OS found `round2` written out four times, byte for
// byte identical:
//
//   accounting.domain.ts   payments.domain.ts
//   insights.domain.ts     costing.domain.ts   (named roundMoney)
//
// plus a fifth in `packages/validation`. Four identical copies are not four
// bugs: they are four places a change to rounding DIRECTION silently misses.
// `tax.domain.ts` exists precisely because `Math.round(-0.5)` is `-0`, which is
// how a credit note came to round differently from its invoice.
//
// ⚠️ COMPARISON IS IN MINOR UNITS, not here. `minor` exists because
// `0.1 + 0.2 !== 0.3` decides whether an allocation is legal. A function that
// rounds is for DISPLAY and STORAGE; a function that COMPARES money uses
// `minor`, and the callers already do.
// ============================================

export { minor, round2, roundHalfAwayFromZero, sumRounded } from '@hisabche/validation'
