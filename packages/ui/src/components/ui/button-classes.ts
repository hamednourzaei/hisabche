// ============================================
// packages/ui/src/components/ui/button-classes.ts
//
// Button class strings shared by more than one screen.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
//
// Four screens each declared their own private `ghostBtn`:
//
//   · customers/customer-detail-view.tsx
//   · customers/customer-workspace.tsx
//   · invoice-detail/invoice-detail-page.tsx
//   · warehouse-detail/warehouse-detail-page.tsx
//
// All four strings were byte-for-byte identical, which is the state just
// before they stop being identical: a hover colour changed on one screen is a
// screen that no longer matches the other three, and nothing fails when that
// happens. Nothing linked them, so nothing would have caught the drift.
//
// Same reasoning — and same shape — as `stat-surface.ts` and `focus-ring.ts`:
// class strings, not a component, because the consumers share the look and
// nothing else. A back arrow in a customer header and a kebab in an invoice
// toolbar have no props in common.
//
// ---------------------------------------------------------------------------
// ⚠️ TAILWIND CANNOT PREFIX A CLASS STRING. `` `sm:${GHOST_ICON_BUTTON}` ``
// produces one nonsense class rather than eight prefixed ones, and it fails
// silently by simply not styling anything. Write the breakpoint variants out.
// ============================================

/**
 * The circular icon-only button: back arrows, row actions, toolbar icons.
 *
 * `p-2` with no explicit width gives a 36px hit target at the default 20px
 * lucide icon, which is the smallest target the rest of the product uses.
 *
 * Deliberately carries no `focus-visible:` ring of its own — compose it with
 * `FOCUS_RING` from `./focus-ring` where the control is keyboard-reachable,
 * so there stays exactly one definition of the ring too.
 */
export const GHOST_ICON_BUTTON =
  'inline-flex items-center justify-center rounded-full p-2 text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none'

/**
 * The bordered secondary button: «بازگشت», «انصراف», «خروجی».
 *
 * ⚠️ THE COMPACT `px-3 py-2` VARIANT ONLY — the one `invoice-detail-page` and
 * `warehouse-detail-page` shared byte-for-byte. `customers` and
 * `AddCustomerModal` carry a roomier `px-4 py-2.5` outline button that is NOT
 * folded in here: merging them would move real padding on four screens, which
 * is a design decision rather than a de-duplication. Reported, not silently
 * changed.
 */
export const OUTLINE_BUTTON =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none'
