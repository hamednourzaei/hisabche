# CONTRACT_MISMATCH_REPORT.md

> Generated 2026-08-07. 10 remaining TypeScript errors in `packages/ui`,
> all architectural contract mismatches. No code was changed to produce
> this report. Per engineering rules, these are **pre-existing
> architectural issues** — fixing them requires an owner decision, not a
> mechanical edit.

Scope of remaining errors: `pnpm -r exec tsc --noEmit` — 10/11 packages
green; only `@hisabche/ui` fails on the 2 files below.

---

## 1. `EntityActivityCard.tsx(283,49)` — `Property 'time' does not exist on type 'string'`

- **Source type**: `EntitySummaryDto.lastActivity: string`
  (`packages/api/src/hooks/activity.ts:44`)
- **Consumer type**: `summary.lastActivity.time` — expects
  `lastActivity: { title: string; time: string }`
  (`useEntitySummary.ts:18`)
- **Why they diverged**: Two different `useEntitySummary` hooks exist with
  incompatible return shapes:
  - `packages/api/src/hooks/useEntitySummary.ts` → `lastActivity: { title, time }`
  - `packages/api/src/hooks/activity.ts:219` → `EntitySummaryDto.lastActivity: string`
  - The api barrel (`packages/api/src/index.ts:266`) re-exports
    `useEntitySummary` from `activity.ts` (snake_case API shape), but
    `useEntitySummary.ts` (camelCase UI shape) still exists and is
    consumed by the same component. The barrel resolves to `activity.ts`,
    so the consumer sees `lastActivity: string`.
- **Contract owner**: `@hisabche/api` (single authoritative
  `useEntitySummary` + one `EntitySummary` shape).
- **Recommended fixer**: `@hisabche/api` maintainer — pick one canonical
  shape (likely `EntitySummaryDto.lastActivity: string` = an ISO
  timestamp) and delete/deprecate the duplicate hook + update the single
  consumer. Do not dual-shape.

---

## 2. `EntityActivityCard.tsx(283,55)` — `Translator<Record<string, any>, never>` not assignable to `(key, fallback?) => string`

- **Source type**: `useTranslations()` from `next-intl` →
  `Translator<Record<string, any>, never>` (typed keys from message
  catalogs).
- **Consumer type**: `timeAgo(date, t: (key: string, fallback?: string) => string)`
  (widened plain-function signature).
- **Why they diverged**: `next-intl`'s `Translator` is a callable with
  complex generic overloads; assigning it to a plain arrow-function type
  loses the callable-with-overloads shape. This only surfaced after
  `next-intl` became resolvable in `packages/ui` (previously the module was
  unresolved, masking the error).
- **Contract owner**: `@hisabche/ui` (the `timeAgo` local signature).
- **Recommended fixer**: `@hisabche/ui` — narrow `timeAgo`'s `t` parameter
  to the `Translator` type (import from `next-intl`) or pass a wrapped
  `(key, fallback?) => t(key, fallback)` adapter. Signature change is
  local to `EntityActivityCard`.

---

## 3. `EntityActivityCard.tsx(316,41)` — `Property 'type' does not exist on type 'ActivityItemDto'`

- **Source type**: `ActivityItemDto` (`packages/api/src/hooks/activity.ts:27`)
  — fields: `id, action, title, description?, actor, actorId?, timestamp,
isRead, importance`. **No `type` field.**
- **Consumer type**: `activity.type as keyof typeof activityIcons`
  (expects an icon-discriminator field).
- **Why they diverged**: The consumer was written against an older/newer
  `ActivityItemDto` that had a `type` field; the API contract no longer
  carries it (only `action`). Component renders icon mapping from a
  missing discriminator.
- **Contract owner**: `@hisabche/api` (`ActivityItemDto` shape) — or
  `@hisabche/ui` if it must derive the icon from `action` instead.
- **Recommended fixer**: `@hisabche/api` decides whether to add `type` to
  `ActivityItemDto` (API payload change) or `@hisabche/ui` maps icons from
  `action`. One side must yield; no cast.

---

## 4. `sales-followup-container.tsx(14,41,51)` — `Cannot find namespace 'SalesFollowup'`

- **Source type**: nonexistent — `SalesFollowup.FollowUpStatus`,
  `SalesFollowup.FollowUp`, `SalesFollowup.FollowUp.Type` referenced but
  no `namespace SalesFollowup` exists anywhere in `packages/ui` or
  `packages/api`.
- **Consumer type**: container uses the namespace as if it were exported
  from the view module (`sales-followup-view.tsx`).
- **Why they diverged**: The view module exports **named types**
  (`export type FollowUpStatus`, `export interface FollowUp`…) but the
  container was written against a namespace-style API that was never
  created. Dead/legacy container code.
