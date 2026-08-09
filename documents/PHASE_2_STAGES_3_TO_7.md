# PHASE 2 — STAGES 3–7

Autonomous execution. Every stage: audit → baseline → implement → test → type-check →
build → regression → document.

---

# STAGE 3 — SEMANTIC UI CONTRACT

**Objective.** A type-only layer between canonical tokens and platform components, so
`CANONICAL TOKENS → SEMANTIC CONTRACT → PLATFORM ADAPTER → COMPONENT`.

**Evidence found (audit before writing anything).** The platforms already disagree:

| concept    | mobile        | desktop  | web      |
| ---------- | ------------- | -------- | -------- |
| brand tone | `primary`     | `brand`  | —        |
| error tone | `destructive` | `danger` | `danger` |

Sources: `packages/mobile-ui/src/components/badge.tsx`, `text.tsx`;
`apps/desktop/src/components/ui/primitives.tsx`;
`packages/ui/src/components/ui/dashboard/dashboard-stats.tsx`.

**Decisions.**

- Canonical tone vocabulary is `neutral | brand | success | warning | danger | info`.
  `brand` over `primary` because `primary` is already overloaded (it names the Button's
  main variant _and_ body-text colour). `danger` over `destructive` because two of three
  platforms already use it and it reads as a tone, not an action.
- **Components were NOT modified.** Each platform keeps its union and its rendering; the
  contract supplies compiler-checked alias maps. Drift becomes explicit instead of
  accidental, with zero runtime change.
- Exhaustiveness via `satisfies Record<...>`, so a new role without a mapping — or a
  mapping without a role — fails compilation.

**Files added.** `packages/ui-contract/` — `package.json`, `tsconfig.json`,
`src/color-roles.ts`, `src/state.ts`, `src/component.ts`, `src/index.ts`,
`src/__tests__/contract.test.ts`.

**Tests: 47 passed.** Including three the compiler cannot express: every role resolves to
a real canonical value in both themes; **no colour literal exists anywhere in the
package** (source scanned per file); **no platform import** (react / react-native /
react-dom / electron / next / expo), with the only external dependency asserted to be
`@hisabche/design-tokens`.

**Visual impact: none.** Type-check clean.

---

# STAGE 4 — MONEY / CURRENCY CANONICALIZATION

**Locked policy.** AFN/PKR/IRR → 0 decimals, USD → 2. EUR → 2 _if ever introduced_,
inactive today.

**Audit — every money rule classified (§2).**

| Location                                                                                            | Class                  | Action                                               |
| --------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| `apps/desktop/src/shared/lib/currency.ts`                                                           | DISPLAY                | migrated to canonical                                |
| `apps/mobile/src/shared/lib/format.ts`                                                              | DISPLAY                | migrated to canonical                                |
| `packages/ui/src/lib/utils.ts` `formatCurrency`                                                     | DISPLAY (web)          | **unchanged** per §6                                 |
| 43 × `toLocaleString()` in `packages/ui`                                                            | DISPLAY (web)          | **unchanged** per §6                                 |
| `packages/ui/src/lib/thousands.ts`                                                                  | INPUT                  | unchanged — value must round-trip `Number()`         |
| `invoice-draft.ts` (`lineTotal`, `subtotalOf`)                                                      | CALCULATION            | untouched                                            |
| `currency.slice.ts` (`convert`)                                                                     | CALCULATION            | untouched                                            |
| `shared/print/invoice-template.ts`                                                                  | PRINT                  | untouched — ink-deterministic, dark-mode independent |
| `metric-tile`, `trend-pill`, `business-health-panel`, `dashboard-stats`, `sales-chart` `toFixed(1)` | percentages, not money | out of scope                                         |
| `sync-center-container` `toFixed(1)`                                                                | bytes → MB             | out of scope                                         |

**Structural safety.** `packages/formatting` formats and never calculates: **every
exported function returns a `string`**, none returns a number. A display formatter
therefore cannot feed a rounded value back into an invoice total. Asserted by test.

