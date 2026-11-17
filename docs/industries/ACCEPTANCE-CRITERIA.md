# معیارهای پذیرش

<!-- GENERATED from code by packages/ui/src/__tests__/industry-docs — do not edit by hand. Update: `node scripts/industry/generate-industry-docs.mjs` -->

یک فهرست، نه دو تا: همان ده معیاری که `scripts/industry/sellable-criteria.mjs` می‌سنجد. شواهد روی commit `98a2520`.

| معیار | چه چیزی | صنف‌هایی که دارند |
| --- | --- | ---: |
| `WORKSPACE_JOURNEY` | signup → workspace (workspace_create_with_owner) → books currency stored | 67 از 67 |
| `ONBOARDING_JOURNEY` | onboarding: questions match the model, DNA from every selected trade, primary trade stated by the user | 67 از 67 |
| `FIRST_VALUE_JOURNEY` | first value: checklist from DNA, every step opens a page that is unlocked for this business | 67 از 67 |
| `DAILY_OPERATIONS_JOURNEY` | daily operations: the industry's own document → payment → stock/resource → ledger | 67 از 67 |
| `REPORTING_PROOF` | reporting: profit with an explicit unknown, party balance by currency, stock or capacity | 67 از 67 |
| `OFFLINE_GATE_PROOF` | offline: every action either runs on the device or is an explicit online-only row in the matrix | 67 از 67 |
| `RETURNS_PROOF` | returns: cancelling/returning the same document restores the balances | 67 از 67 |
| `POSTGRES_JOURNEY` | a chained journey on real PostgreSQL, recorded with the shipped commit | 0 از 67 |
| `BROWSER_JOURNEY` | a Playwright scenario on the web app, recorded with the shipped commit | 0 از 67 |
| `CLAIMS_PROOF` | landing, help and onboarding copy claim only what 1–8 proved | 67 از 67 |

## تجربه‌ی اختصاصی صنف

| برچسب | تعداد صنف |
| --- | ---: |
| `EXISTING_AND_VERIFIED` | 28 |
| `EXISTING_BUT_INCOMPLETE` | 27 |
| `CONFIGURATION_REQUIRED` | 12 |
| `NEW_CAPABILITY_REQUIRED` | 0 |
| `NOT_SUPPORTED` | 0 |
| `BLOCKED_EXTERNAL` | 0 |

سفر پایه برای همه سنجیده شده؛ «تجربه‌ی اختصاصی» چیز دیگری است و برای پروفایل عمومی `CONFIGURATION_REQUIRED` است.
