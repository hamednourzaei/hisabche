# Open questions

These are real decisions that the code cannot settle. Each has a safe default already in place.

## 1. Dashboard visual order is stored as a user preference

`dashboard-container.tsx` reads `pageLook` (`look.shows(...)`) and the user can customise the
dashboard. The profile carries a stable `dashboard` array, but the container is **not** reordered by
it. Reordering would silently override a preference the user saved.

Safe default: keep the user's preference authoritative; expose the profile order only when no
preference exists. Decision needed: should industry order be the default, or only a preset the user
applies?

## 2. Changing the industry after onboarding

Settings edits name only; there is no industry editor there. Re-running onboarding is the only path
that writes `businessTypes` today.

Safe default: keep onboarding as the write path. Decision needed: do we add an industry section to
Settings (with the same catalogue and a save-failure message)?

## 3. Offline `local_workspace` has no `business_types`

`packages/app-bridge/src/local-schema.ts` and `packages/local-engine/src/routes/workspace.ts` do not
store the industry. Offline therefore resolves the generic profile.

Safe default: no local migration in this change. Decision needed: add an additive local SQLite
migration (with the same run-twice test discipline) or accept that Offline is generic until the next
sync provides the value.

## 4. Is a necklace a unique single item or aggregatable grams?

The current model supports both: a line quantity in grams, or one piece multiplied by a «net
weight» column. The profile does not choose between them and no karat/making-charge formula exists.
Decision needed before adding `gold_purity` or `making_charges`.