**Precision declared exactly once** — `FRACTION_DIGITS` in `packages/formatting/src/money.ts`,
typed `satisfies Record<KnownCurrency, 0 | 2>`. No `currency === 'USD' ? 2 : 0` anywhere.

**Re-baselined tests — one value, twice, both expected.**
`formatMoney(1234.567, 'USD')`: `۱٬۲۳۵ $` → `۱٬۲۳۴٫۵۷ $` on desktop and on mobile.
That is the approved USD change and nothing else moved. AFN/PKR/IRR byte-identical.
Each re-baselined assertion carries an inline comment naming the decision.

**Bug fixed en route (Class B).** `packages/ui/src/hooks/dashboard/use-currency.ts`
declared `"AFN" | "USD" | "EUR" | "IRR"` — it listed a currency the backend schema
rejects and **omitted PKR**, which the product supports, so a PKR workspace fell through
`symbols[code] || code` and rendered the bare text `PKR`. Union aligned to canonical and
`PKR: "₨"` added. Formatting options deliberately untouched, so web output is unchanged
for every currency that previously worked. Regression test added.

**`parseNumericInput` written but deliberately NOT wired in.** It fixes Stage 0's Q7
data-loss bug (web's `unformatThousands` discards Persian digits, so pasting `۱۲۳۴`
submits `""`). Adopting it changes submitted values — a separately reviewable change.

**Files added.** `packages/formatting/` — `money.ts`, `digits.ts`, `index.ts`,
`__tests__/money.test.ts`, `__tests__/currency-policy.test.ts`.
**Modified.** desktop `currency.ts`, mobile `format.ts`, both `package.json`,
`use-currency.ts`, two freeze suites.

**Tests: 59 passed.** Precision is verified independently of locale — the decimal
separator is asked of `Intl.formatToParts` rather than guessed (guessing initially made
`1,235` read as three decimals). EUR proven absent from `currencyCodeSchema`, the store
union, exchange rates, the drizzle schema, and every UI selector.

**Visual impact: USD amounts on desktop and mobile now show 2 decimals.** Intended.

---

# STAGE 5 — SHEETJS LAZY LOAD

**Baseline (measured from a real production build).** `spreadsheet` chunk **858,779 B**,
statically imported by `accounting-page`, `customers-page`, `products-page`.

**Change.** `import * as XLSX from 'xlsx'` → `const loadSheetJs = () => import('xlsx')`,
awaited inside `exportRows`/`importRows`. Both were already `async`, so **no signature
and no caller changed**.

**Result.** SheetJS is now its own on-demand chunk (`xlsx-*.js`, 866,435 B) fetched on
first export/import instead of on navigation to any page with an Export button.

---

# STAGE 6 — RECHARTS LAZY LOAD

**Baseline.** `dashboard-page` **830,689 B** — the first screen after login — because
`Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis` were imported statically.

**Change.** Chart extracted to `apps/desktop/src/features/dashboard/sales-chart.tsx`
(markup and props copied verbatim), loaded via `React.lazy` + `Suspense` with the
`Skeleton` fallback the page **already showed** while the sales query was in flight — so
no new visual state was introduced.

**Result.**

| Chunk                     | Before      | After                               |
| ------------------------- | ----------- | ----------------------------------- |
| `dashboard-page`          | 830,689 B   | **7,621 B** (−99.1%)                |
| `sales-chart` (new, lazy) | —           | 823,695 B                           |
| `realtime`                | 718,127 B   | unchanged (already dynamic)         |
| entry `index`             | 1,638,810 B | 1,639,353 B (+543 B, lazy plumbing) |

KPI tiles — the reason the app is opened — now paint without waiting for chart code.

**Deferred (measured, not done):** the 1.64 MB entry chunk. Reducing it means splitting
`@hisabche/api`'s 33-hook barrel and auditing `lucide-react` tree-shaking; both are
wider changes than this stage's scope.

---

# STAGE 7 — DEAD ROUTE CLEANUP

