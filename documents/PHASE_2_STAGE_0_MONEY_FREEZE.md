# PHASE 2 — STAGE 0: BEHAVIOR FREEZE

**Status: complete.** Money, currency, rounding, digit-shaping and date formatting are
now covered by characterization tests on all three platforms. **No formatter was
changed.** Nothing is unified yet.

---

## What "freeze" means here

These tests assert what the code does **today**, including behaviour that is arguably
wrong. They are not a specification. They are a tripwire: if Stage 4 changes a displayed
figure, a test fails and the change becomes a conscious decision instead of an accident.

Every expectation below was captured by **executing the real functions**, not by reading
them. Four of my own predictions were wrong and had to be corrected against measured
output — which is precisely why this stage exists.

---

## 1. Implementations found

There are **four** money-formatting behaviours in the product, not three.

| #   | Path                              | Location                                                    | Used by                       |
| --- | --------------------------------- | ----------------------------------------------------------- | ----------------------------- |
| 1   | `formatAmount` / `formatMoney`    | `apps/desktop/src/shared/lib/currency.ts`                   | all desktop screens           |
| 2   | `formatAmount` / `formatCurrency` | `apps/mobile/src/shared/lib/format.ts`                      | all mobile screens            |
| 3   | `formatCurrency`                  | `packages/ui/src/lib/utils.ts`                              | web, Intl `style: 'currency'` |
| 4   | raw `value.toLocaleString()`      | **43 call sites** across `packages/ui/src/components/ui/**` | web feature components        |

Plus two input-side helpers that are **not** display formatters and must not be merged
with them:

| Path                                    | Location                                 | Role                                                             |
| --------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `formatThousands` / `unformatThousands` | `packages/ui/src/lib/thousands.ts`       | money **inputs** — display grouping + clean value for `Number()` |
| `toPersianNumbers` / `toArabicNumbers`  | `packages/ui/src/lib/persian-numbers.ts` | display-only digit shaping                                       |

`packages/mobile-ui/src/components/money.tsx` is **presentation only** — it receives a
pre-formatted string. It contains no formatting logic and needs no freeze.

Arithmetic lives elsewhere and was not touched: `apps/desktop/src/features/sales/invoice-draft.ts`
(`lineTotal`, `subtotalOf`, `buildInvoice`) and `packages/store/src/slices/currency.slice.ts`
(`convert`). **Formatting and arithmetic are already separate in the codebase** — that
separation must survive Stage 4.

---

## 2. Behavior matrix (measured)

Currency codes in the product are **AFN, USD, PKR, IRR**. There is no Toman;
`currencyCodeSchema` does not define one, so it is out of scope.

### 2.1 Same input, different output — the core problem

Input `1234.567`, currency `AFN`, Persian locale:

| Path                   | Output       | Decimals | Sign position | Separator before sign |
| ---------------------- | ------------ | -------- | ------------- | --------------------- |
| Desktop                | `۱٬۲۳۵ ؋`    | **0**    | after         | ASCII space           |
| Mobile                 | `۱٬۲۳۵ ؋`    | **0**    | after         | ASCII space           |
| Web `formatCurrency`   | `؋ ۱٬۲۳۴٫۵۷` | **2**    | before        | **U+00A0 NBSP**       |
| Web `toLocaleString()` | `1,234.567`  | **3**    | none          | —                     |

**Four different strings for one number.** Desktop and mobile agree with each other;
web disagrees with both, in two different ways.

### 2.2 Full matrix

| Case                | Desktop                      | Mobile                  | Web `formatCurrency`         | Web `toLocaleString()`    |
| ------------------- | ---------------------------- | ----------------------- | ---------------------------- | ------------------------- |
| AFN 1234.567        | `۱٬۲۳۵ ؋`                    | `۱٬۲۳۵ ؋`               | `؋<NBSP>۱٬۲۳۴٫۵۷`            | `1,234.567`               |
| USD 1234.567        | `۱٬۲۳۵ $`                    | `۱٬۲۳۵ $`               | `$<NBSP>۱٬۲۳۴٫۵۷`            | —                         |
| PKR 1234.567        | `۱٬۲۳۵ ₨`                    | `۱٬۲۳۵ ₨`               | `PKR<NBSP>۱٬۲۳۴٫۵۷`          | —                         |
| IRR 1234.567        | `۱٬۲۳۵ ﷼`                    | `۱٬۲۳۵ ﷼`               | `ریال<NBSP>۱٬۲۳۴٫۵۷`         | —                         |
| Zero                | `۰ ؋`                        | `۰ ؋`                   | `؋<NBSP>۰`                   | `0`                       |
| Negative −1234.5    | `‎−۱٬۲۳۵`                    | `‎−۱٬۲۳۵`               | `-$1,234.5` (en)             | `-1,234.5`                |
| Decimal 0.5         | `۱`                          | `۱`                     | `۰٫۵`                        | `0.5`                     |
| Large 999999999.999 | `۱٬۰۰۰٬۰۰۰٬۰۰۰`              | `۱٬۰۰۰٬۰۰۰٬۰۰۰`         | (2dp)                        | `999,999,999.999`         |
| Rounding            | half-up to integer           | half-up to integer      | half-up to 2dp               | none (3dp)                |
| Persian digits      | yes (locale)                 | yes (locale)            | yes (`fa-AF` hardcoded)      | depends on runtime locale |
| Latin digits        | only if `i18n.language='en'` | same                    | only via explicit `'en'` arg | default locale            |
| Locale source       | `i18n.language \|\| 'fa-IR'` | same                    | **hardcoded `'fa-AF'`**      | **runtime default**       |
| Intl unavailable    | throws                       | `String(Math.round(v))` | throws                       | throws                    |

