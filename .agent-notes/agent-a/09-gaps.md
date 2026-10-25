# Pass 9 — gaps and honesty

## Files read

- `docs/feature-audit/unknown-features.md` (253, full)
- `.claude/BUG-REGISTRY.md` — headings (154), statuses (26 matched), BUG-001..011,
  BUG-135..138 in full
- `.claude/USER-REQUESTS.md` (1-60 + headings)
- `.claude/TASKS-UI-AND-PRODUCT.md` (headings only)
- `docs/qa/deep-audit-2026-10-14.md` (full, 10 lines)
- `packages/ui/.../dashboard/display-basis-picker.tsx` (170-199)
- TODO scan of `packages/ui/src`, `apps/web/app`, `packages/app-shell/src`
  (`_todo-scan.txt`, 28 hits)

## Facts proven

- **`unknown-features.md` is unreliable**: its "evidence" column points at
  `apps/web/postcss.config.js` as the POS UI and at `loading.tsx` files as
  screens; it marks AI chat and financial intelligence BACKEND_ONLY although the
  `assistant` and `analysis` screens exist. Do not cite it.
- **Two real «به زودی» in customer UI**: `customers.aiComingSoon` («به زودی —
  تحلیل هوشمند وضعیت مشتری») and `customers.timelineComingSoon` («خط زمانی به
  زودی...»). Both are PLANNED, never AVAILABLE.
- **BUG-136 (open, not fixed)**: a per-line tax percentage typed in the invoice
  grid is displayed and summed on screen but never stored; the fix is a product
  decision, not a rename. Invoice-level tax (a rate on the whole invoice) is
  computed and stored by `invoice-math.ts:166-218`.
- **BUG-138 (fixed, still open detail)**: nothing verifies tier-1 licence
  evidence cryptographically; an automatic ban happens only through an admin's
  review. So a licence ban is a human decision.
- **No exchange-rate feed**: `fetchRates` is a TODO that calls nothing; the rate
  is typed by the person, with a date (`display-basis-picker.tsx:182-185`).
- **Deployment lag is real**: `.claude/USER-REQUESTS.md` line 9 still lists
  «دیپلوی آخرین بک‌اند و وب» as an open human action, and many rows are 🟡
  (code done, waiting for deploy). A sales claim describes the code, not
  necessarily what is live today.
- Deep audit 14 Oct: production was read-only; fixes local and uncommitted;
  a data-repair step (till ×100, bank payments booked to cash) is separate.
- Most of the bug registry is 🟡 «code + test, waiting for release» — no claim
  of a bug-free product is defensible.

## Facts not proven

- Which of the 🟡 fixes are deployed — unknowable from the repo.
- Whether `TASKS-UI-AND-PRODUCT.md` items marked ✅ are still ✅ after later
  changes (only headings read).

## Deliberately skipped

- The 140+ bug bodies outside the ranges above; `LIVE-AUDIT-2026-10-14.md` and
  `SESSION-CACHE-*` (process notes, not product facts).