**Re-confirmed before touching (§6.1).** Repo-wide grep for `team&page` outside
`node_modules` and `.next`: **zero source references** — no `<Link>`, no `router.push`,
no nav entry, no sitemap, no test, no redirect. Only my own Phase 1/1.5 documents and
`docs/SESSION_HANDOFF.md`.

**Corroborating evidence.** `docs/SESSION_HANDOFF.md:58` already recorded it as
_"نام عجیب، از دستور اولیه"_ and explicitly sanctioned renaming it. The page renders
`TeamAndPayrollContainer`, whose metadata reads "Team & Payroll" — `&payroll` had been
truncated to `&page`.

**Change.** `git mv "team&page" "team-and-payroll"`. The `&` was a real hazard: it
terminates a path in some parsers and must be percent-encoded in query contexts. The new
segment matches the base path the container already pushes to.

**Verified.** `next build` compiles clean; route registered as `/[lang]/team-and-payroll`.

**Deliberately NOT done (§3 — never invent product behavior).** The container links to
`/team-and-payroll/employee/[id]` and `/team-and-payroll/payroll/[id]`, which do not
exist. Those links were **already broken before this change**; creating the routes is a
product decision. Also, the nav's `team` item points at `/human-resources`, so this page
is still unreachable from the sidebar. Both recorded in `docs/SESSION_HANDOFF.md`.

---

# VERIFICATION

| Suite                     | Tests                    |
| ------------------------- | ------------------------ |
| `@hisabche/design-tokens` | 87                       |
| `@hisabche/ui-contract`   | 47                       |
| `@hisabche/formatting`    | 59                       |
| `@hisabche/ui`            | 39                       |
| `@hisabche/mobile`        | 147                      |
| `@hisabche/desktop`       | 44                       |
| `@hisabche/backend`       | 5                        |
| **Total**                 | **428 passed, 0 failed** |

**Type-check:** 0 errors across design-tokens, ui-contract, formatting, mobile-ui, ui,
desktop, and `apps/mobile` (`tsc --noEmit`).

**Builds:** desktop `electron-vite build` ✅ · web `next build` ✅.

**Diff hygiene.** `apps/web/next-env.d.ts` was rewritten by `next build` (quote style
only) and reverted — not a source change.

---

# DECISION LOG

| Decision                           | Rationale                                                            |
| ---------------------------------- | -------------------------------------------------------------------- |
| EUR stays inactive                 | Not in `currencyCodeSchema`; formatter carries a future rule only    |
| Canonical tones: `brand`, `danger` | `primary` overloaded; `danger` already 2-of-3                        |
| Components not migrated in Stage 3 | Type-only stage; alias maps make drift explicit at zero runtime cost |
| Web money display unchanged        | Explicit instruction; divergence stays traceable                     |
| Print colours unchanged            | Ink-deterministic, must not follow dark mode                         |
| `*Soft`/`scrim` stay mobile-local  | No canonical web equivalent to derive from                           |
| `hslLegacy` kept                   | RN colour parser; not a second source of truth                       |
| Mobile `LEGACY_LIGHT` untouched    | Historical drift, ratcheted at exactly 8 tokens                      |
| `parseNumericInput` not wired in   | Fixing Q7 changes submitted values                                   |
| `use-currency` union fixed         | Class B bug: rejected currency listed, supported one missing         |

---

# DEFERRED

1. Desktop entry chunk 1.64 MB — needs `@hisabche/api` barrel split.
2. Q7 fix adoption in web money inputs.
3. Mobile light theme alignment to canonical (9 lines in `LEGACY_LIGHT`).
4. `/team-and-payroll/{employee,payroll}/[id]` child routes.
5. Web's 43 `toLocaleString()` call sites.
6. Q3: mobile `<Money signed>` tests for ASCII `-` but Intl emits U+2212, so negative
   styling has never triggered.
7. Vazirmatn TTF → subset woff2 (246 kB).
8. Flaky backend suite (~8 s; failed once, passed on re-run, no code change).
