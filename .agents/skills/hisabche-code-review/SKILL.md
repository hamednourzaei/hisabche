---
name: hisabche-code-review
description: Reviewing a diff, a pull request, or your own change before finishing. Prioritises real defects over style.
---

# Code review

Report real defects. Style opinions are noise unless they hide a bug.

## Order

Correctness → security → domain semantics → i18n → UI consistency → types →
tests → performance. Stop at the first thing that would break a shopkeeper's
books; that is the finding that matters.

## What to actually check

**Domain semantics** — the sharpest edge here.

- Is `invoice.type` read, or is `sale` assumed?
- Does a NULL type still read as a sale?
- Do purchases stay out of sales revenue?
- Are quantity, unit and weight kept distinct?
- Is `0` distinguished from absent for weight and amounts?

**Security**

- Is authorization server-side, scoped by the authenticated id — not a body field?
- Can an id in the URL or body reach a row the caller does not own?
- Any session-creating auth call on the shared Supabase client?
- Anything sensitive in a `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` variable?

**i18n**

- New user-facing string in fa, af **and** en?
- Locale-aware number and date formatting, or a hardcoded `fa-AF`?
- Logical CSS properties (`ms-`, `pe-`) rather than `ml-`/`left-`?

**UI**

- Shared `DataTable`, or a new bespoke table?
- Design tokens, or raw hex?
- New web route without the matching desktop route?
- `@/` import inside `packages/ui`?
- `ssr: false` or a `lazy()` boundary that the whole app tree passes through?
- A URL, canonical or link built without the locale prefix, or `hreflang="af"`?
- JSON-LD asserting content — counts, ratings — the page does not render?

**Types**

- `any`, `ts-ignore`, `eslint-disable`, or a loosened tsconfig?
- A prop typed non-optional that server data may not supply?

**Tests**

- Regression test for each fixed bug?
- Any assertion weakened, skipped or deleted to go green?

**Database**

- New column that an existing one could carry?
- Migration idempotent, additive, with a fallback in code?

## Output

Most severe first. For each: the file and line, what breaks, and the concrete
input or state that triggers it. If you cannot describe how it fails, it is an
opinion — leave it out.