`fa-IR` and `fa-AF` produce **identical** output for plain grouped numbers, so the
desktop/mobile `fa-IR` default vs web's `fa-AF` is harmless for amounts — but it is not
harmless for `style: 'currency'`, where it selects the currency display name.

### 2.3 Quirks frozen deliberately

| #   | Quirk                                                                            | Where             | Impact                                                                                                                                     |
| --- | -------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Decimals are **never** displayed — `0.5` renders as `۱`                          | desktop, mobile   | An invoice of 1234.50 displays as 1235. Stored value is unaffected.                                                                        |
| Q2  | Small negatives collapse to a signed zero: `-0.4` → `‎−۰`                        | desktop, mobile   | Shows "minus zero".                                                                                                                        |
| Q3  | Negative sign is **U+2212** prefixed by **U+200E**, not ASCII `-`                | desktop, mobile   | `<Money signed>` tests `amount.startsWith('-')`, which is **false** for this string — **negative styling never triggers on mobile today**. |
| Q4  | `formatPercent`'s one-decimal rounding is **dead code**                          | mobile            | `Math.round(v*10)/10` then `maximumFractionDigits: 0` → `12.34%` renders `۱۲%`. Intent was one decimal; shipped behaviour is zero.         |
| Q5  | Intl separates sign and digits with **U+00A0**, desktop/mobile use ASCII space   | web vs others     | Any cross-platform string comparison fails on whitespace alone.                                                                            |
| Q6  | PKR/IRR render as `PKR` / `ریال` on web but `₨` / `﷼` on desktop and mobile      | web vs others     | Same currency, different symbol per platform.                                                                                              |
| Q7  | `unformatThousands` **discards** Persian digits rather than converting           | web inputs        | Pasting `۱۲۳۴` into a money input submits `""`, not `1234`. Mixed input `1۲3۴` submits `13`. **Real data-loss path.**                      |
| Q8  | `formatThousands` strips the minus sign                                          | web inputs        | Negative amounts cannot be typed.                                                                                                          |
| Q9  | `toPersianNumbers` shapes digits but **not** separators — `,` and `.` stay Latin | web               | Produces `۱,۲۳۴.۵۶` where Intl produces `۱٬۲۳۴٫۵۶`. Two different Persian renderings coexist.                                              |
| Q10 | Mobile `formatDate(null)` throws; desktop's returns `—`                          | mobile vs desktop | Divergent null handling.                                                                                                                   |

**Q7 is a bug, not a formatting preference.** It is frozen, not fixed, because fixing it
changes submitted values — which is exactly the class of change Stage 0 exists to
prevent from happening silently. It should be fixed deliberately, with its own change.

---

## 3. Intentional vs accidental differences

| Difference                                          | Verdict                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Desktop and mobile agreeing on integer-only display | **Intentional** — both are commented as pairing digits with a separately-weighted sign.     |
| Mobile's Hermes `Intl` fallback                     | **Intentional** — commented, guards partial Intl on Android.                                |
| Web using `style: 'currency'` with 2 decimals       | **Accidental** — no comment, no shared decision; it is simply a different author's default. |
| Web's 43 raw `toLocaleString()` sites               | **Accidental** — no locale, no precision control. The largest source of drift.              |
| Locale `fa-IR` vs hardcoded `fa-AF`                 | **Accidental**.                                                                             |
| PKR/IRR symbol mismatch                             | **Accidental**.                                                                             |
| `thousands.ts` being Latin-only                     | **Intentional** — documented: the value must round-trip through `Number()`. Keep.           |

---

## 4. Tests added

