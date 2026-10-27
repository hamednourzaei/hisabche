# Onboarding taxonomy — what a user can pick, and what picking it does

## How selection works today

1. Two **sales-model cards** (retail, wholesale) — they say _how_ the business sells.
2. A **searchable list of trades** (`BUSINESS_TYPES`, `packages/ui-contract/src/business-types.ts`), grouped by family; the escape hatch «کسب‌وکارت پیدا نشد؟ (سایر)» is `other`.
3. Store size, then currency, then a review step.
4. The chosen ids are stored on the workspace (`business_types`) and read back by `resolveBusinessProfile`. Nothing else is stored; there is no second catalogue.

A user may pick several trades. The first trade in registry order is primary (ADR-001).

## What a choice does — and does not do

| It does                                                         | It does not                                          |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| Set the default unit of a **new** product                       | Rewrite an existing product, invoice, price or stock |
| Start some invoice columns visible (e.g. gram weight for gold)  | Enable a capability the registry marks `planned`     |
| Reorder existing dashboard cards (a saved personal layout wins) | Bypass a permission or plan limit                    |
| Show an honest note when the profile is generic                 | Create a workflow that does not exist                |

For a trade whose profile is generic, onboarding’s last step and Settings show: _«The universal business-management features are available. Specialized features for this business type are not yet available.»_ (`industry.supportNote.generic`, in `fa`, `af`, `en`). The note is derived from the resolver, so it disappears by itself when a trade gains a real capability.

## Options the owner required to be individually selectable

| Required option             | Registry key         | State                                                                                                                         |
| --------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Freight and cargo transport | `freightTransport`   | **added this round** — generic profile                                                                                        |
| Passenger transport         | `passengerTransport` | **added this round** — generic profile                                                                                        |
| Courier and delivery        | `courier`            | **added this round** — generic profile                                                                                        |
| Clothing                    | `clothing`           | existed                                                                                                                       |
| Fabric sold by the roll     | `fabricRoll`         | **added this round** — same real capabilities as metre fabric (measurement, multi-unit); per-roll length is _not_ implemented |
| Fabric sold by the metre    | `fabric`             | existed; Persian label changed to «پارچه متری و خرازی» (id unchanged)                                                         |
| Kitchenware                 | `kitchenware`        | existed                                                                                                                       |
| Computer components         | `computerComponents` | **added this round** — distinct from `computers` (computers and laptops)                                                      |
| Vehicle sales               | `carDealer`          | existed                                                                                                                       |
| Carpet                      | `carpet`             | existed                                                                                                                       |
| Other                       | `other`              | existed                                                                                                                       |

`transport` («ترانسپورت و باربری») is kept: stored workspaces may already hold it, and renaming an id changes what an existing row means.

Registry size: 61 → 66 keys.

## Where the full per-trade picture lives

- `docs/architecture/universal-core/INDUSTRY-COVERAGE-TABLE.md` / `.csv` — every trade × capability, with status, repository evidence, why-missing, external source, confidence.
- `docs/architecture/industry/INDUSTRY-SUPPORT-MATRIX.md` — the roll-up per trade.
- `docs/architecture/industry/industry-diff.generated.md` — what the registry configures for each key.

## Not done in this taxonomy (deliberately)

- Conditional questions («do you sell by weight, length, area?»). Every question must change real behaviour; today only the default unit does, and that is already derived from the trade. Adding questions without a consumer would collect data nothing reads.
- A parent-category screen (the 16-family proposal). The current grouped list already has families; a second level would add a click without adding a decision, and the registry has no consumer for a category.
