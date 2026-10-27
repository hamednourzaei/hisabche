# Traceability — capability → source → test

Only `available` capabilities are attached to a profile. `planned` capabilities have empty evidence
and are referenced by no profile; `industry-profiles.test.ts` enforces both directions.

| Capability         | Status    | Implementation source                                  | Existing test                                                 |
| ------------------ | --------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| `measurement`      | available | `common.schema.ts`, `units-seed.ts`, `invoice-grid.ts` | `invoice-grid.test.ts`, `column-multiplier.test.ts`           |
| `weight_pricing`   | available | `invoice-grid.ts`                                      | `column-multiplier.test.ts`                                   |
| `multi_unit`       | available | `common.schema.ts`                                     | `product-unit-set.test.ts`, backend `unit-conversion.test.ts` |
| `length_pricing`   | planned   | —                                                      | —                                                             |
| `volume_pricing`   | planned   | —                                                      | —                                                             |
| `batch_expiry`     | planned   | —                                                      | —                                                             |
| `recipe_bom`       | planned   | —                                                      | —                                                             |
| `variants`         | planned   | —                                                      | —                                                             |
| `table_service`    | planned   | —                                                      | —                                                             |
| `serialized_items` | planned   | —                                                      | —                                                             |
| `gold_purity`      | planned   | —                                                      | —                                                             |
| `making_charges`   | planned   | —                                                      | —                                                             |

## Profile → consumer

| Consumer                        | What the profile changes                                    | Where                                           |
| ------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| Onboarding                      | writes the selected trades to the server                    | `onboarding-container.tsx`                      |
| Invoice builder                 | default visible columns, price multiplier source, line unit | `invoice-builder-container.tsx` → `initColumns` |
| Product form                    | default unit                                                | `add-product-modal.tsx`                         |
| Product pick on an invoice line | seeds the product's own unit and count-only quantity        | `invoice-draft.slice.ts` → `setRowProduct`      |
| Grid unit cell                  | choices come from the schema                                | `grid-cell.tsx`                                 |

## Deliberately not wired

Dashboard visual order, settings-side industry editing and Offline `local_workspace` profile parity.
See `OPEN-QUESTIONS.md`.
