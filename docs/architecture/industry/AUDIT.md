# Industry personalisation — audit

Date: 26 Oct 2026
Status: IMPLEMENTED_NOT_LIVE_VERIFIED

## What already existed (repository evidence)

| Fact                                                                                                                        | Evidence                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| The persisted industry is `profiles.business_types text[] NOT NULL` — one row, not a table per trade.                       | migration that created `profiles`; backend `PATCH /api/auth/profile` maps `businessTypes` |
| Onboarding selected trades in the browser store but never called `updateProfile`, so the server value stayed empty.         | `onboarding-container.tsx` before this change: `updateProfile` was read, never called     |
| The invoice model already expresses a line quantity in the line unit and a price per that same unit.                        | `packages/validation/src/schemas/invoice-grid.ts`, `rowQuantity`/`rowUnitPrice`           |
| Units already have a shared seeded conversion table.                                                                        | `packages/validation/src/schemas/units-seed.ts` (`SEEDED_UNITS`)                          |
| Products already store a unit; the invoice builder has a unit cell.                                                         | `products.unit`, `COLUMN.unit`                                                            |
| The invoice grid's unit dropdown still listed 8 of 16 schema units, so ton/mg/cm/km/ml/dozen were silently mapped to piece. | `grid-cell.tsx` before this change (`UNIT_CHOICES`)                                       |
| Dashboard visibility/order is a user preference (`pageLook`), not an industry value.                                        | `RegisterCustomizer`, `look.shows(...)` in `dashboard-container.tsx`                      |

## Audit conclusion

The repository did not need a new table, a new persisted field, or a per-trade module. It needed
one derived profile over the existing `business_types` value, plus the onboarding write that was
missing. The measurement defect lived in the shared grid rules, not in a trade package.

## Scope of this change

Derived profile only. An industry configures defaults, order, emphasis and vocabulary. It never
grants a capability, never changes authorisation, plan entitlement, online gates or money math.
