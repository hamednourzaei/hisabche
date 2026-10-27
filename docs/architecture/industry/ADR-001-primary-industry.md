# ADR-001 — how the primary industry is chosen

Status: accepted
Date: 26 Oct 2026

## Context

`profiles.business_types` is an array: a shop may be both `grocery` and `jewellery`. The derived
profile needs one primary trade to pick product and invoice defaults, while still unioning
capabilities across every selected trade.

There was no stored ordering contract. The onboarding draft keeps a comma-separated string; the
server stores an array. Insertion order is therefore not a product decision and must not become one.

## Decision

1. An explicit primary passed by the caller always wins (`resolveBusinessProfile(types, primary)`).
2. Otherwise the first selected trade in **registry order** (`INDUSTRY_KEYS`) is primary.
3. If no trade is selected, the primary is `null` and the profile is generic.
4. `retail` / `wholesale` are sales models. They are valid keys but are not specialised profiles.
5. Legacy (`service`) and unknown values are reported (`legacyTypes`, `unknownTypes`) and never
   guessed into a specialised profile.

Capabilities are the union across all selected trades, so permutation and duplication cannot change
them.

## Consequences

- The same selection always produces the same profile, on every platform.
- Reordering the registry is a product change; adding a key at the end is not.
- A caller that genuinely knows the primary (for example a future UI that lets the user mark one)
  can pass it without changing storage.
- Tests assert reversed input, duplicates and comma strings produce the same result.
