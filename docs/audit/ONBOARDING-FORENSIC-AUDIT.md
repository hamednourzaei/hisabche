# HISABCHE — ONBOARDING FORENSIC AUDIT

**Initiative:** 100-Finding Industry-Aware Onboarding Reliability Initiative
**Prompt of record:** `docs/audit/ONBOARDING-FORENSIC-AUDIT-PROMPT.md`
**Date:** 2026-11-22 · **Branch:** `main` · **HEAD at audit start:** `2ad548ae` («fixed ci 18»)
**Working tree at audit start:** 57 changed paths (prior session work on invoices/customers/service-delivery + the customer-360 redesign). None of that work was reverted, stashed or committed by this audit.
**Code graph:** graphifyy 0.9.115, rebuilt 2026-11-22 (`graphify-out/`, 46,488 nodes / 120,318 edges, code + SQL). Queries used before wide greps per AGENTS.md §7.

## Method

Every finding below was checked against the CURRENT working tree, not against the
prompt's starting list. The 100 mandatory starting points were re-verified; several
are already corrected in the existing architecture and are recorded as
`VERIFIED_COMPLETE` with the correcting symbol/test as evidence. Findings that share
one root cause are deduplicated and cross-referenced. No finding was manufactured to
reach the target; the audit produced 120 distinct entries.

**Severity:** P0 = false success / data loss / security · P1 = broken or unreliable
core flow · P2 = degraded correctness or consistency · P3 = polish / documented design.
**Confidence:** CONFIRMED (read in source) · RISK (plausible, not reproduced) ·
TEST GAP (behavior unproven by an executed test).

**Disposition vocabulary (final):** `VERIFIED_COMPLETE` ·
`IMPLEMENTED_NOT_LIVE_VERIFIED` · `BLOCKED` · `NOT_IMPLEMENTED` ·
`PENDING_HUMAN_CONFIRMATION`. Green local tests are never `VERIFIED_COMPLETE`
for a production claim (session rules).

**Runtime data flow traced:**
`OnboardingPage (UI) → useOnboardingStore (Zustand persist) → OnboardingContainer →
packages/api hooks → Fastify routes (auth.routes / workspace-profile.routes) →
services (workspace-profile / activation-gate / profile-write) → Supabase
(profiles, workspaces, workspace_members, RPC workspace_set_operational_dna) →
readback (sanitizeUser / operationalProfileOf) → resolveBusinessProfile /
resolveDnaCapabilities / resolveCapabilityPlan → navigation guards
(dashboard-layout useRedirectGuard, app-shell RequireAuth) → offline
(evaluateOfflineOnboarding, local-engine first run)`.

---

## Domain A — Industry selection and business-type modeling

### F-001 · P1 · CONFIRMED — Legacy 5-value `BusinessType` union is the wizard's state type

- Evidence: `packages/store/src/slices/onboarding.slice.ts:13` (`BusinessType = 'retail'|'wholesale'|'service'|'restaurant'|'other'`) vs the 68-key canonical registry `packages/validation/src/schemas/industry-profiles.ts:42` (`INDUSTRY_KEYS`).
- Impact: the type says 5 values while 68 are selectable; every consumer needs `as BusinessType` casts (see F-010). `'service'` is a legacy key the registry deliberately refuses to specialise.
- Root cause: the store slice predates the V54 registry and was never re-typed.
- Fix: type the selection against the canonical registry (`IndustryKey`-derived selection type) and normalise through `canonicalIndustryTypes`. Plan R2.
- Regression: store slice test — every registry key accepted, legacy/unknown classified.
- Disposition: OPEN

### F-002 · P1 · CONFIRMED — Multi-industry selection stored as an opaque comma-separated string

- Evidence: `onboarding.slice.ts:35` (`businessType: BusinessType | null`), `onboarding-container.tsx:82,117` (`.split(',')`), `onboarding-page.tsx:139,157` (`[...next].join(',')`), draft schema `operational-dna.ts:1400` (`businessType: z.string().max(400)`).
- Impact: structure (order, duplicates, primary) is re-parsed ad hoc in 4+ places; the server draft column is a string blob while `workspaces.business_types` is `text[]`.
- Root cause: legacy single-choice wizard kept its storage shape when multi-select was added.
- Fix: canonical typed selection in the store; keep the comma string ONLY as the wire/draft compatibility shape, produced/consumed exclusively through `canonicalIndustryTypes`. Plan R2.
- Regression: round-trip test selection → draft string → canonical array.
- Disposition: OPEN

### F-003 · P2 · CONFIRMED — Sales models and trades share one list, one storage field and one review row

- Evidence: `packages/ui-contract/src/business-types.ts:25-31` (`BUSINESS_MODELS` + `BUSINESS_TYPES`), `industry-profiles.ts:44-45,215` (`retail`/`wholesale` inside `INDUSTRY_KEYS`, marked by `SALES_MODEL_KEYS`), review row `onboarding-container.tsx:86-92` merges both catalogues.
- Impact: «خرده‌فروشی» (how you sell) is presented and stored as if it were a trade (what you sell); the review summary conflates the two concepts (prompt starting point 9).
- Root cause: one selection set for two different questions.
- Fix: keep one canonical storage (registry already separates via `SALES_MODEL_KEYS`) but split the review summary into «sales model» and «trades» rows; primary decision already excludes models (`primaryIndustryKeyOf:1025`). Plan R2/R5.
- Regression: review-label test — models and trades rendered in separate rows.
- Disposition: OPEN

### F-004 · P3 · CONFIRMED — Primary-industry picker only shown for multi-selection

- Evidence: `onboarding-page.tsx:218` (`selectedIds.size > 1`).
- Impact: with one trade the primary is that trade deterministically (ADR-001 rule 2); hiding the picker is correct, not a defect. Recorded to close prompt starting point 4 with evidence.
- Disposition: VERIFIED_COMPLETE (design; ADR `docs/architecture/industry/ADR-001-primary-industry.md`, `primaryIndustryKeyOf` at `industry-profiles.ts:1018`).

### F-005 · P1 · CONFIRMED — UI primary fallback uses insertion order, contradicting the canonical registry-order rule

- Evidence: `onboarding-page.tsx:229` (`(primaryTradeKey || [...selectedIds][0]) === id`) vs `industry-profiles.ts:1018-1027` (registry order, models excluded).
- Impact: selecting «wholesale» then «grocery» highlights wholesale as primary in the UI while the resolver/DNA use grocery; the person confirms a different primary than the one applied.
- Root cause: the page re-derives the primary instead of calling the ONE canonical function.
- Fix: compute the displayed primary with `primaryIndustryKeyOf(businessType, primaryTradeKey)`. Plan R2.
- Regression: UI guard test — page imports/uses `primaryIndustryKeyOf`, no `[...selectedIds][0]`.
- Disposition: OPEN

### F-006 · P2 · CONFIRMED — Removing the selected primary leaves a stale `primaryTradeKey`; explicit primary never persisted

- Evidence: `onboarding-page.tsx:152-160` (`handleToggle` never touches `primaryTradeKey`); `onboarding-container.tsx:124-128` guards inference but the stale key stays in the store; `onboardingProgressSchema` (`operational-dna.ts:1394-1408`) has NO `primaryTradeKey` field, so the explicit choice is lost on every other device.
- Impact: after removing the primary trade, the persisted key names a deselected trade; a second device resumes with the registry-order primary instead of the person's explicit choice.
- Fix: deterministic replacement on removal (canonical rule) + persist `primaryTradeKey` in the draft answers. Plan R2/R4.
- Regression: store test (removal replaces primary deterministically); schema test (field round-trips).
- Disposition: OPEN

