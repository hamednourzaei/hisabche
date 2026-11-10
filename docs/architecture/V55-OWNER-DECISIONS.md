# V55 — OWNER DECISIONS (open; nothing below has been applied)

**Date:** 2026-11-11 · Companion to `V55-FINAL-COMPLETION-AUDIT.md` and
`V55-IMPLEMENTATION-PROGRESS.md`.

Both decisions below are business policy. The code currently implements the
conservative default and stays on it until the owner picks an option. Each
option names its real cost — data model, history, FIFO/AVCO, returns,
reporting, offline, risk — so the decision can be made from this page alone.

---

## Decision A — Variant-level costing

### Current model (verified in source)

- `cost_layers` is keyed **(workspace_id, product_id, warehouse_id)** on both
  runtimes: server `backend/src/services/inventory-costing/*` and the local
  `cost_layer` table (`packages/app-bridge/src/local-books-schema.ts`).
- A sale's consumption trail is
  `invoice line (consumer_line) → cost_consumption → cost layer → purchase
document (source_id / source_line)`. The VARIANT rides on the invoice line
  and the stock movement (`variant_id` since variant-binding-01 /
  variant-stock-01 / purchase-variant-binding-01), so every unit of stock is
  traceable to its variant and its purchase document — through the LINE, not
  through a layer column.
- FIFO consumes the oldest product layer; AVCO averages across the product's
  layers. Variant stock is «movements of the parent product» and the parent's
  total is the sum of those movements, so product-level costing is the
  coherent reading of the current architecture.
- Registry: `variants.limitations = ['COST_LAYERS_ARE_PRODUCT_KEYED']`.

### Option A — Product-level costing (STATUS QUO — recommended default)

Cost layers stay (workspace, product, warehouse). Variant identity stays on
invoice lines, movements and purchase lines.

- **Data model:** none. No migration, no backfill.
- **History:** none touched; every historical report keeps its numbers.
- **FIFO:** unchanged. The oldest carton of the PRODUCT is consumed, whichever
  variant it arrived under.
- **AVCO:** unchanged; the average is over the product's layers.
- **Returns:** unchanged; the reversal restores product-level layers, the
  `netReversal` key already carries the variant for identity.
- **Reporting:** profit per PRODUCT is exact. Profit per VARIANT is derivable
  only where a variant's sale consumed layers the shop can attribute by hand.
- **Offline sync:** none — the local `cost_layer` schema stays as is.
- **Complexity / risk:** lowest. Nothing to re-verify, nothing to migrate.
- **When it is wrong:** when one variant systematically costs more than
  another (sizes bought from different suppliers) and the owner wants variant
  margin to be exact, not approximated.

### Option B — Variant-level costing

Cost layers become keyed (workspace, product, **variant**, warehouse), subject
to backward-compatible handling of everything already consumed.

- **Data model:** additive migration — `cost_layers.variant_id` (nullable) +
  FK + index; the same column on the local `cost_layer` (local migration
  v23). Purchase-line `variant_id` already exists (purchase-variant-binding-01)
  and feeds it. **Migration + VERIFY SQL required** (documents only; a person
  runs them).
- **Historical migration implications:** every existing layer has
  `variant_id = NULL` = UNKNOWN, and must STAY unknown: re-attributing an
  old layer to a variant would be a guessed backfill (forbidden). Consumption
  logic must fall back to product-level layers when no variant layer exists —
  that fallback is a real rule change with real tests.
- **FIFO:** per variant — the oldest carton OF THAT VARIANT. More faithful
  when variants come from different suppliers; requires the fallback above for
  legacy stock.
- **AVCO:** two readings exist (average per variant vs per product with
  variant attribution) — this alone is a second owner decision.
- **Returns:** the reversal must restore the layer the sale actually consumed
  (already traced via `cost_consumption`), now possibly variant-keyed.
- **Reporting:** exact variant margin; but every report that summed layers per
  product must group across the new axis, and historical comparisons shift for
  mixed (NULL + named) layers.
