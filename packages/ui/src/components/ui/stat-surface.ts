// ============================================
// packages/ui/src/components/ui/stat-surface.ts
//
// T3 — the ONE definition of what a KPI card looks like.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// The dashboard drew its figures as elevated cards — rounded-2xl, a border, a
// soft shadow, bold tabular numerals. Sixteen capability screens (`/till`,
// `/expiry`, `/budgets`, `/timesheets`, `/assets`, `/bank`, `/conflicts`,
// `/governance` …) drew theirs through `capability-kit`'s `Stat`, which was a
// flat tinted box with no border, no shadow and a regular-weight number.
//
// Same information, two visual languages, and the owner's report was exactly
// that: «ظاهرشان با بقیه‌ی داشبورد یکی نیست».
//
// ---------------------------------------------------------------------------
// ⚠️ THIS IS CLASS STRINGS, NOT A COMPONENT, AND THAT IS DELIBERATE
//
// `BentoStats` and `Stat` are genuinely different components: the bento grid
// is an asymmetric four-cell layout with deltas and trend arrows, and `Stat`
// takes any number of plain figures with no comparison data. Forcing one to
// render through the other would mean passing fake deltas, or slicing a
// six-stat screen down to four.
//
// What they must share is the LOOK. So the look lives here, both import it,
// and a guard test asserts neither one hardcodes its own copy.
// ---------------------------------------------------------------------------

/**
 * The card shell: elevation, border, radius.
 *
 * Copied out of `bento-stats.tsx`, which was the original and is now a
 * consumer. Changing a value here changes every KPI in the product, which is
 * the point.
 */
export const STAT_CARD_SURFACE = [
  'rounded-2xl',
  'border border-[hsl(var(--border-default))]',
  'bg-[hsl(var(--surface-elevated))]',
  'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.16)]',
  'transition-colors duration-150',
].join(' ')

/** The small caption above the figure. */
export const STAT_LABEL = 'truncate text-[10px] text-[hsl(var(--fg-secondary))] sm:text-xs'

/**
 * The figure itself.
 *
 * `tabular-nums` is not decoration: without it, digits have different widths
 * and a column of amounts will not line up — which is the one thing a person
 * reading a column of money is doing.
 */
export const STAT_VALUE = 'truncate font-bold tabular-nums text-[hsl(var(--fg-primary))]'

/** The optional line under the figure. */
export const STAT_HINT = 'truncate text-[10px] text-[hsl(var(--fg-tertiary))] sm:text-xs'

/** Padding, shared so the two do not drift apart by two pixels. */
export const STAT_PADDING = 'min-w-0 p-3 sm:p-4'

/**
 * The same shell, but only from the `sm` breakpoint up.
 *
 * ⚠️ WRITTEN OUT RATHER THAN DERIVED. Tailwind cannot prefix a class STRING —
 * `sm:${STAT_CARD_SURFACE}` produces one nonsense class, not four prefixed
 * ones, and it fails silently by simply not styling anything.
 *
 * `BentoStats` needs this because on mobile it deliberately merges its four
 * cells into ONE bordered box, and only becomes four separate cards on wider
 * screens. Every value below must stay identical to `STAT_CARD_SURFACE`; a
 * guard test compares them.
 */
export const STAT_CARD_SURFACE_DESKTOP = [
  'sm:rounded-2xl',
  'sm:border sm:border-[hsl(var(--border-default))]',
  'sm:bg-[hsl(var(--surface-elevated))]',
  'sm:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-14px_rgba(0,0,0,0.16)]',
  'transition-colors duration-150',
].join(' ')