### F-007 · P1 · CONFIRMED — Account-level completion path does not enforce canonical industry selection

- Evidence: `packages/validation/src/schemas/auth.schema.ts:107` (`businessTypes: z.array(z.string().max(64)).max(20)` — no registry check), `backend/src/routes/auth.routes.ts:932` (`profileUpdate.business_types = body.businessTypes` raw). Contrast: `setWorkspaceProfile` (`backend/src/services/workspace-profile.ts:99-107`) refuses unknown/legacy.
- Impact: `PATCH /auth/profile` can store arbitrary strings («foo», «SERVICE», duplicates) as the account industry; screens then read unknown types (F-008) and the two profile copies diverge (F-097).
- Fix: canonicalise + validate in `updateProfileSchema`/route the same way the workspace path does; refuse unknown with the exact list. Plan R2.
- Regression: backend route test — unknown id → 400/422, duplicates normalised, legacy refused.
- Disposition: OPEN

### F-008 · P2 · CONFIRMED — Unknown industry ids displayed as raw strings in the review summary

- Evidence: `onboarding-container.tsx:90` (`return option ? t(option.labelKey) : id`).
- Impact: a restored draft with an unknown id shows the technical id to the person (prompt starting point 8).
- Fix: translated «unknown activity» label; never the raw id. Plan R5.
- Regression: label-builder test with an unknown id.
- Disposition: OPEN

### F-009 · P2 · CONFIRMED — Review summary merges sales models and trades into one value

- Evidence: `onboarding-container.tsx:86-92` (catalogue = models + trades + other, one joined row). Deduplicates with F-003 (same root cause); kept as the user-visible symptom.
- Disposition: OPEN (fixed together with F-003).

### F-010 · P2 · CONFIRMED — Unsafe type assertions in industry/size/currency setters and draft restore

- Evidence: `onboarding-container.tsx:160-164` (`answers.businessType as BusinessType`, `answers.storeSize as StoreSize`, `answers.defaultCurrency as Currency`), `:332` (`type as BusinessType`), `:339` (`size as StoreSize`), `:365` (`currency as Currency`).
- Impact: a corrupt draft or a stale persisted store can inject out-of-domain values past the type system.
- Fix: validate at the boundary (registry canonicalisation, `storeSize` enum, `isSupportedCurrency`) instead of asserting. Plan R2.
- Regression: store/setter tests refuse out-of-domain values.
- Disposition: OPEN

### F-011 · P1 · CONFIRMED — Custom/other industry selectable with no mandatory description

- Evidence: `onboarding-page.tsx:377-404` (note «purely optional — never gates»), `onboarding-container.tsx:208-303` (no `other` check), `auth.schema.ts:113` (`businessNote` optional).
- Impact: «سایر» with no description tells the product nothing; the escape hatch becomes a silent generic bucket (prompt starting points 11/67).
- Fix: when `other` is selected, require a non-empty business note before completion (UI gate + container check + translated error). Plan R2/R5.
- Regression: container guard test + UI disabled-state test.
- Disposition: OPEN

### F-012 · P2 · CONFIRMED — Two independently maintained industry catalogues

- Evidence: `packages/ui-contract/src/business-types.ts:31-127` (64 trades + other) vs `packages/validation/src/schemas/industry-profiles.ts:42-115` (68 keys incl. models). Parity is test-guarded (`industry-profiles.test.ts`, `industry-registry-doc.test.ts`) but the lists are still two hand-maintained sources.
- Impact: a new trade must be added twice; drift is caught only by tests, not by construction.
- Fix: derive the UI catalogue from the canonical registry (single source), keeping labels in ui-contract. Plan R2 (bounded: derive ids, keep label map).
- Regression: existing parity tests + derivation test.
- Disposition: OPEN

### F-013 · P3 · CONFIRMED — Registry parity verification exists and passes at audit time

- Evidence: `packages/validation/src/__tests__/industry-profiles.test.ts`, `industry-registry-doc.test.ts`, `industry-coverage-table.test.ts`.
- Disposition: VERIFIED_COMPLETE (coverage exists; execution result recorded in ONBOARDING-REGRESSION-COVERAGE.md).

### F-014 · P1 · CONFIRMED — No persisted-state version or migration in the onboarding store

- Evidence: `onboarding.slice.ts:135-147` (`persist` with `name` + `storage` only; no `version`, no `migrate`). Deduplicates prompt starting points 14/21/22/30 (one root cause).
- Impact: a shape change (e.g. typed selection, new fields) reads stale localStorage as-is; legacy scalar states are never upgraded; corrupt JSON is not handled.
- Fix: `version: 2` + `migrate` that canonicalises legacy `businessType`, drops out-of-domain values, and preserves the owner binding. Plan R4.
- Regression: migrate tests (v1 legacy shape → v2; corrupt payload → initial state; owner preserved).
- Disposition: OPEN

### F-015 · P1 · TEST GAP — Multi-industry end-to-end persistence not proven

- Evidence: unit coverage exists (`dna-multi-industry.test.ts`, `capability-composition.test.ts`) but no executed test drives selection → draft → server → readback → plan for 2+ industries.
- Fix: integration-style test across the shared resolver + draft schema + container wiring guard. Plan R6.
- Disposition: OPEN

### F-016 · P2 · CONFIRMED — Duplicate ids normalised only in some paths

- Evidence: `canonicalIndustryTypes` dedupes (`industry-profiles.ts:891-905`); UI uses a `Set` (`onboarding-page.tsx:154`); the store setter stores whatever string it is given (`onboarding.slice.ts:99`).
- Impact: a restored draft or programmatic setter can persist duplicates; order is insertion order, not registry order.
- Fix: normalise in the store setter through the canonicaliser. Plan R2.
- Regression: store test — duplicates/casing/order normalised.
- Disposition: OPEN

### F-017 · P2 · CONFIRMED — Three different selection limits: UI none, account API 20, workspace API 12

- Evidence: `onboarding-page.tsx:152-160` (no cap), `auth.schema.ts:107` (`.max(20)`), `workspace-profile.routes.ts:33` (`.max(12)`).
- Impact: selecting 13+ trades passes the account write and then fails the workspace write mid-completion — a partial completion caused purely by limit mismatch.
- Fix: ONE shared constant (12) enforced in UI, account schema and workspace schema. Plan R2.
- Regression: schema parity test + UI guard.
- Disposition: OPEN

### F-018 · P1 · CONFIRMED — Inconsistent unknown-industry policies across layers

- Evidence: workspace write refuses (`workspace-profile.ts:100-104`); workspace read silently filters to `known` (`workspace-profile.ts:77-78`); account write accepts anything (F-007); UI shows raw id (F-008).
- Impact: the same stored value is «error», «invisible», «accepted» and «raw text» depending on the layer; malformed data silently becomes a generic profile on read.
- Fix: refuse at every write boundary; on read, surface `unknownTypes` (the resolver already carries them, `industry-profiles.ts:1125`) instead of dropping silently. Plan R2.
- Regression: read-path test asserting unknown ids are reported, not hidden.
- Disposition: OPEN

