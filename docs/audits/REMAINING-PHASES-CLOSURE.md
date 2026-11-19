# Closure of the 13 Remaining Units — Evidence and Honest Status

**Baseline:** `b54636fa` · 19 Nov 2026 · **Overall:** `PARTIALLY_IMPLEMENTED`
This document maps each of the 13 previously untouched units to what was actually done, what was
deliberately not wired, and why. No claim is made without a test or a file.

## 1. PART 5 Slice 1 — shared contracts / offline primary runtime

**Status: SATISFIED BY EXISTING GUARD (verified).** `architecture-boundaries.test.ts` proves
`packages/validation` imports no UI, API, shell, Electron, Expo, Supabase, `better-sqlite3` or `pg`,
and that no second domain package may exist. Re-run: **41 passed** across that guard plus the two
industry guards. No second engine was created.

## 2. PART 5 Slice 2 — entity coverage

**Status: PARTIAL.** `device-operation-reads.test.ts` already enforces PULLED_TABLES ↔ DELTA_ENTITIES
parity and a closed `NOT_PULLED_YET` list. The four server triggers are now prepared in
`docs/sync-entity-coverage-migration.sql`. Local lists were **deliberately not widened**: the server
cannot emit those changes until the owner applies the migration, and a device waiting for them would
never become ready. That step is an explicit owner action in `docs/prompts/THE-LAST.md` PART 11.

## 3. PART 5 Slice 3 — portable archive

**Status: PARTIAL.** Full table coverage, `PRAGMA`-driven reads, explicit `coverage` and refusal of an
archive with a missing required table are implemented and tested (`export-coverage.test.ts`, 3/3).
Local restore is still absent — it needs a safe import path, not a guessed overwrite.

## 4. PART 5 Slice 4 — Migration Center preflight

**Status: CONTRACT READY, NOT WIRED.** `migration-preflight.domain.ts` validates format/schema/
sections/checksum and produces a deterministic, time-free idempotency key (4 tests green). It is not
called from `CloudMigrationService.createJob` because the current upload contract
(`createJobSchema`) carries `previewMetrics` but **no manifest facts** — wiring it with invented
facts would be a fake preflight. The route contract must gain the manifest before this can be real.

## 5. PART 5 Slice 5 — Hybrid activation

**Status: CONTRACT READY, NOT WIRED.** `hybrid-activation.domain.ts` names the four mutation phases,
requires five prerequisites before activation, and forbids replaying imported history (3 tests
green). No activation endpoint exists to call it; adding one would need the server migration and a
device-registration contract first.

## 6. PART 5 Slice 6 — flexible topology

**Status: CONTRACT IMPLEMENTED.** `device-topology.domain.ts` defines PRIMARY_DEVICE / LOCAL_SERVER /
LAN_CLIENT, marks only PRIMARY_DEVICE operational, and refuses a LAN client without LAN auth
(3 tests green). Wired into the app-shell auth gate so the desktop/mobile decision comes from one
shared rule. This is a contract, **not** a LAN feature.

## 7. V2 Phase B — business core integrity

**Status: SATISFIED BY EXISTING GUARD (verified).** The one-definition-per-rule guard in
`architecture-boundaries.test.ts` covers the canonical business rules. No duplicate engine added.

## 8. V2 Phase C — complete workflows

**Status: DOCUMENTED, NOT EXECUTED.** `docs/audits/V2-PHASE-REVIEW.md` records that no full
UI→persistence sweep was performed. A route or a page alone is not a workflow; doing this properly
needs browser E2E, which is unavailable here.

## 9. V2 Phase D — industry generalization

**Status: SATISFIED BY EXISTING GUARD (verified).** `industry-profiles.test.ts:236` asserts unknown
input resolves to the generic profile and is reported, never guessed as Retail. `other` remains the
escape hatch with no specialised operator. No SUPPORTED claim was fabricated.

## 10. V2 Phase G — Web / Windows / Mobile

**Status: PARTIAL.** `packages/app-shell/src/features/auth/require-auth.tsx` now uses the shared
offline-onboarding decision, so desktop/mobile no longer keep a separate rule. tsc 0, eslint 0.
Physical host verification remains blocked.

## 11. V2 Phase I — performance

**Status: NOT MEASURED.** No real device or production-scale dataset is available; reporting made-up
thresholds would be worse than none. No optimisation was claimed.

## 12. V2 Phase J — observability / recovery

**Status: NOT IMPLEMENTED.** No correlation IDs or new recovery tests were added. Existing
correlation/error infrastructure was not modified to avoid unverifiable changes.

## 13. PART 7 §6/§9/§10 — offline behaviour, UX, definition of done

- **§6 implemented:** `offline-onboarding.domain.ts` — local completion is sufficient for offline
  business use; cloud activation only grants the cloud claim; incomplete work resumes at the real
  step; wired into the app-shell gate (12 tests total in the contracts test file, all green).
- **§9 documented:** `docs/onboarding/ONBOARDING-ARCHITECTURE.md` states the required UX criteria
  (why a field is asked, progress, only relevant questions, safe back, required vs optional,
  completion summary, first action) — not verified on a real screen.
- **§10 NOT MET:** a new user cannot yet be proven blocked in a browser, the 10 scenarios are
  fixtures only, and live PG/device witnesses are unavailable. Honest status: `PARTIALLY_IMPLEMENTED`.

## Verification of this closure

| Command                                                                                                                                             | Result                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `npx vitest run src/__tests__/unified-architecture-contracts.test.ts`                                                                               | **12 passed**            |
| `npx vitest run src/__tests__/architecture-boundaries.test.ts src/__tests__/industry-profiles.test.ts src/__tests__/industry-profile-guard.test.ts` | **41 passed**            |
| `npx tsc --noEmit` packages/app-shell                                                                                                               | **0 errors**             |
| `npx eslint src/features/auth/require-auth.tsx`                                                                                                     | **0 warnings, 0 errors** |

Nothing in this document was committed or applied to a live system.
