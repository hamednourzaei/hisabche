# ONBOARDING REMEDIATION PLAN

Companion to `ONBOARDING-FORENSIC-AUDIT.md` (120 findings, 101 distinct root causes).
Execution order is dependency order; every work package names its findings, its
shared-engine extension point (no parallel engines), and its regression tests.

## R1 — Critical reliability (Phase 1)

Findings: F-027, F-036, F-037, F-038, F-039, F-043…F-058, F-060, F-061, F-068,
F-101, F-105, F-107, F-116.

Extension points (existing architecture only):

- `OnboardingContainer.handleComplete` — reorder the chain: currency → workspace
  profile → DNA (conflict retry once) → progress → **activation LAST**; require the
  server's `onboardingCompleted === true` readback before local completion and
  navigation; single-flight `submitting` guard; exact prerequisite/step errors;
  one recovery notice for partial/degraded states.
- `useSaveOnboardingProgress` caller — debounce + sequence guard + visible failure.
- `auth.slice.updateProfile` — never adopt `onboardingCompleted` from the request
  body; verify from the server payload.
- `PATCH /api/auth/profile` — idempotent activation (keep the first timestamp).
- `setOnboardingProgress` — state-machine guard: client may write
  NOT_STARTED / IN_PROGRESS / PAUSED only; READY_TO_ACTIVATE / ACTIVE are derived
  from `evaluateOnboardingActivation` facts, never accepted from the body.
- Currency picker handler — roll back both stores on server refusal.

Tests: store/auth tests, backend route/service tests (fault injection per boundary,
replay idempotency, ACTIVE-from-client refusal), container wiring guards (repo
convention: source-level guards like `onboarding-bootstrap-guard.test.ts`).

## R2 — Canonical industry model (Phase 2)

Findings: F-001, F-002, F-003, F-005, F-006, F-007, F-008, F-010, F-011, F-012,
F-016, F-017, F-018, F-097, F-098.

Extension points:

- `packages/validation` — ONE selection limit constant (12) shared by
  `updateProfileSchema` and the workspace route; canonical validation of
  `businessTypes` in `updateProfileSchema` (registry keys only, legacy refused,
  duplicates normalised) — the same rule `setWorkspaceProfile` already applies.
- `onboarding.slice` — typed selection state normalised through
  `canonicalIndustryTypes`; deterministic primary replacement on removal;
  validated setters (no `as` casts at the boundary).
- `OnboardingContainer` / `OnboardingPage` — primary displayed via
  `primaryIndustryKeyOf`; selection cap with a translated message; `other`
  requires a business note; review rows split (models vs trades); unknown ids
  never raw.
- `ui-contract` catalogue ids derived from the canonical registry (labels stay).

Tests: schema tests (limit parity, canonical refusal), store tests (normalisation,
primary cycle), UI guards.

## R3 — Operational DNA & capability resolution (Phase 3)

Findings: F-080, F-094, F-099, F-103, F-104.

Extension points:

- `operationalProfileOf` / `parseOperationalView` — additive diagnostics
  (`dnaInvalid`, `onboardingInvalid`, invalid composition refused) instead of
  silent null; no new engine.
- `optionsFor` — exhaustive question handling.
- Divergence diagnostic: the operational view reports when stored DNA and stored
  trades disagree (computed with the existing resolvers).

Tests: view/service diagnostics tests, exhaustiveness guard.

## R4 — Persistence & offline reliability (Phase 4)

Findings: F-014, F-023, F-024, F-025, F-028, F-031…F-035, F-100, F-102, F-108,
F-109, F-111.

Extension points:

- `onboarding.slice` — persist `version: 2` + `migrate`; `businessNote`,
  `completedAt`, `savedAt` fields; validated bulk setter; clamped step.
- `onboardingProgressSchema` — additive optional `businessNote`,
  `primaryTradeKey`, `savedAt` (backward compatible; strict object preserved).
- Resume effect — recency-aware reconciliation, re-armed on reset/workspace change.
- Query keys — workspace-scoped (`workspaceId` in both profile keys).
- `RequireAuth` / `useRedirectGuard` — real `completedAt`, verified
  `cloudActivated`, no reset from a stale offline answer.

Tests: migrate tests, recency tests, key-scoping test, guard decision tests.

## R5 — UX & localization (Phase 5)

Findings: F-008, F-009, F-063, F-064, F-065, F-066, F-069, F-073, F-074, F-076,
F-089, F-113.

Extension points:

- i18n catalogs — the 7 missing branch/warehouse answer keys (fa/af/en) + new
  error/recovery/unknown-activity keys; parity guard extended to every emitted
  option key, `packs.*`, `capabilities.*`.
- `OnboardingPage` — RTL icon flip, progressbar semantics, no duplicate size
  description, no raw-id fallbacks, finish-button loading state.
- Review summary — localized currency name; split model/trade rows.
- `LocalFirstRunForm` — email boundary validation.

Tests: i18n parity guard, UI guards, form validation test.

## R6 — Verification & closure (Phase 6)

Findings: F-015, F-020, F-057, F-058, F-072, F-077, F-111, F-120.

- Execute: validation / store / ui / api / backend / app-shell focused suites,
  then full package suites; `tsc --noEmit` per changed package; eslint on every
  changed file from its own package.
- Record every scenario × test file × command × actual result in
  `ONBOARDING-REGRESSION-COVERAGE.md`.
- Builds only after ALL work is finished (session rule).

## Remaining external blockers (owner-run)

1. Live database verification of `docs/onboarding-server-state-migration.sql`,
   `docs/business-profile-01-migration.sql`, `docs/operational-profile-01-migration.sql`
   — no live DDL or production writes are performed by this work (session rule).
2. Live browser journey / production activation evidence (F-096, F-120).
3. Graphify semantic pass over docs/media needs an LLM API key — the graph is
   code-only by policy; no key was requested or used.