### F-019 · P3 · CONFIRMED — Industry resolver regression tests exist

- Evidence: `industry-profiles.test.ts`, `industry-profile-guard.test.ts`, `dna-multi-industry.test.ts`, `onboarding-gate.test.ts`.
- Disposition: VERIFIED_COMPLETE (execution recorded in coverage doc).

### F-020 · P2 · TEST GAP — No comprehensive primary-industry change regression

- Evidence: ADR-001 rule tested for resolution, but no test covers the full change cycle (select → set explicit primary → remove it → deterministic replacement → persistence).
- Fix: add the cycle test with F-006. Plan R6.
- Disposition: OPEN

---

## Domain B — Onboarding state and persistence

### F-021 · P1 · CONFIRMED — Whole-object Zustand persistence without migration

- Deduplicates with F-014 (same root cause: `onboarding.slice.ts:135-147`).
- Disposition: OPEN (fixed with F-014).

### F-022 · P1 · CONFIRMED — Missing persisted-state versioning

- Deduplicates with F-014.
- Disposition: OPEN (fixed with F-014).

### F-023 · P2 · CONFIRMED — Bulk answer setter bypasses individual validation

- Evidence: `onboarding.slice.ts:112` (`setOperatingAnswers: (operatingAnswers) => set({ operatingAnswers })`) vs `:103-111` (`setOperatingAnswer` validates with `operatingAnswersSchema`).
- Impact: draft restore (`onboarding-container.tsx:165`) and any bulk caller can store answers the single-answer path would refuse.
- Fix: validate in the bulk setter too. Plan R4.
- Regression: store test — invalid bulk payload refused.
- Disposition: OPEN

### F-024 · P3 · CONFIRMED — Unvalidated step setter

- Evidence: `onboarding.slice.ts:98` (`setStep: (step) => set({ step })`); schema allows 0..20 (`operational-dna.ts:1397`) while the wizard has steps 0..5.
- Impact: a restored draft with step 12 renders a blank wizard (no step matches, `onboarding-page.tsx:702-754`).
- Fix: clamp to the wizard's actual range in the setter and on restore. Plan R4.
- Regression: store test — out-of-range clamped.
- Disposition: OPEN

### F-025 · P3 · RISK — Archetype presets applied without a runtime compatibility check

- Evidence: `onboarding.slice.ts:113-118`; presets are compile-time typed constants (`operational-dna.ts:287-373`).
- Impact: low today (typed constants); a future preset edited by hand could violate the schema silently.
- Fix: parse the preset with `operationalDnaSchema` before applying. Plan R4.
- Regression: store test — every preset parses.
- Disposition: OPEN

### F-026 · P2 · CONFIRMED — Separate client and server completion flags

- Evidence: `onboarding.slice.ts:23` (`isCompleted`) vs `profiles.onboarding_completed_at` (`auth.routes.ts:930`); reconciliation exists (`require-auth.tsx:44-46`, `dashboard-layout.tsx:232-236`).
- Impact: by design the local flag drives offline use; the server timestamp is authoritative online. The reconciliation resets local completion whenever the server says false — including a STALE cached answer offline (see F-108).
- Disposition: OPEN (fixed with F-108; the two-flag design itself is the documented offline-first contract, `offline-onboarding.domain.ts`).

### F-027 · P0 · CONFIRMED — Client completion + navigation without authoritative activation readback

- Evidence: `onboarding-container.tsx:304-305` (`completeOnboarding(); push('/dashboard')` after the try block). The PATCH response's `user.onboardingCompleted` is never checked; `updateProfile` merges `...input` locally (`auth.slice.ts:288`), so even a server refusal that returns 200-with-false would be masked when the payload fails to parse.
- Impact: the person is told onboarding succeeded and lands on a dashboard the server gate (428) may refuse; `writeProfile` can also report `onboardingColumnsMissing` and only log a warning (`auth.routes.ts:950-954`) — the timestamp was NOT stored but the client navigates anyway.
- Fix: require the server answer `onboardingCompleted === true` before `completeOnboarding()`/navigation; otherwise show the exact prerequisite failure and stay. Plan R1.
- Regression: container wiring guard + auth-store test (server false never becomes local true).
- Disposition: OPEN

### F-028 · P2 · CONFIRMED — Reset without server-draft reconciliation

- Evidence: `onboarding.slice.ts:133` (`reset` keeps owner, clears answers); guards call it on `serverCompleted === false` without refetching the workspace draft.
- Impact: a device that reset locally starts over even when the workspace draft holds newer answers (resume is one-shot, F-034).
- Fix: after reset, allow the resume effect to run again (reset the one-shot ref) and reconcile by recency (F-035). Plan R4.
- Regression: container guard test.
- Disposition: OPEN

### F-029 · P3 · CONFIRMED — Draft ownership binding exists and is tested

- Evidence: `onboarding.slice.ts:125-130` (`claimForUser`), `packages/store/src/slices/__tests__/onboarding-owner.test.ts`, guards in both hosts.
- Disposition: VERIFIED_COMPLETE.

### F-030 · P1 · CONFIRMED — No migration from the legacy industry representation in persisted state

- Deduplicates with F-014 (persist migrate) and F-001 (legacy union). `canonicalIndustryTypes` already classifies legacy `'service'` (`industry-profiles.ts:222,867,901`).
- Disposition: OPEN (fixed with F-014).

### F-031 · P1 · CONFIRMED — Business note held in component-local state

- Evidence: `onboarding-container.tsx:104` (`useState('')`).
- Impact: refresh/restart loses the note (prompt starting point 75); it exists only until completion.
- Fix: move to the persisted store (and the server draft, F-032). Plan R4.
- Regression: store persistence test.
- Disposition: OPEN

### F-032 · P1 · CONFIRMED — Business note omitted from server progress

- Evidence: `onboarding-container.tsx:178-183,282-287` (answers carry businessType/storeSize/defaultCurrency/operating only); `onboardingProgressSchema` has no note field.
- Impact: another device cannot resume the note; completion is the only moment it is persisted.
- Fix: extend the draft schema with optional `businessNote` + `primaryTradeKey` (backward compatible) and autosave them. Plan R4.
- Regression: schema round-trip + container wiring guard.
- Disposition: OPEN

### F-033 · P1 · CONFIRMED — Incomplete server draft restoration

- Evidence: `onboarding-container.tsx:158-166` restores step/businessType/storeSize/currency/operating only — not primaryTradeKey (F-006), not businessNote (F-032), not the note's validation state.
- Fix: restore every persisted field once the schema carries them. Plan R4.
- Regression: restore test (all fields).
- Disposition: OPEN

### F-034 · P2 · CONFIRMED — One-shot resume behavior

- Evidence: `onboarding-container.tsx:150-156` (`resumed.current` never reset; refuses when local step ≠ 0 or any businessType).
- Impact: after a reset (F-028) or a workspace switch the server draft is never consulted again in that mount.
- Fix: re-arm resume on reset/workspace change; keep «never overwrite answers already given on this device» via recency comparison. Plan R4.
- Regression: container guard test.
- Disposition: OPEN

### F-035 · P2 · CONFIRMED — Local state preferred without revision comparison

- Evidence: `onboarding-container.tsx:156` (any local progress blocks restore); no timestamp on either side.
- Impact: an older local draft wins over a newer server draft from another device.
- Fix: add `savedAt` to the draft schema + local store; restore when server is strictly newer AND local is untouched-or-older. Plan R4.
- Regression: recency reconciliation test.
- Disposition: OPEN

