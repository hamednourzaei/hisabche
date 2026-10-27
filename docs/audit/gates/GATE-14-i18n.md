# GATE-14 — i18n, RTL and formatting audit

Status: **PASS for the audit** (catalogues, key usage, literals, direction classes and formatting calls scanned over the shared UI, the app shell and the web/admin app folders). Heuristic scans: counts are candidates; file lists are in `generated/i18n-*.json`. Nothing was rendered in a browser, so dates, numbers and RTL layout were not seen.

Scripts: `scripts/audit/inventory.mjs` (key parity), `scripts/audit/i18n-keys.mjs` (literal keys vs catalogues), `scripts/audit/i18n-scan.mjs` (literals, direction, formatting). 909 source files scanned.

## 1. Catalogue parity (fa / af / en, `packages/i18n/messages/*/common.json`)

|              | keys  |
| ------------ | ----- |
| fa-IR        | 9,010 |
| fa-AF (Dari) | 9,012 |
| en           | 9,005 |

Differences (13 keys): fa has 7 keys en lacks (`landing.security.badge.*`, Persian text used as the key itself); en has 2 keys fa lacks (`common.alert`, `common.viewDetails`); fa lacks 3 keys af has (`landing.security.badge.بک‌آپ خودکار`, `landing.featurePage.offline.sections.4.heading`, `…4.body`); af lacks 1 (`landing.security.badge.پشتیبان خودکار`). The repository's own parity test passes (it enumerates what it knows).

## 2. Keys used in code vs catalogues

3,331 distinct literal keys passed to `t(...)`, `tr(...)` or `translateOr(t, ...)` in the shared UI and app shell. **49 are absent from all three catalogues under any prefix** (so identical in fa, af and en). One of them is in the desktop shim's own string file; **48 remain**, in 16 files: the `sync.*` page (`sync-page.tsx`, ~30 keys), `permissions.cap.*` and `permissions.honestNote`, `auth.logout*`, `common.logout`, `customers.name/empty`, `invoices.item/price/type`, `crm.interactions.type`, `entity.activity.*`, `invoice.open`, `dashboard.salesChart`, `landing.invoices`, `pageLook.hubSections`. They are called as `t('key', 'Persian default')`, so every locale renders the Persian default: Dari and English users see Persian for those strings. CLAUDE.md says `t()` on a missing key throws; these calls evidently go through a shim or helper that accepts a default — not verified which. List: `generated/i18n-keys.json`. (N-40, P3.)

## 3. Literal text outside the catalogue

| Kind                                                                 | Lines | Files          |
| -------------------------------------------------------------------- | ----- | -------------- |
| Persian JSX text nodes with no `t()`                                 | 77    | 37             |
| Persian attribute literals (`placeholder`, `title`, `aria-label`, …) | 16    | 9              |
| Persian default text inside `t(...)`/`translateOr(...)` fallbacks    | 2,404 | many           |
| Other Persian string literals (arrays, objects, helpers)             | 1,936 | not classified |
| English-looking JSX text with no `t()` (loose heuristic)             | 60    | —              |

Largest JSX-text files: `billing/offline-portal-view.tsx` (12), `team-and-payroll/team-and-payroll-view.tsx` (9), `invoices/invoice-returns-dialog.tsx` (6), `lib/accounting/account-name.ts` (6), `apps/web/app/not-found.tsx` (4), `dashboard-layout.tsx` (4). Attribute literals: `product-fitments-section.tsx` (4), `product-variants-section.tsx` (4), `invoice-returns-dialog.tsx` (2). The four new 50-option sections (returns dialog, warranties, variants, fitments) have literal Persian and no translation call (N-22).

The 2,404 fallback lines are the repository's accepted pattern (a catalogue key plus a Persian default); they matter only for keys that are missing (§2).

## 4. RTL

Physical-direction utilities (`ml-/mr-/pl-/pr-`, `left-/right-`, `text-left/right`, `border-l/r`, `rounded-l/r`): **3 lines in 3 files** (`dialog.tsx`, `alert-dialog.tsx`, `invite-modal.tsx` — standard primitive internals). The six files of the 50-option work use none. RTL discipline is good by this measure; layout was not rendered.

## 5. Dates, numbers, currency

| Check                                                                                                         | Result                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Raw `toLocaleString`, `toLocaleDateString`, `Intl.NumberFormat/DateTimeFormat` outside the formatting package | 91 lines in 57 files (largest: `invoice-detail/invoice-document.tsx` 13, `invoice-builder/mobile/product-search-sheet.tsx` 4, `audit/audit-view.tsx` 3, `billing/offline-portal-view.tsx` 3, `dashboard/sales-funnel.tsx` 3) — CLAUDE says `packages/formatting` is the only formatting place |
| Hard-coded locale codes (`'fa-IR'`, `'fa-AF'`, `'en-US'`, `'en-GB'`) in UI code                               | 48 lines (e.g. `auth/AuthShell.tsx`, `dashboard/sales-funnel.tsx`, `human-resources/hr-view.tsx`, `employee-detail-view.tsx`, `landing-section.tsx`, `app-shell …/desktop-strings.ts`)                                                                                                        |
| Calendar by language (`fa`→Jalali, `af`→Dari calendar, `en`→Gregorian)                                        | the rule is in code (`useDateFormat`); not checked per call site                                                                                                                                                                                                                              |
| Currency sign by locale (`currencySign`)                                                                      | rule exists; hard-coded currency guard `no-hardcoded-currency.test.ts` passes                                                                                                                                                                                                                 |

Raw locale calls and hard-coded codes are where a Dari user could receive Persian-calendar or Persian-digit output by accident; they were not individually opened.

## 6. Dari vs Persian

The third catalogue exists (9,012 keys) and the glossary is `.claude/DARI-GLOSSARY.md`. Whether Dari strings differ from Persian where they should was not audited (needs a reader of Dari).

## 7. Verdict

Not clean but systematically measured: 13 catalogue differences, 48 uncatalogued keys, ~93 literal-text lines, 91 raw formatting calls, 48 hard-coded locale codes, 3 physical-direction lines. The four new sections are the clearest regression.
