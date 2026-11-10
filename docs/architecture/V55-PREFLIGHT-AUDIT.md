# V55 — Preflight Audit (Phase 0)

**Date:** 2026-11-11 · **HEAD:** `56f31842e3efd2e473615fb672c7ae0d2661dcf0` (branch `main`)
**Working tree:** clean before this phase (`git status --short` empty).
**Code intelligence:** index was MISSING → rebuilt once with the sanctioned
`node scripts/build-ai-index.mjs` (2,017 files, 19,248 symbols, 71,479 relationships) → `FRESH`.
**Environment:** sandbox Linux, Node v24.22.2, pnpm 11.9.0 activated via corepack.
`pnpm install --frozen-lockfile` succeeded (no lockfile change). No build run. No live DB access.

This audit states only what was read in the actual source this session. Every claim names a file
and line. Items marked **CONFIRMED** were reproduced from code; **REFUTED** items are audit leads
that the current source disproves.

---

## 1. Repository snapshot

- pnpm + Turbo monorepo: `apps/{web,desktop,mobile,admin}`, `backend`, and packages
  `api, app-bridge, app-shell, auth, auth-core, config, db-schema, design-tokens, formatting,
i18n, local-engine, mobile-ui, store, sync, ui, ui-contract, validation` (`.ai/codebase/CODEBASE_MAP.md`).
- Ownership matches §3 of the mission. `apps/mobile` imports `app-shell`/`api`/`store`, never `ui` (map §2).

## 2. Canonical implementations (verified — do not duplicate)

| Concern                              | Canonical file                                                                                                                     | Evidence                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Sales-model / trade catalogue        | `packages/ui-contract/src/business-types.ts`                                                                                       | 2 sales models (`retail`, `wholesale`), 67 trades + `other`                                               |
| Industry registry + profile resolver | `packages/validation/src/schemas/industry-profiles.ts`                                                                             | `INDUSTRY_KEYS` (71 keys incl. legacy `other`), `resolveBusinessProfile` L515                             |
| Operational DNA (8 axes)             | `packages/validation/src/schemas/operational-dna.ts`                                                                               | enums L18–103, `inferOperationalDna` L313, `resolveDnaCapabilities` L204                                  |
| Capability engine                    | `packages/validation/src/schemas/business-capabilities.ts`                                                                         | 13 keys, statuses 4×available / 5×partial / 4×planned, `resolveCapabilities` L391, registry guard L488    |
| Workspace profile persistence        | `backend/src/services/workspace-profile.ts`                                                                                        | reads `workspaces.business_types`, DNA via `workspace_set_operational_dna` RPC (versioned, history table) |
| Onboarding wizard                    | `packages/ui/src/components/ui/onboarding/containers/onboarding-container.tsx` + `onboarding-page.tsx` + `operating-questions.tsx` | 6-stage wizard, adaptive questions, server resume (L136–151), per-answer progress save (L157–179)         |
| DNA → menu suggestion                | `packages/ui/src/lib/menu/dna-menu-suggestion.ts`                                                                                  | suggestion only, never a lock (owner decision N-8)                                                        |
| DNA settings editor                  | `packages/ui/src/components/ui/settings/operating-profile-settings.tsx`                                                            | same question engine, optimistic-version save                                                             |

## 3. Defect verification (mission §2.4 / §2.5)

### A. Onboarding primary industry — **CONFIRMED (HIGH)**

- `resolveBusinessProfile` decides the primary **in registry order** (`industry-profiles.ts` L523–524,
  ADR rule: explicit → first trade in registry order → first model → null).
- The onboarding container decides it in **insertion order**:
  `onboarding-container.tsx` L107–112 (`primaryTrade = businessType.split(',')[0]`) and L207
  (`tradeKey: selected[0]`). Selecting «pharmacy, jewellery» suggests jewellery's behaviour in the
  wizard while the stored profile resolves pharmacy.
- Same insertion-order bug family in `packages/ui/src/hooks/use-operational-dna.ts` L36–40
  (`types[0]` — correct only while the server copy is registry-ordered; the user-level copy is not)
  and `operating-profile-settings.tsx` L62 (`businessTypes[0]`).
- No explicit-primary hand-off exists anywhere in the wizard: the ADR's rule 1 (explicit wins) is
  never exercised from onboarding.

### B. Unknown DNA inference — **CONFIRMED (HIGH)**

`operational-dna.ts`, generic path of `inferOperationalDna`:

- L343–347: `holdsStock === 'unknown'` (no trade suggestion) → `offering: ['PHYSICAL_GOODS']`.
- L366–370: same input → `inventory: ['RETAIL_STOCK']`.

