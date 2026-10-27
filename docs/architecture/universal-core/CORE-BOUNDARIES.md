# Where each thing belongs — core, capability, extension, industry configuration

Model (adapted to what the repository already does, not imposed on it):

```
Universal Core → Reusable Capabilities → Industry Profile → Onboarding Configuration → Runtime UI
```

The profile is **derived**, never stored twice: `resolveBusinessProfile(types)` in `packages/validation/src/schemas/industry-profiles.ts` is a pure function of the workspace’s `business_types`. Online and offline read the same value and call the same function, so they cannot disagree about what an industry means.

## 1. Universal core — must work for every business, depends on no industry

| Belongs here                                                 | Where it lives today                              |
| ------------------------------------------------------------ | ------------------------------------------------- |
| Workspace, roles, plans, `workspace_id` isolation            | `backend/src/middleware/*`, `packages/auth-core`  |
| Products and services, units, base-unit stock, barcodes      | `product.service.ts`, `unit-conversion.domain.ts` |
| Customers, suppliers, balances by currency                   | `customer.service.ts`, `payments.domain.ts`       |
| Sale and purchase documents, payments, instalments, reversal | `invoice.service.ts`, `installment.service.ts`    |
| Ledger, cost layers, profit (unknown cost is `null`)         | `services/accounting`, `inventory-costing`        |
| Warehouses, shelves, transfers                               | `warehouse-map.service.ts`, `transfer.domain.ts`  |
| Offline engine and sync                                      | `packages/local-engine`, `services/conflict`      |

**Rule:** a core module never names an industry. `industry ===` outside the registry is a defect (guard: `packages/validation/src/__tests__/industry-profile-guard.test.ts`).

## 2. Reusable capabilities — one implementation, many trades

A capability is listed in `business-capabilities.ts` and may be `available` only with implementation paths **and** an existing test. `planned` entries generate no controls and no claims.

| Capability                                    | Status in registry                                  | Trades that need it (see coverage matrix)                           |
| --------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| `measurement`, `weight_pricing`, `multi_unit` | available                                           | gold, spices, hardware, timber, fabric, grocery, building materials |
| `length_pricing`, `volume_pricing`            | planned                                             | fabric by the metre, fuel, carpet                                   |
| `batch_expiry`, `serialized_items`            | planned (online traceability exists — see gap G-09) | grocery, electronics, computer parts, vehicles, agriculture         |
| `variants`                                    | planned (no entity yet)                             | clothing, footwear, furniture, kitchenware, carpet                  |
| `recipe_bom`                                  | planned (manufacturing exists, online-only)         | restaurants, workshops                                              |
| `gold_purity`, `making_charges`               | planned                                             | gold and jewellery                                                  |

## 3. Optional extensions — a bounded new surface, switched on by a profile

These are **not** core and **not** an industry’s private copy of the core. Each would be its own module with its own tables, reusing the core for money and stock:

| Extension                        | Needed by                               | Reuses                                                        |
| -------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| Dimensions / area measurement    | carpet, flooring, glass, tiles          | `invoice-grid` multiplier, `unit-conversion`                  |
| Roll / per-batch unit of measure | fabric, yarn, cable, flooring           | traceability batches                                          |
| Trip & load                      | freight, courier                        | invoices (freight charge), assets (vehicle), payroll (driver) |
| Seat ticketing                   | passenger transport                     | invoices (fare), assets (bus)                                 |
| Dispatch & cash-on-delivery      | courier                                 | till/payments                                                 |
| Warranty                         | computer parts, electronics, appliances | serials, returns                                              |
| Appointments                     | services, clinics, barbers              | invoices                                                      |

## 4. Industry configuration — emphasis only

A profile may set: the default unit of a **new** product, which invoice columns start visible, product-form field emphasis, dashboard card order (existing cards only), a vocabulary key. A profile **may not** enable a capability that is `planned`, bypass a permission or plan limit, hide a module, or touch a stored record. Changing the profile later never rewrites invoices, stock, prices or a saved layout.

## 5. Decisions recorded

1. **Primary industry** is deterministic (explicit → first trade in registry order → first sales model → generic). ADR: `docs/architecture/industry/ADR-001-primary-industry.md`.
2. **Several trades**: capabilities are the union; dashboard order is the union in primary-first order.
3. **Unknown or legacy values** fall back to the generic profile and are reported in `unknownTypes` / `legacyTypes`.
4. **No second source of truth**: the onboarding catalogue lives in `packages/ui-contract/src/business-types.ts` only because `ui-contract` cannot import `validation`; a parity test (`packages/ui/src/__tests__/industry-profile-registry.test.ts`) keeps the two lists identical.