- **Contract owner**: `@hisabche/ui` (the view module's exports).
- **Recommended fixer**: `@hisabche/ui` — rewrite the 3 references to
  named imports (`import type { FollowUpStatus, FollowUp } from
"./sales-followup-view"`). Pure import-side fix, no contract change.

---

## 5. `sales-followup-container.tsx(37,26)` — `Record<string, unknown>` not assignable to `CreateFollowUpInput`

- **Source type**: `handleCreate(values: Record<string, unknown>)` (form
  values, loosely typed).
- **Consumer type**: `useCreateFollowup().mutateAsync(values:
CreateFollowUpInput)` from `@hisabche/api`
  (`packages/api/src/hooks/sales-followup.ts`).
- **Why they diverged**: The container passes raw form values to a
  strictly-typed mutation input. No narrowing/validation between form and
  API contract.
- **Contract owner**: `@hisabche/ui` (container) + `@hisabche/api`
  (`CreateFollowUpInput` stays authoritative).
- **Recommended fixer**: `@hisabche/ui` — type `handleCreate` with
  `CreateFollowUpInput` (imported from api) and map form fields
  explicitly. Do not widen `CreateFollowUpInput`.

---

## 6. `sales-followup-container.tsx(58,7)` — `Translator` not assignable to `(key, fallback?) => string`

- Same root cause as #2: `next-intl` `Translator` generic callable vs
  plain-function prop type in `SalesFollowupViewProps`.
- **Contract owner / fixer**: `@hisabche/ui` — align `SalesFollowupViewProps.t`
  with the `Translator` type or pass an adapter at the container.

---

## 7. `sales-followup-container.tsx(59,7)` — api `FollowUp[]` not assignable to view `FollowUp[]`

- **Source type**: `FollowUp` from `@hisabche/api`
  (`packages/api/src/hooks/sales-followup.ts:22`) —
  flat snake_case: `customer_id, customer_name, assigned_to_id,
next_action_date, created_at…`
- **Consumer type**: `FollowUp` from `sales-followup-view.tsx:40` —
  nested camelCase: `customer: Customer, assignedTo: {id,name}, 
nextActionDate, createdAt…`
- **Why they diverged**: Two distinct `FollowUp` types named identically —
  the API wire shape and the view shape. The container forwards the API
  type into the view's prop. Nothing maps between them.
- **Contract owner**: `@hisabche/ui` (view type is presentation-local) —
  the mapping belongs in the container; the API contract must NOT be
  renamed per engineering rules.
- **Recommended fixer**: `@hisabche/ui` — container maps
  `api.FollowUp → view.FollowUp` (field flattening) before passing to the
  view, or the view consumes the API shape directly (delete the duplicate
  view interface). One `FollowUp` type should survive.

---

## 8. `sales-followup-container.tsx(60,7)` — API customer type not assignable to view `Customer[]`

- **Source type**: `useCustomers()` result from `@hisabche/api`
  (customers hook: `{ id, name, email?, phone? }` — loose inline type).
- **Consumer type**: `Customer` from `sales-followup-view.tsx:32` —
  `{ id, name, email?, phone?, avatar? }` **or** the container passes
  `customersData?.customers` where `customersData` is the `useCustomers`
  response whose row type is `{ type: "cash"|"credit", fullName, isActive,
openingBalance… }` (customer module shape) — two different `Customer`
  shapes exist across api hooks.
- **Why they diverged**: `packages/api` exposes multiple customer row
  shapes (`customers.ts` snake/full vs `sales-followup.ts` inline
  `{name,email,phone}` vs view's camel). Container forwards one shape into
  a prop typed with another.
- **Contract owner**: `@hisabche/api` (canonical customer row type) and
  `@hisabche/ui` (view `Customer` type).
- **Recommended fixer**: `@hisabche/api` — single exported `Customer`
  row type reused by all hooks; `@hisabche/ui` consumes it. Eliminate the
  duplicated inline shapes.

---

## Cross-cutting summary

| #   | File                    | Root cause class                          | Contract owner       |
| --- | ----------------------- | ----------------------------------------- | -------------------- |
| 1   | EntityActivityCard:283  | duplicate `useEntitySummary` hooks (api)  | `@hisabche/api`      |
| 2   | EntityActivityCard:283  | `Translator` vs plain fn (ui-local)       | `@hisabche/ui`       |
| 3   | EntityActivityCard:316  | `ActivityItemDto` missing `type`          | `@hisabche/api`      |
| 4   | sales-followup:14/41/51 | nonexistent `SalesFollowup` namespace     | `@hisabche/ui`       |
| 5   | sales-followup:37       | form `Record` vs `CreateFollowUpInput`    | `@hisabche/ui`       |
| 6   | sales-followup:58       | `Translator` vs plain fn                  | `@hisabche/ui`       |
| 7   | sales-followup:59       | duplicate `FollowUp` shapes (api vs view) | `@hisabche/ui` (map) |
| 8   | sales-followup:60       | duplicate `Customer` shapes across api    | `@hisabche/api`      |

**Pattern**: 5 of 8 root causes are **duplicated type definitions with
identical names** living in different modules (`useEntitySummary`,
`FollowUp`, `Customer`). The repo's "one source of truth" rule
(CODING_STANDARDS: no duplicated types) is violated by the API package
itself. The remaining 3 are local ui signature issues (Translator,
namespace, form typing).

**Recommended owners to fix (priority)**:

1. `@hisabche/api` maintainer — deduplicate `useEntitySummary`,
   `FollowUp`, `Customer` into single exported contracts (fixes 1, 7, 8
   at the root).
2. `@hisabche/ui` maintainer — named imports + `Translator` typing +
   `CreateFollowUpInput` form mapping (fixes 2, 4, 5, 6).
3. `@hisabche/api` + `@hisabche/ui` jointly — `ActivityItemDto.type`
   decision (fix 3).

No adapter, cast, `as`, type-widening, or interface duplication was
introduced. The 10 errors remain untouched, awaiting owner decisions.