### F-036 · P2 · CONFIRMED — ACTIVE draft not reconciled

- Evidence: `onboarding-container.tsx:156` (`serverProgress.state === 'ACTIVE'` → return).
- Impact: when the workspace draft says ACTIVE but the profile timestamp is missing (partial completion, F-044), the wizard neither resumes nor explains; the person sees a fresh wizard for an «active» business.
- Fix: on ACTIVE-without-activation, surface the recovery path (re-run completion writes) instead of silently starting over. Plan R1/R4.
- Regression: container guard test.
- Disposition: OPEN

### F-037 · P1 · CONFIRMED — Progress autosave failures swallowed

- Evidence: `onboarding-container.tsx:185` (`.catch(() => undefined)`).
- Impact: the person is never told the cross-device copy failed; a second device starts over with no explanation (prompt Phase-1 item).
- Fix: visible, non-blocking failure notice (once per failure streak) + retry on next change; never claim success. Plan R1.
- Regression: container wiring guard (no silent catch) + i18n key parity.
- Disposition: OPEN

### F-038 · P2 · CONFIRMED — Autosave without request coalescing

- Evidence: `onboarding-container.tsx:173-195` (effect fires on every answer change; the stable-function guard `stable-hook-functions.test.ts` fixed the render storm, not the per-keystroke writes).
- Impact: a PUT per answer toggle; rate-limit pressure (the 14 Nov incident named in `workspace-profile.ts:73-77`).
- Fix: debounce + latest-wins coalescing with an abort/sequence guard. Plan R1.
- Regression: coalescing unit test (fake timers).
- Disposition: OPEN

### F-039 · P2 · CONFIRMED — No ordering protection for overlapping progress writes (client AND server)

- Evidence: client effect has no sequence number; server `setOnboardingProgress` is last-write-wins (`workspace-profile.ts:222-240`).
- Impact: a slow earlier PUT can overwrite a newer answer.
- Fix: client sequence guard (drop stale responses) + server `savedAt` monotonicity (refuse strictly-older payloads). Plan R1/R4.
- Regression: out-of-order write test.
- Disposition: OPEN

### F-040 · P3 · CONFIRMED — Step zero excluded from autosave

- Evidence: `onboarding-container.tsx:174` (`step === 0` → return).
- Impact: none — step 0 is the welcome screen with no answers. Documented design.
- Disposition: VERIFIED_COMPLETE (design note).

### F-041 · P3 · CONFIRMED — Autosave skipped when operational profile unavailable

- Evidence: `onboarding-container.tsx:174` (`configurable !== true` → return); server answers `configurable:false` before `docs/operational-profile-01-migration.sql`.
- Impact: documented degraded mode (device copy only). Must be stated, not silent — covered by the recovery notice in F-055.
- Disposition: VERIFIED_COMPLETE (design; migration is an owner-run external step, see BLOCKED items).

### F-042 · P2 · CONFIRMED — Progress/DNA writes require `workspace.manage`; a delegated onboarder cannot save

- Evidence: `workspace-profile.routes.ts:112,139` (`requireCapability('workspace.manage')`); account PATCH allows initial trades for non-owners (`auth.routes.ts:874-885`).
- Impact: a delegated user completing onboarding gets 403 on every autosave/DNA write; the wizard completes via the account path but the workspace copy silently never exists.
- Fix: surface the 403 as the documented degraded mode (F-055 notice) rather than a generic failure; do not widen the permission. Plan R1.
- Regression: container guard test (403 → degraded notice, not success claim).
- Disposition: OPEN

---

## Domain C — Completion and workspace provisioning

### F-043 · P1 · CONFIRMED — Completion is a chain of independent sequential writes, not a coordinated workflow

- Evidence: `onboarding-container.tsx:226-289`: create-or-currency → `setPrimaryCurrency` → `updateProfile(onboardingCompleted:true)` → `saveWorkspaceProfile` → `saveOperationalDna` → `saveOnboardingProgress(ACTIVE)`.
- Impact: any later failure leaves earlier writes applied; the account is already ACTIVATED (timestamp written) while the workspace profile/DNA may be missing.
- Fix: reorder so activation is the LAST write, after every required persistence succeeded; make each step's failure stop the chain with an exact message. Plan R1.
- Regression: ordering guard test + fault-injection per boundary.
- Disposition: OPEN

### F-044 · P0 · CONFIRMED — Account activated before workspace profile and DNA are persisted

- Evidence: `onboarding-container.tsx:253-258` (`updateProfile({onboardingCompleted:true,...})`) precedes `:263` (workspace profile) and `:272` (DNA). The gate (`activation-gate.service.ts`) checks identity/workspace/name/currency only — it cannot see the not-yet-written profile/DNA.
- Impact: false activation success — the product's record says «set up» while the business configuration failed to persist (prompt starting points 44/49).
- Fix: activation last (with F-043); DNA/profile failures block activation when the server declared itself configurable. Plan R1.
- Regression: fault-injection test — DNA failure ⇒ no activation request.
- Disposition: OPEN

### F-045 · P1 · CONFIRMED — Null workspace-profile save result does not block or inform

- Evidence: `onboarding-container.tsx:263` (`await saveWorkspaceProfile(selected)` — return value discarded); hook returns `null` for `WORKSPACE_PROFILE_NOT_CONFIGURED` (`workspace-profile.ts:96-97`).
- Impact: completion claims success while the workspace declaration was not stored; no recovery information.
- Fix: when the server is configurable but the save returns null, treat as failure; when the migration is absent, show the explicit degraded-mode notice (F-055). Plan R1.
- Regression: container guard test.
- Disposition: OPEN

### F-046 · P1 · CONFIRMED — Null DNA save result does not block or inform

- Evidence: `onboarding-container.tsx:272` (result discarded); hook returns `null` for `OPERATIONAL_PROFILE_NOT_CONFIGURED` (`packages/api/src/hooks/workspace-profile.ts:184`).
- Impact: same class as F-045 for the 8-axis profile.
- Fix: same rule — configurable+null ⇒ failure; not-configured ⇒ documented degraded notice. Plan R1.
- Regression: container guard test.
- Disposition: OPEN

### F-047 · P1 · CONFIRMED — DNA version conflict refetched without reapplying user intent

- Evidence: `onboarding-container.tsx:273-278` (on `OPERATIONAL_PROFILE_CHANGED`: `await operational.refetch()` and continue).
- Impact: the person's answers are silently dropped; the other device's profile stands and the wizard still activates.
- Fix: retry the save ONCE with the refetched version (user intent reapplied); a second conflict is a visible failure that blocks activation. Plan R1.
- Regression: conflict-retry test (mocked hook).
- Disposition: OPEN

### F-048 · P0 · CONFIRMED — ACTIVE progress written after a DNA conflict

- Evidence: `onboarding-container.tsx:279-288` runs unconditionally after the catch-and-refetch.
- Impact: the workspace draft claims ACTIVE while the DNA actually stored is another device's — divergent «active» state.
- Fix: write ACTIVE only after the DNA save (or the documented degraded mode) succeeded. Plan R1.
- Regression: ordering guard test.
- Disposition: OPEN

### F-049 · P2 · CONFIRMED — Completion continues when the Operational Profile is unavailable, without telling the person