So an all-unknown business silently becomes a retail shop — exactly the prohibited fabrication.
Additionally the trade branches overwrite an explicit negative:

- L360–362: repair-driven with explicit `holdsStock:'no'` → `SPARE_PARTS` anyway.
- L363–365: appointment-driven with explicit `holdsStock:'no'` → `SERVICE_CONSUMABLES` anyway
  (only `RETAIL_STOCK` is gated on the answer).

This violates the answer precedence (explicit answer > industry suggestion > unknown).

### C. Onboarding already adaptive — **CONFIRMED** (not a gap)

`OperatingQuestions`, `operatingQuestionsFor` (L535), `suggestedOperatingAnswers` (L513), progress
hooks and resume exist. Nothing was rebuilt.

### D. Capability engine exists — **CONFIRMED**

13 capabilities with dependency/conflict/version resolution and a registry validator. No second
engine created.

### E. Profile resolver exists — **CONFIRMED**

`canonicalIndustryTypes`, deterministic primary rule, capability union, generic fallback. No second
registry created.

## 4. False / outdated audit claims

- Mission §4 says "current visible business models include retail and wholesale. Do not assume
  service… are valid sales-model IDs" — **still true**; `BUSINESS_MODELS` has exactly 2 entries.
- «`tradeKey: selected[0]`» (§2.5 A) — **confirmed unchanged** on this HEAD.
- V54 claim "DNA is persisted server-side, versioned and workspace-scoped" — **confirmed**:
  `docs/operational-profile-01-migration.sql` (jsonb + append-only history + version RPC);
  `backend/src/services/workspace-profile.ts` L187–213.

## 5. Capability-state reality check (status honesty)

Registry statuses are wired to real evidence paths (`business-capabilities.ts` L82–282): partial
entries name their missing links (`variants`: not bound to invoice line / stock movement;
`serialized_items`: sale does not claim serial; `auto_fitments`: core charge not applied;
`gold_purity`/`making_charges`: line pricing not wired). `batch_expiry` and `recipe_bom` are
`planned` while the pharmacy profile requests `batch_expiry` — the resolver correctly refuses
planned requests (`industry-profiles.ts` L351–353 filters to `USABLE_CAPABILITIES`; diagnostics
report the refusal). **No dishonest status was found in the registry itself.**

## 6. Consumers checked before any change (Rule: no enum addition without consumer audit)

| Consumer                                                                   | Effect of adding an `UNRESOLVED` axis value                                                         | Safe?                                                 |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `resolveDnaCapabilities` (L204)                                            | `.includes()` checks only → nothing extra activated                                                 | ✅ conservative                                       |
| `dna-menu-suggestion.ts`                                                   | would suggest hiding `/warehouse`,`/till`,`/manufacturing` for unresolved stock                     | ⚠️ needs a conservative guard (added with this audit) |
| backend `operationalDnaSchema.safeParse` (`workspace-profile.ts` L177/193) | additive enum value parses                                                                          | ✅                                                    |
| DB storage (`docs/operational-profile-01-migration.sql` L36–41)            | jsonb, size-only CHECK — no enum constraint                                                         | ✅                                                    |
| `packages/local-engine`                                                    | no reference to DNA enums (only a sync route label in `routes/me.ts` L35)                           | ✅                                                    |
| `operating-profile-settings.tsx`                                           | never renders enum values                                                                           | ✅                                                    |
| i18n                                                                       | terminology labelKeys are not yet rendered anywhere at runtime (only defined) — no `t()` throw risk | ✅                                                    |

## 7. Implementation gaps this session will close (P0 slice)

1. One canonical primary-industry decision — new exported `primaryIndustryKeyOf()` in
   `industry-profiles.ts`, used by `resolveBusinessProfile`, the onboarding container,
   `use-operational-dna.ts` and `operating-profile-settings.tsx`.
2. Unknown-safe `inferOperationalDna`: explicit `no` beats every suggestion; unknown no longer
   fabricates `PHYSICAL_GOODS`/`RETAIL_STOCK` (new backward-compatible `UNRESOLVED` axis value,
   consumer-audited above).
3. Conservative menu suggestion for unresolved DNA (suggest hiding nothing).
4. Regression tests for all five mandatory cases (mission §15.2) + primary-industry determinism.

**Deferred (recorded, not silently dropped):** capability vertical slices (§8 of the mission),
warehouse location workflow, offline parity tests — these are follow-on phases needing larger
domain decisions; they are listed in `V55-IMPLEMENTATION-PROGRESS.md` with exact next actions.
No migration is required for this slice (jsonb is constraint-free on the axis level; no schema
change, no i18n keys).