- **Offline sync:** local costing engine, hydration whitelist and the
  valuation-consistency tests all gain the axis; a device older than v23
  pulling a variant-keyed layer drops the column (whitelist) — acceptable only
  because consumption stays server-authoritative.
- **Complexity / risk:** high — a costing-policy change touching money, with a
  mandatory re-verification of every financial invariant test.

**Recommendation (not applied):** stay on Option A until a real business case
(`gold_purity`, per-supplier variant costs) demands B. If B is chosen, it must
ship as its own reviewed slice with its own pg test, never inside another
change.

---

## Decision B — Persisting DNA `UNRESOLVED`

### Current behaviour (verified in source)

- `operationalDnaSchema` accepts `UNRESOLVED` on the axes (added V55 P0,
  backward-compatible). `inferOperationalDna` produces it only when a person
  leaves a question unanswered and no trade suggestion covers the axis.
- Consumers audited (preflight §6): `resolveDnaCapabilities` matches by
  inclusion (nothing activates); `dna-menu-suggestion` hides NOTHING on an
  unresolved axis; the backend stores the DNA as jsonb (no enum constraint);
  the local engine has no DNA enum reference; the settings editor never
  renders the raw value. An `UNRESOLVED` value is therefore inert by design.
- Storage: `workspaces.operational_dna` jsonb + append-only history
  (`docs/operational-profile-01-migration.sql`), versioned RPC.

### Option A — Keep `UNRESOLVED` as a valid persisted state (STATUS QUO)

- **User experience:** a shop that skips a question is never blocked; the
  wizard completes, nothing is fabricated, and the settings screen lets them
  answer later. The menu hides nothing (conservative).
- **Backward compatibility:** perfect — every DNA saved before V55 stays
  valid; a missing axis reads as absent, never as a guessed value.
- **Offline behaviour:** DNA is not consumed by the local engine; nothing
  changes offline.
- **Sync behaviour:** the jsonb is opaque to sync; no conflict surface
  changes.
- **Capability resolution:** `resolveDnaCapabilities` activates nothing from
  an unresolved axis — correct (capabilities are requested from ANSWERS and
  from the trade, never from a guess).
- **Existing workspaces:** untouched; no migration.
- **Data migration:** none.
- **Risk:** a workspace could stay unresolved forever and quietly run with no
  stock behaviour configured — visible only if someone inspects the profile.

### Option B — Require an explicit answer before completing the step

- **User experience:** the wizard cannot finish the operating-questions stage
  until the person answers the stock/offering questions. For a shop that
  genuinely does not know, this is a wall — and the honest fallback they will
  click is «no», which is a WRONG answer stored with high confidence.
- **Backward compatibility:** needs a rule for existing workspaces whose DNA
  is already saved unresolved (re-prompt at next settings visit? leave them?).
  Either way, an additive UX change with a migration of the prompt state.
- **Offline behaviour:** the wizard runs offline; the required-answer rule
  must work with no server round-trip — fine, but it is a second validation
  path to keep in step with the shared schema.
- **Sync behaviour:** none new.
- **Capability resolution:** stricter input → fewer unresolved profiles → the
  same `resolveDnaCapabilities` results, reached more reliably.
- **Existing workspaces:** the ones already persisted with `UNRESOLVED` keep
  it (history table preserves every version) — Option B does NOT clean them.
- **Data migration:** none required; optionally a re-prompt flag.
- **Risk:** forces a guess disguised as an answer when the person really does
  not know — the exact fabrication V55 P0 removed.

**Recommendation (not applied):** keep Option A. The unresolved value is
inert, honest, and reversible; forcing an answer trades a silent unknown for
a confident wrong answer. If the owner wants tighter profiles, the
intermediate move is a non-blocking «these two questions are still open»
notice on the settings screen — a UI change, not a schema change.

---

Both recommendations leave the working tree exactly as it is. Applying either
option is a separate, explicitly requested change.