- Evidence: `onboarding-container.tsx:270` (`if (operationalView?.configurable === true)` — else the whole DNA+progress block is skipped silently).
- Impact: degraded mode is legitimate (migration pending) but invisible; the person believes the profile was saved.
- Fix: explicit notice + recovery text (F-055). Plan R1/R5.
- Disposition: OPEN

### F-050 · P2 · CONFIRMED — Local DNA updated before server confirmation

- Evidence: `onboarding-container.tsx:224` (`setOperationalDna(inferredDna)` before any network call).
- Impact: on failure the device shows a DNA the server never accepted.
- Fix: set the local DNA only after the server save succeeds (or in the documented degraded mode, labelled as device-only). Plan R1.
- Regression: container guard test.
- Disposition: OPEN

### F-051 · P0 · CONFIRMED — Dashboard navigation without authoritative activation readback

- Deduplicates with F-027 (same root cause: `onboarding-container.tsx:304-305`).
- Disposition: OPEN (fixed with F-027).

### F-052 · P1 · CONFIRMED — No idempotency protection on completion

- Evidence: client has no in-flight guard; server `PATCH /auth/profile` rewrites `onboarding_completed_at = now()` on every `onboardingCompleted:true` call (`auth.routes.ts:930`) — a replay moves the completion timestamp.
- Impact: duplicate submissions rewrite history; concurrent completions race the whole write chain.
- Fix: client single-flight guard; server keeps the FIRST timestamp (idempotent replay). Plan R1.
- Regression: backend test — second activation does not change the timestamp.
- Disposition: OPEN

### F-053 · P1 · CONFIRMED — No duplicate-submission guard on the finish button

- Evidence: `onboarding-page.tsx:630-644` (button never disabled/loading); `handleComplete` has no in-flight ref.
- Impact: double-click runs two full completion chains (two currency writes, two DNA saves, two ACTIVE writes).
- Fix: `submitting` state disables the button and re-entrancy is refused. Plan R1.
- Regression: UI guard test.
- Disposition: OPEN

### F-054 · P1 · CONFIRMED — Generic error messages hide partial persistence and prerequisite lists

- Evidence: `onboarding-container.tsx:294-301` maps everything except two currency codes to `onboarding.saveFailed`; the gate's 422 `missing` list (`auth.routes.ts:923-928`) is never shown.
- Impact: the person cannot know WHICH step failed or what is missing; retry is blind.
- Fix: map `ONBOARDING_PREREQUISITES_MISSING` to the exact missing prerequisites (translated), and name the failed step for chain failures. Plan R1/R5.
- Regression: message-mapping unit test + i18n parity.
- Disposition: OPEN

### F-055 · P1 · CONFIRMED — No recovery information after partial completion / degraded mode

- Evidence: no UI state anywhere describes «workspace created but profile not saved», «migration pending», or «another device's profile stands».
- Fix: one recovery notice component fed by the completion result (failed step / degraded reason / next action). Plan R1/R5.
- Regression: container guard + i18n parity.
- Disposition: OPEN

### F-056 · P2 · CONFIRMED — Workspace creation can be left incomplete after a later failure

- Evidence: `onboarding-container.tsx:231-241` creates the workspace, then later steps may fail; retry takes the `else` branch (workspace now exists) and re-applies answers — recoverable, but the person is not told the workspace already exists with their currency.
- Fix: the recovery notice (F-055) names the state; retry path already re-applies. Plan R1.
- Disposition: OPEN

### F-057 · P1 · TEST GAP — Retry idempotency not proven

- Fix: fault-injection tests per boundary + replay test (with F-052). Plan R6.
- Disposition: OPEN

### F-058 · P1 · TEST GAP — No fault-injection evidence for all completion boundaries

- Fix: one test per boundary (currency / workspace-profile / DNA / progress / activation) asserting the chain stops and nothing later is written. Plan R6.
- Disposition: OPEN

### F-059 · P3 · CONFIRMED — Currency written to the server before final confirmation (early save)

- Evidence: `onboarding-container.tsx:373-382` (`handleSetCurrency` saves immediately).
- Impact: documented early-save design; refusal is toasted. The defect is the missing rollback (F-061), not the early write itself.
- Disposition: VERIFIED_COMPLETE (design) — rollback fixed under F-061.

### F-060 · P2 · CONFIRMED — Local currency changed before server success

- Evidence: `onboarding-container.tsx:365-366` (`setDefaultCurrency` + `setPrimaryCurrency` before `saveBookCurrency.mutate`).
- Impact: on refusal the device formats every amount in a currency the books do not use.
- Fix: roll back both stores on error (with F-061). Plan R1.
- Disposition: OPEN

### F-061 · P1 · CONFIRMED — Failed currency update not rolled back

- Evidence: `onboarding-container.tsx:373-382` (onError only toasts).
- Fix: restore the previous currency in both stores on refusal; keep the toast. Plan R1.
- Regression: container guard test (rollback wiring).
- Disposition: OPEN

### F-062 · P3 · CONFIRMED — Duplicate currency writes (picker + completion)