| Suite   | File                                                            | Tests |
| ------- | --------------------------------------------------------------- | ----- |
| Desktop | `apps/desktop/src/shared/lib/__tests__/currency.freeze.test.ts` | 25    |
| Mobile  | `apps/mobile/src/shared/lib/__tests__/format.freeze.test.ts`    | 27    |
| Web     | `packages/ui/src/lib/__tests__/money.freeze.test.ts`            | 39    |

**91 characterization tests.** No production code was modified.

---

## 5. Infrastructure fixed to make the freeze possible

Two pre-existing problems blocked Stage 0 and were repaired:

1. **The entire mobile test suite was dead.** `transformIgnorePatterns` in
   `apps/mobile/package.json` anchored on the first `node_modules/`, which under pnpm is
   followed by `.pnpm/` — so `@react-native/js-polyfills` was never transformed and every
   suite failed at import with `SyntaxError: Unexpected identifier 'ErrorHandler'`.
   Added a pnpm-layout-aware pattern alongside the original.
   **Before: 0 tests ran. After: 45 tests run, 4 suites.** This was also failing in CI.

2. **`packages/ui` had no test runner and no tests.** Added `"test": "vitest run"` and
   `vitest` to devDependencies so `turbo run test` now covers it.

---

## 6. Results

| Suite               | Before                   | After                |
| ------------------- | ------------------------ | -------------------- |
| `@hisabche/desktop` | 18 passed                | **43 passed**        |
| `@hisabche/mobile`  | **0 ran (suite broken)** | **45 passed**        |
| `@hisabche/ui`      | no runner                | **39 passed**        |
| `@hisabche/backend` | 5 passed                 | 5 passed (unchanged) |

**Note — flaky backend suite.** `backend` failed once (1 of 5) then passed on re-run with
no code change between runs. The suite takes ~7.7s and appears to have a timing- or
network-dependent test. Not caused by this stage; logged as a risk.

---

## 7. Bundle / performance impact

None. Stage 0 added test files only. No production module changed.

---

## 8. New risks

1. **Q7 (Persian digits discarded on input) is a live data-loss path** in web money
   inputs. It predates this work. It now has a test documenting it, so a fix will be
   visible rather than silent.
2. **Q3 means mobile negative-amount styling has never worked.** `<Money signed>` checks
   for ASCII `-` against a string that uses U+2212.
3. **The backend suite is flaky** and will produce false CI failures.
4. **Canonicalisation will be a product decision, not a refactor.** Desktop/mobile show
   0 decimals; web shows 2. Whichever is chosen, one platform's displayed figures change.
   This must be decided by the product owner before Stage 4 — it is not a technical call.

---

## 9. DECIDED — decimal policy (product owner, this session)

**Per-currency. Two decimals for USD and EUR; zero for every other currency.**

| Currency | Fraction digits | In `currencyCodeSchema` today? |
| -------- | --------------- | ------------------------------ |
| USD      | **2**           | ✅                             |
| EUR      | **2**           | ❌ **not a valid code**        |
| AFN      | 0               | ✅                             |
| PKR      | 0               | ✅                             |
| IRR      | 0               | ✅                             |

**⚠️ EUR does not exist in the product.**
`packages/validation/src/schemas/common.schema.ts:64` defines
`currencyCodeSchema = z.enum(['AFN', 'USD', 'PKR', 'IRR'])`. Adding EUR is a
**schema + backend + exchange-rate change**, not a formatting change: it touches the Zod
union, the `exchange_rates` table, `currency.slice.ts` rates, and the currency-sign maps
on all three platforms. The canonical formatter will carry the EUR rule so it is correct
the day EUR is added, but **EUR is not being enabled as part of Phase 2** unless asked.

**Impact of this decision when Stage 4 lands**

| Platform         | Currency      | Today        | After                                 |
| ---------------- | ------------- | ------------ | ------------------------------------- |
| Desktop / Mobile | USD           | `۱٬۲۳۵ $`    | `۱٬۲۳۴٫۵۷ $` — **gains decimals**     |
| Desktop / Mobile | AFN, PKR, IRR | `۱٬۲۳۵ ؋`    | unchanged                             |
| Web              | AFN, PKR, IRR | `؋ ۱٬۲۳۴٫۵۷` | `۱٬۲۳۵ ؋`-shaped — **loses decimals** |
| Web              | USD           | `$ ۱٬۲۳۴٫۵۷` | unchanged in precision                |

Both changes are intended and now traceable: the freeze tests will fail on exactly these
cases at Stage 4, and each failure must be re-baselined with a reference to this section.

Still to settle at Stage 4 (presentation only, no numeric impact): sign position
(before vs after) and the PKR/IRR symbol mismatch (Q6).

---

**END OF STAGE 0.** Money is frozen and untouched. Stage 1 (canonical design tokens)
does not depend on this decision and can proceed.
