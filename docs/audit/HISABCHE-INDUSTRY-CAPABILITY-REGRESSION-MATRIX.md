# Hisabche — Industry Capability Regression Matrix

**Date:** 22 Nov 2026
**Scope:** the four industry-gated surfaces touched by the mandate — contracts, repair tickets,
salon setup/commission, and the service-session sub-tabs — plus the resolver the gates read.
**Sources:** `packages/validation/src/schemas/industry-profiles.ts` and
`business-capabilities.ts`, `packages/ui/src/components/ui/customers/containers/customers-hub-container.tsx`,
`backend/src/middleware/profile-capability.middleware.ts`, the three route files.

Status vocabulary: `SUPPORTED` (implemented, offered, API-gated) ·
`SUPPORTED_WITH_LIMITS` (offered and gated, registry status `partial`) ·
`NOT_OFFERED` (the trade did not request it; UI hidden and API refuses) ·
`UNRESTRICTED` (no declared profile; the screen is not gated by trade).

---

## 1. The one rule

```
allowed = profile.isGeneric || profile.primaryDefinition.requestedCapabilities.includes(capability)
```

- `profile.isGeneric` is true when the workspace declared no known trade, or declared `other`.
- `profile.capabilities` lists **implemented** capabilities; `requestedCapabilities` lists what the
  trade **asked for**. The gate uses `requestedCapabilities`, because a requested capability may
  still be `partial`.
- The server applies the same expression, so a tab that is hidden cannot be reached by calling the
  API directly.

---

## 2. Resolver output per trade (measured from source)

| Trade                    | `requestedCapabilities`                                                   | Implemented (`capabilities`)                  | Contracts             | Repairs               | Salon setup/commission |
| ------------------------ | ------------------------------------------------------------------------- | --------------------------------------------- | --------------------- | --------------------- | ---------------------- |
| `clothing`               | —                                                                         | `variants`                                    | NOT_OFFERED           | NOT_OFFERED           | NOT_OFFERED            |
| `beautySalon`            | `resource_capacity`                                                       | —                                             | NOT_OFFERED           | NOT_OFFERED           | SUPPORTED_WITH_LIMITS  |
| `barber`                 | `resource_capacity`                                                       | —                                             | NOT_OFFERED           | NOT_OFFERED           | SUPPORTED_WITH_LIMITS  |
| `mechanic`               | `work_queue_sla`, `warranty_claims`                                       | —                                             | NOT_OFFERED           | SUPPORTED_WITH_LIMITS | NOT_OFFERED            |
| `itServices`             | `work_queue_sla`, `contracts_recurring`                                   | —                                             | SUPPORTED_WITH_LIMITS | SUPPORTED_WITH_LIMITS | NOT_OFFERED            |
| `mobilePhones`           | `warranty_claims`, `work_queue_sla`                                       | `serialized_items`, `variants`                | NOT_OFFERED           | SUPPORTED_WITH_LIMITS | NOT_OFFERED            |
| `grocery`                | `batch_expiry`                                                            | `multi_unit`                                  | NOT_OFFERED           | NOT_OFFERED           | NOT_OFFERED            |
| `education`              | `installments`                                                            | `package_credits`                             | NOT_OFFERED           | NOT_OFFERED           | NOT_OFFERED            |
| `manufacturing`          | `recipe_bom`, `production_batch`, `quality_inspection`, `cost_allocation` | `multi_unit`                                  | NOT_OFFERED           | NOT_OFFERED           | NOT_OFFERED            |
| `jewellery`              | `gold_purity`, `making_charges`, `gold_trade`                             | `measurement`, `weight_pricing`, `multi_unit` | NOT_OFFERED           | NOT_OFFERED           | NOT_OFFERED            |
| `laundry`                | `laundry_item_tracking`, `work_queue_sla`                                 | `multi_unit`                                  | NOT_OFFERED           | SUPPORTED_WITH_LIMITS | NOT_OFFERED            |
| `fuel`                   | `fuel_tank_reconciliation`, `volume_pricing`                              | `measurement`, `multi_unit`                   | NOT_OFFERED           | NOT_OFFERED           | NOT_OFFERED            |
| no declaration / `other` | —                                                                         | —                                             | UNRESTRICTED          | UNRESTRICTED          | UNRESTRICTED           |

Registry status behind each offered gate:

| Capability                                                                                | Registry status | Consequence                                                    |
| ----------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------- |
| `contracts_recurring`                                                                     | `partial`       | contracts screen works, with the registry's listed limitations |
| `work_queue_sla`                                                                          | `partial`       | repair board works, with its limitations                       |
| `resource_capacity`                                                                       | `partial`       | chairs/rooms and commission work, with their limitations       |
| `variants`                                                                                | `partial`       | not a gate for the four surfaces above                         |
| `serialized_items`                                                                        | `partial`       | not a gate for the four surfaces above                         |
| `package_credits`                                                                         | `partial`       | education sessions consume credits                             |
| `installments`                                                                            | `partial`       | deposits/installments engine                                   |
| `warranty_claims`                                                                         | `partial`       | repair claims                                                  |
| `batch_expiry`, `recipe_bom`, `production_batch`, `quality_inspection`, `cost_allocation` | `partial`       | manufacturing/grocery modules                                  |
| `gold_purity`, `making_charges`, `gold_trade`, `volume_pricing`                           | `partial`       | jewellery/fuel modules                                         |
| `laundry_item_tracking`, `fuel_tank_reconciliation`                                       | `planned`       | requested but NOT implemented; see §4                          |
| `measurement`, `multi_unit`, `length_pricing`                                             | `available`     | core catalogue capabilities                                    |

---

## 3. Gate locations

| Surface                                     | UI gate                                             | API gate                                             |
| ------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Contracts                                   | `customers-hub-container.tsx:121-122, 161-169`      | `contracts.routes.ts:34, 40` (`contracts_recurring`) |
| Repair tickets                              | `customers-hub-container.tsx:147`                   | `repair.routes.ts:41, 47` (`work_queue_sla`)         |
| Salon setup                                 | `customers-hub-container.tsx:148`                   | `salon.routes.ts:39-57` (`resource_capacity`)        |
| Commission                                  | `customers-hub-container.tsx:149`                   | `salon.routes.ts:39-57` (`resource_capacity`)        |
| Service sessions (base)                     | not trade-gated; permission-gated by `invoice.read` | service-delivery routes                              |
| Session sub-tab `repairs`                   | `work_queue_sla`                                    | repair routes                                        |
| Session sub-tab `salonSetup` / `commission` | `resource_capacity`                                 | salon routes                                         |

`requireProfileCapability` runs after `requireWorkspaceContext` and reads the **server's** copy of the
profile (`workspaceProfileOf`), never a header or body field.

---

## 4. Regression findings

### 4.1 Fixed: the server used to lock out generic workspaces

`requireProfileCapability` only exempted `declared: false`. A workspace that declared a generic trade
resolved to zero requested capabilities, so the route would have refused a business whose own UI
still showed the screen. The middleware now returns early for `profile.isGeneric` — the same
expression the screens use. Pinned by the middleware's own behavior and by the profile tests.

### 4.2 Fixed: `mobilePhones` did not request the repair capability it displayed

Its dashboard has always shown `openRepairTickets`, and the comment next to it says the board is the
repairs spec — but `work_queue_sla` was missing from `requested`. It was added to
`industry-profiles.ts` and pinned in `industry-profiles.test.ts`:

```ts
expect(resolveBusinessProfile(['mobilePhones']).primaryDefinition.requestedCapabilities).toContain(
  'work_queue_sla',
)
```

### 4.3 Fixed: the API did not enforce what the UI hid

Before this change, `contracts`, `repair` and `salon` routes only checked `invoice.read` /
`invoice.create`. A clothing shop's hidden «قراردادها» tab could be reached with a direct HTTP call.
The profile middleware is now part of each route's `preHandler`, so the hidden tab is also a refused
request.

### 4.4 Known limitation: requested-but-planned capabilities

`laundry` requests `laundry_item_tracking` and `fuel` requests `fuel_tank_reconciliation`; both are
registry status `planned`. The gate is on `requestedCapabilities`, so a screen that keys off those
capabilities would be shown before the engine exists. The four surfaces audited here do not key off
them, so this is not a live regression — but it is a resolver/gate mismatch that should be resolved
when those engines land (either implement them or remove them from `requested`).

---

## 5. How this was verified

- `packages/validation/src/__tests__/industry-profiles.test.ts` — 103 files / 1254 tests passed
  after the `mobilePhones` change; the test pins clothing (`NOT_OFFERED` for contracts/repairs/salon),
  beautySalon (`resource_capacity`), and now mobilePhones (`work_queue_sla`).
- `packages/ui/src/__tests__/customers-hub.test.ts` — the hub's gated sections; passes in the full UI
  suite.
- `backend` route tests (`v60-http-families`, `contracts-service*`, `service-delivery-http`) pass with
  the profile middleware present; the harness's undeclared workspace is never restricted.
- No test ran against a **declared** profile with a real database. The middleware's generic/declared
  branches are covered by source and mock tests only. Status: `IMPLEMENTED_NOT_LIVE_VERIFIED`.