- Evidence: `handleSetCurrency:373` and `handleComplete:245` both write the same choice.
- Impact: harmless second write when unchanged; kept for crash-safety (completion must not depend on the picker's earlier write having succeeded). Documented.
- Disposition: VERIFIED_COMPLETE (design note; completion write is the authoritative one).

### F-063 · P3 · CONFIRMED — Unsupported currency silently ignored in the setter

- Evidence: `onboarding-container.tsx:350-364` (documented unreachable from the picker; guards restored drafts).
- Impact: a stale draft with an unsupported code leaves the step silently unselected. The refusal is correct; add the translated notice when it fires from a restore. Plan R5 (bounded).
- Disposition: OPEN

### F-064 · P2 · CONFIRMED — Raw currency code in the review summary

- Evidence: `onboarding-container.tsx:100` (`currencyLabel = defaultCurrency`).
- Impact: the review shows «USD» instead of the localized currency name.
- Fix: use the shared currency catalogue's localized name (the picker already has it). Plan R5.
- Regression: label test.
- Disposition: OPEN

### F-065 · P3 · CONFIRMED — Store-size label fallback is the raw id

- Evidence: `onboarding-page.tsx:362` (`t(item.labelKey, item.id)`).
- Impact: a missing translation shows «solo» to a Persian user. Keys exist today (verified); the fallback is still wrong by policy.
- Fix: fall back to the Persian label constant, never the id. Plan R5.
- Disposition: OPEN

### F-066 · P2 · CONFIRMED — Store-size description duplicates the label key

- Evidence: `onboarding-page.tsx:305-330` (`descKey === labelKey` for all four sizes) rendered at `:364-366`.
- Impact: every size card prints its label twice.
- Fix: remove the duplicated description line (the label already carries the headcount). Plan R5.
- Regression: UI guard test.
- Disposition: OPEN

### F-067 · P1 · CONFIRMED — Optional business description even for custom industry

- Deduplicates with F-011.
- Disposition: OPEN (fixed with F-011).

### F-068 · P3 · CONFIRMED — Store size required in UI but absent from activation prerequisites

- Evidence: `onboarding-page.tsx:424` (Next disabled without size) vs `onboarding-gate.domain.ts:18-19` (prerequisites: identity/workspace/profile/currency).
- Impact: the gate is deliberately minimal (server-owned facts); the UI is stricter. A restored draft without size can complete via API. Documented asymmetry; align by requiring size in the container's completion check. Plan R1 (bounded).
- Disposition: OPEN

### F-069 · P2 · CONFIRMED — Weak email validation in the local first-run flow

- Evidence: `packages/ui/src/components/ui/onboarding/local-first-run-form.tsx:157-162` (plain text input, no `type="email"`, no validation); `offline-first-run.ts:63` forwards any trimmed string.
- Impact: «abc» is stored as the owner email of an offline business.
- Fix: `type="email"` + boundary validation (empty allowed — the field is optional; non-empty must be a valid address). Plan R5.
- Regression: form validation test.
- Disposition: OPEN

### F-070 · P3 · CONFIRMED — Business-name validation exists at the signup boundary

- Evidence: `signUpSchema` (`auth.schema.ts`), workspace name trimmed + `.slice(0,100)` (`auth.routes.ts:434-438`, `onboarding-container.tsx:232-234`).
- Disposition: VERIFIED_COMPLETE (authoritative schema at the boundary; length capped).

### F-071 · P3 · CONFIRMED — Currency schema/catalogue parity is test-guarded

- Evidence: `currency-catalogue-parity.test.ts` (named in `onboarding-container.tsx:356`), `CURRENCY_CODES` shared (`onboarding.slice.ts:5,19`).
- Disposition: VERIFIED_COMPLETE (execution recorded in coverage doc).

---

## Domain D — Operational DNA

### F-072 · P3 · TEST GAP — Keyboard accessibility of the wizard not tested

- Evidence: no keyboard-journey test for the wizard (`onboarding-*.test.ts` are logic/source guards).
- Fix: add a focus/keyboard guard for the option lists and segmented controls (shared components already carry roles). Plan R6 (bounded).
- Disposition: OPEN

### F-073 · P1 · CONFIRMED — Branch/warehouse answer labels missing in ALL three locales

- Evidence: measured 2026-11-22: `onboarding.operating.answers.branch.{single,multiple,unknown}` and `...warehouse.{none,single,multiple,unknown}` absent in fa/af/en (7 keys × 3). `operating-questions.tsx:97` falls back to the raw value.
- Impact: the Persian/Dari wizard shows English technical words («single», «multiple», «none», «unknown») for the branch and warehouse questions — a visible embarrassment on every onboarding.
- Fix: add the 7 keys in fa/af/en. Plan R5.
- Regression: extend the i18n parity guard to every option key the question engine can emit.
- Disposition: OPEN

### F-074 · P3 · CONFIRMED — Progress indicator has no accessible semantics

- Evidence: `onboarding-page.tsx:690-700` (five decorative divs; no `role="progressbar"`, no `aria-valuenow`, no label).
- Fix: add progressbar semantics + translated label. Plan R5.
- Disposition: OPEN

### F-075 · P1 · CONFIRMED — Unsaved text (business note) not preserved across refresh

- Deduplicates with F-031.
- Disposition: OPEN (fixed with F-031).

### F-076 · P2 · CONFIRMED — Directional arrows not flipped for RTL

- Evidence: `onboarding-page.tsx:108,262,420,483,559,642` (`ArrowRight` for next/finish, `ArrowLeft` for back, no `rtl:` flip). fa/af are RTL.
- Impact: «next» points the wrong way in the default locales.
- Fix: logical-direction classes (`rtl:-scale-x-100`) on the directional icons. Plan R5.
- Regression: UI guard test.
- Disposition: OPEN

### F-077 · P3 · CONFIRMED — Repeated Next/Back handling is idempotent but untested

- Evidence: `onboarding-page.tsx:674-682` (pure `setStep` calls); no test exercises repeated presses or resume-to-mid-wizard.
- Fix: covered by the step-clamp test (F-024) + a navigation guard. Plan R6.
- Disposition: OPEN

### F-078 · P3 · CONFIRMED — Suggested answers have deterministic, documented persistence semantics

- Evidence: `onboarding-container.tsx:131-134` (`{...suggestedOperatingAnswersFor(selectedTrades), ...ownAnswers}` — own answers always win); only `ownAnswers` are persisted (`:182`).
- Impact: suggestions are recomputed, never stored as user intent — the provenance question (prompt 78/86) is answered by construction.
- Disposition: VERIFIED_COMPLETE (design; user override provenance = the persisted `operating` map).

### F-079 · P3 · CONFIRMED — Missing answer and explicit «unknown» behave identically

- Evidence: `operational-dna.ts:704-705` (`said()` maps both undefined and 'unknown' to the trade suggestion).
- Impact: documented V54 semantics («unknown leaves the trade's default»); the schema distinguishes them but inference intentionally does not. Recorded as a design decision, not a defect.
- Disposition: VERIFIED_COMPLETE (design note).

### F-080 · P3 · RISK — Unsupported question types fall back to generic yes/no options

- Evidence: `operating-questions.tsx:51-57` (default branch returns `YES_NO`).
- Impact: today every `OperatingQuestion` is handled; a future question type would silently render wrong options.
- Fix: exhaustive switch with a compile-time exhaustiveness check. Plan R3 (bounded).
- Regression: type-level guard test.
- Disposition: OPEN

### F-081 · P3 · CONFIRMED — Answer option lists restated in the UI beside the schema enums

- Evidence: `operating-questions.tsx:40-49` (value arrays) vs `operational-dna.ts:1155-1180` (zod enums).
- Impact: drift risk; the parity guard added with F-073 closes it.
- Disposition: OPEN (fixed with F-073's guard).

### F-082 · P3 · CONFIRMED — Legacy question alias `locations` retained deliberately

- Evidence: `operating-questions.tsx:52-53`, `operational-dna.ts:1137-1138,1345` (read when `branches` absent).
- Disposition: VERIFIED_COMPLETE (backward compatibility by design).

### F-083 · P3 · CONFIRMED — Staff-arrangement terminology disambiguated via the operator noun

- Evidence: `operating-questions.tsx:78-83` (suffix uses `operatorLabelKey`).
- Disposition: VERIFIED_COMPLETE.

### F-084 · P3 · CONFIRMED — Question selection receives the merged answers (suggestions included)

- Evidence: `operatingQuestionsFor(answers)` (`operating-dna.ts:1338`) fed with the merged map (`onboarding-container.tsx:131-134,738`).
- Impact: prompt starting point 84 is satisfied indirectly but correctly; industries influence the questions through their suggestions.
- Disposition: VERIFIED_COMPLETE.

### F-085 · P3 · CONFIRMED — Multi-industry defaults merged with an explicit deterministic rule

- Evidence: `suggestedOperatingAnswersFor` (`operational-dna.ts:1320-1331`, «yes» wins, documented); scalar-axis conflicts resolved primary-first (`composeOperationalDna:1034-1040`, documented).
- Disposition: VERIFIED_COMPLETE.

### F-086 · P3 · CONFIRMED — Provenance of suggested vs user values is structural

- Deduplicates with F-078.
- Disposition: VERIFIED_COMPLETE.

---

## Domain E — Capability and industry resolution

### F-087 · P3 · CONFIRMED — Capability statuses are evidence-based and test-guarded

- Evidence: `business-capabilities.ts:436-471` (`CapabilityStatus`, `CapabilityEvidence`), `capability-claims-match-code.test.ts`, `capability-has-consumer.test.ts`, `capability-composition.test.ts`.
- Disposition: VERIFIED_COMPLETE (execution recorded in coverage doc).

### F-088 · P3 · RISK — Capability label can fall back to the raw key

- Evidence: `composition-plan-summary.tsx:97` (`t(CAPABILITIES[capKey]?.labelKey ?? capKey)`).
- Impact: guarded today by `capability-view-translations.test.ts`; the fallback remains a raw-key path.
- Fix: keep the guard; no code change needed beyond the existing test. Recorded.
- Disposition: VERIFIED_COMPLETE (guard exists).

### F-089 · P2 · CONFIRMED — Feature-pack label keys not covered by the parity measurement

- Evidence: `composition-plan-summary.tsx:205` (`t('packs.${packId}.label')`); the audit's parity check covered onboarding/businessType/terminology/offlineFirstRun only.
- Fix: extend the parity guard to `packs.*` and `capabilities.*` emitted by the summary. Plan R5/R6.
- Disposition: OPEN

### F-090 · P3 · CONFIRMED — Suggested feature-pack ids come from the typed registry

- Evidence: `FEATURE_PACKS` referenced by key in `composition-plan-summary.tsx:205`; packs produced by the shared resolver, not free text.
- Disposition: VERIFIED_COMPLETE.

### F-091 · P3 · CONFIRMED — «Available» vs «partial» vs «planned» distinguished in the summary

- Evidence: `composition-plan-summary.tsx:140,154,177` (three sections) + limitations text (`:40-42`).
- Disposition: VERIFIED_COMPLETE.

### F-092 · P3 · CONFIRMED — Industry profiles influence navigation through the presentation profile

- Evidence: `suggestedHiddenMenuPaths(dna)` consumed at `composition-plan-summary.tsx:90`; `presentationProfileSchema.navigation` (`operational-dna.ts:216-222`).
- Disposition: VERIFIED_COMPLETE.

### F-093 · P3 · CONFIRMED — Profiles grant no authorization

- Evidence: `workspace-profile.ts:22-23` (explicit invariant), `requireCapability` on every write route.
- Disposition: VERIFIED_COMPLETE.

### F-094 · P2 · RISK — Industry profile and Operational DNA can diverge

- Evidence: two stored sources (`workspaces.business_types`, `workspaces.operational_dna`) with two resolvers (`resolveBusinessProfile`, `resolveDnaCapabilities`); nothing re-derives one from the other after an edit.
- Impact: editing trades in settings without re-saving DNA (or vice versa) leaves vocabulary/capabilities disagreeing.
- Fix: document the ownership rule (DNA is derived at onboarding; settings edits must re-infer) and add a divergence diagnostic to the operational view. Plan R3 (bounded: diagnostic, not a second engine).
- Disposition: OPEN

### F-095 · P3 · CONFIRMED — Question/answer schema parity exists

- Evidence: `operational-dna.test.ts`, `operatingAnswersSchema` strict object matching `YES_NO_QUESTIONS` + scope questions.
- Disposition: VERIFIED_COMPLETE.

### F-096 · P1 · TEST GAP — Capability availability lacks end-to-end (live) evidence

- Evidence: unit/claim tests exist; no live-workspace verification was performed in this session (no production access authorized).
- Disposition: BLOCKED (live verification is an owner-run step; see final report).

---

## Domain F — Backend, database and API contracts

### F-097 · P2 · CONFIRMED — Account and workspace industry profiles persisted separately with different rules

- Evidence: `profiles.business_types` (account, `auth.routes.ts:932`, max 20, unvalidated) vs `workspaces.business_types` (workspace, `workspace-profile.ts:94-131`, max 12, canonical, owner-managed).
- Impact: the two copies can disagree; screens read the account copy while capabilities read the workspace copy.
- Fix: same canonicalisation + same limit on both writes (F-007/F-017); keep the two copies (owner decision D4) but make divergence impossible at write time. Plan R2.
- Disposition: OPEN

### F-098 · P2 · CONFIRMED — Profile APIs use different authorization paths

- Evidence: account PATCH: owner-of-ANY-workspace check (`auth.routes.ts:874-885`); workspace PUT: `workspace.manage` on the CURRENT workspace (`workspace-profile.routes.ts:68`).
- Impact: an owner of workspace A can change their account industry while acting in workspace B (where they are a member) — the account copy moves, B's copy does not.
- Fix: document + align the account write with the active workspace context when one exists. Plan R2 (bounded: refuse non-owner-of-active-workspace when a workspace context is present).
- Disposition: OPEN

### F-099 · P2 · CONFIRMED — Invalid stored DNA silently becomes null (server AND client)

- Evidence: `backend/src/services/workspace-profile.ts:182-184` («reported as absent, not repaired»), `packages/api/src/hooks/workspace-profile.ts:130,139`.
- Impact: a corrupt row looks like «never configured»; the person re-onboards over data that exists but cannot be read, with no diagnostic.
- Fix: carry an explicit `dnaInvalid`/`onboardingInvalid` diagnostic in the view (additive), surfaced as a setup gap; never silently null. Plan R3.
- Regression: service/view test — invalid payload ⇒ diagnostic flag, not plain null.
- Disposition: OPEN

### F-100 · P2 · CONFIRMED — Online/offline activation parity not fully proven; shell hardcodes `cloudActivated:false`

- Evidence: `packages/app-shell/src/features/auth/require-auth.tsx:55-62` (`cloudActivated: false` always, `localCompletedAt: 'local'` fake timestamp).
- Impact: a cloud-activated desktop business is always classified `COMPLETE_OFFLINE`; `mayClaimCloudActivated` is never true, so sync-status UI cannot distinguish.
- Fix: feed the verified server answer (`serverCompleted === true`) and a real local completion timestamp. Plan R4.
- Regression: RequireAuth decision test.
- Disposition: OPEN

### F-101 · P1 · CONFIRMED — Client can write `ACTIVE` onboarding progress without passing the activation gate

- Evidence: `workspace-profile.routes.ts:137-147` accepts any `onboardingProgressSchema` state including `ACTIVE`/`READY_TO_ACTIVATE`; `setOnboardingProgress` (`workspace-profile.ts:222-240`) stores it verbatim. The hard gate protects `profiles.onboarding_completed_at` only.
- Impact: the workspace draft can claim ACTIVE while the account is not activated — the exact «two sources of truth» the gate exists to prevent; resume logic (F-036) then misbehaves.
- Fix: server-side state-machine guard — client writes may set NOT_STARTED/IN_PROGRESS/PAUSED only; READY_TO_ACTIVATE/ACTIVE are derived from the gate facts, never accepted from the body. Plan R1.
- Regression: route/service test — ACTIVE from client refused (422), derived state computed.
- Disposition: OPEN

### F-102 · P2 · CONFIRMED — Workspace-scoped queries use workspace-agnostic cache keys

- Evidence: `packages/api/src/hooks/workspace-profile.ts:40,123` (`['workspace-profile']`, `['workspace-operational-profile']`).
- Impact: mitigated today because workspace switching reloads the page (`enter-workspace.ts:17-18`), but any future in-place switch leaks cached profile data across workspaces.
- Fix: include `workspaceId` in both query keys. Plan R4.
- Regression: key-scoping test.
- Disposition: OPEN

### F-103 · P3 · CONFIRMED — Client view parser silently filters non-string industry ids

- Evidence: `packages/api/src/hooks/workspace-profile.ts:47-48` (`strings()` filter).
- Impact: malformed server data becomes a shorter valid-looking list instead of an error.
- Fix: with F-099's diagnostic approach — report invalid entries, don't hide them. Plan R3.
- Disposition: OPEN

### F-104 · P2 · CONFIRMED — Composition plan cast without runtime validation

- Evidence: `packages/api/src/hooks/workspace-profile.ts:132-136` (`rawComposition as CompositionPlan`).
- Impact: a malformed composition reaches consumers as a typed object.
- Fix: validate with the shared schema (or refuse to null + diagnostic). Plan R3.
- Disposition: OPEN

### F-105 · P2 · CONFIRMED — `updateProfile` merges the REQUEST over the cached user when the response payload is unreadable

- Evidence: `packages/store/src/slices/auth.slice.ts:285-290` (`payload?.user ?? {}` then `{...user, ...input, ...updated}`).
- Impact: a 200 with an unparseable body leaves `onboardingCompleted:true` locally from `input` — unverified success (feeds F-027).
- Fix: when the payload carries no user, refetch/verify instead of merging the request; never adopt `onboardingCompleted` from the request body. Plan R1.
- Regression: auth-store test.
- Disposition: OPEN

### F-106 · P3 · CONFIRMED — Signup workspace-provisioning failure is logged with the user and recoverable

- Evidence: `auth.routes.ts:421-448` (documented GAP-01 decision; `createWorkspace` is one transaction; onboarding creates the workspace on failure).
- Disposition: VERIFIED_COMPLETE (design with evidence).

### F-107 · P1 · CONFIRMED — Missing onboarding columns only warn; the client still navigates

- Evidence: `auth.routes.ts:950-954` (`written.onboardingColumnsMissing` → log warn), response `onboardingCompleted` then false; container ignores it (F-027).
- Impact: on a database without `docs/onboarding-server-state-migration.sql`, completion «succeeds» locally and every dashboard API call answers 428.
- Fix: the readback requirement (F-027) turns this into a visible, recoverable failure naming the migration. Plan R1.
- Disposition: OPEN (fixed with F-027; migration itself is owner-run).

---

## Domain G — Offline-first and local engine

### F-108 · P2 · CONFIRMED — Stale «server says false» resets locally-completed offline work

- Evidence: `require-auth.tsx:44-46` and `dashboard-layout.tsx:232-236` reset the store whenever `serverCompleted === false`, including a cached user read while offline. The domain rule says the opposite (`offline-onboarding.domain.ts:43-45`: «a stale/unknown server answer must never take local work away»).
- Impact: an offline device that completed the local first run can lose its completion flag to a stale cached account answer.
- Fix: reset only on a FRESH online answer; keep local completion when offline. Plan R4.
- Regression: guard test (offline + stale false ⇒ no reset).
- Disposition: OPEN

### F-109 · P3 · CONFIRMED — Fake local completion timestamp

- Evidence: `require-auth.tsx:56` (`localCompletedAt: localCompleted ? 'local' : null`).
- Impact: the domain contract expects a timestamp; recency comparisons (F-035) cannot use «local».
- Fix: store a real `completedAt` in the onboarding slice at completion. Plan R4.
- Disposition: OPEN (fixed with F-100/F-035).

### F-110 · P3 · CONFIRMED — Offline first-run lookup/create fail closed and are tested

- Evidence: `offline-first-run.ts:35-48` (failed read throws, never «empty»), `offline-first-run.test.ts`.
- Disposition: VERIFIED_COMPLETE.

### F-111 · P2 · TEST GAP — Offline→online reconciliation of the wizard draft not proven

- Evidence: no executed test reconciles a locally completed offline business with a later cloud activation (the domain predicate is tested; the wiring is not).
- Fix: decision-level test with the real store facts (with F-100/F-108). Plan R6.
- Disposition: OPEN

### F-112 · P3 · CONFIRMED — Local engine has no operational-profile routes; offline parity is by design device-copy only

- Evidence: `packages/api/src/hooks/workspace-profile.ts:111-112` (explicit «Online only» note).
- Impact: documented; the offline wizard never claims server保存. Covered by the degraded notice (F-055).
- Disposition: VERIFIED_COMPLETE (design note).

---

## Domain H — UX, accessibility, localization

### F-113 · P2 · CONFIRMED — Primary-picker labels show raw ids for sales-model selections

- Evidence: `onboarding-page.tsx:227-228` (`trades.find(...)?.label ?? id` — `trades` excludes `BUSINESS_MODELS`, so a selected «retail»/«wholesale» chip shows the raw id).
- Fix: look up models + trades + other (one catalogue lookup). Plan R5.
- Regression: UI guard test.
- Disposition: OPEN

### F-114 · P1 · CONFIRMED — Branch/warehouse option keys missing in fa/af/en

- Deduplicates with F-073 (measured evidence there).
- Disposition: OPEN (fixed with F-073).

### F-115 · P3 · CONFIRMED — Wizard finish button has no loading state

- Deduplicates with F-053.
- Disposition: OPEN (fixed with F-053).

### F-116 · P2 · CONFIRMED — Server progress endpoint has no state-machine guard

- Deduplicates with F-101 (same root cause).
- Disposition: OPEN (fixed with F-101).

### F-117 · P3 · CONFIRMED — Activation gate targets owner-workspace-or-first for multi-workspace accounts

- Evidence: `activation-gate.service.ts:56-58` (`memberships.find(owner) ?? memberships[0]`, documented tenancy rule).
- Impact: deterministic and documented; a delegated user's activation is judged on the owner workspace. Recorded.
- Disposition: VERIFIED_COMPLETE (design note).

### F-118 · P3 · CONFIRMED — Currency picker shared between online wizard and offline first run

- Evidence: `onboarding-page.tsx:470-477` (comment + `CurrencyPicker` reuse), `local-first-run-form.tsx`.
- Disposition: VERIFIED_COMPLETE.

### F-119 · P3 · CONFIRMED — Onboarding route matching is test-guarded

- Evidence: `packages/ui-contract/src/__tests__/onboarding-route-matcher.test.ts`, `onboarding-bootstrap-guard.test.ts`.
- Disposition: VERIFIED_COMPLETE.

### F-120 · P1 · TEST GAP — No executed browser journey for multi-industry completion

- Evidence: the 14 Nov incident note (`workspace-profile.ts:73-77`) shows browser journeys exist as a practice, but no multi-industry completion journey is in the repo's executed test set.
- Fix: the fault-injection + ordering suite (R6) covers the chain deterministically; a live browser journey remains an owner-run verification. Plan R6.
- Disposition: OPEN

---

## Summary at audit time

| Severity                         | Count                          |
| -------------------------------- | ------------------------------ |
| P0                               | 4 (F-027, F-044, F-048, F-051) |
| P1                               | 27                             |
| P2                               | 33                             |
| P3                               | 34                             |
| Already verified (design/guards) | 22                             |

Deduplication: F-009→F-003, F-021/F-022/F-030→F-014, F-051→F-027, F-067→F-011,
F-075→F-031, F-086→F-078, F-114→F-073, F-115→F-053, F-116→F-101.
Distinct root causes: 101. Total recorded findings: 120.

Final dispositions are recorded in `ONBOARDING-REGRESSION-COVERAGE.md` and the
Persian execution report after implementation and test execution.
