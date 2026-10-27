# Industry audit — registry versus operational depth

Date: 2026-10-26. Static reading of `business-capabilities.ts`, `industry-profiles.ts`, the services, hooks, UI sections and the offline matrix. Nothing was run with a business scenario. This supports the industry onboarding gate (`BLOCKED`).

## 1. What the registry advertises

66 industry keys; 12 capabilities, 7 `available`, 5 `planned` (`length_pricing`, `volume_pricing`, `batch_expiry`, `recipe_bom`, `table_service`).

| Capability                                    | Delivered? | Evidence                                                                                                                                                                                         |
| --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `measurement`, `weight_pricing`, `multi_unit` | **yes**    | invoice grid (`invoice-grid.ts`, `grid-cell.tsx`), engine, parity tests (`invoice-unit-parity`, `column-multiplier`)                                                                             |
| `variants`                                    | partial    | table, service, route, hook, UI section, engine route; no stock, warehouse or invoice-line link; `resolveVariantPrice` unused                                                                    |
| `serialized_items`                            | **no**     | binding at sale absent (`validateSerialSale` unused); serial receipt hooks have no UI; serial/lot routes `online_required`; the registry's evidence lists `fitment.service.ts` (vehicle fitment) |
| `gold_purity`, `making_charges`               | **no**     | `calculateJewelleryLine` has no importer; metal-rate hooks have no UI; **the `jewellery` profile lists only `measurement`, `weight_pricing`, `multi_unit`**, so no onboarding path enables them  |

Profiles and the capabilities they list: jewellery (measurement, weight_pricing, multi_unit) · watches, fabric, fabricRoll, hardware, buildingMaterials, timber, fuel, spices (measurement, multi_unit) · grocery, manufacturing (multi_unit) · pharmacy (batch_expiry, multi_unit — planned) · clothing, shoes (variants) · electronics, computers, mobilePhones, computerComponents (serialized_items, variants) · restaurant, cafe (none) · tailoring (measurement).

## 2. Can a business complete its primary workflow?

`INDUSTRY_PROFILE_EXISTS_BUT_OPERATIONAL_DEPTH_MISSING` is the verdict wherever the answer is No.

| Industry                         | Primary workflow tested                                | Result                                                           | Basis                                                                                                                     |
| -------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Retail / wholesale               | sell, collect, stock, report; price lists; credit sale | **Yes** for the core path; credit limit not enforced server-side | invoice path, payments, units, price lists                                                                                |
| Clothing / shoes                 | size × colour, SKU, barcode, stock, sale, return       | **No**                                                           | variants have SKU/barcode/price but no stock and no sale link; return has no effect                                       |
| Electronics / computers / phones | serial, warranty, sale, return, trace                  | **No**                                                           | no serial entry UI, serial/lot online-only, no binding at sale, warranty registration has no caller, return has no effect |
| Fabric / carpet                  | metres, area, roll, partial roll                       | **Partial**                                                      | metre units work through unit conversion; area and roll rules unused; `length_pricing` planned                            |
| Auto parts                       | part number, alternates, fitment, core charge          | **Partial**                                                      | fitment list UI; OEM/alternate columns absent; core charge function unused                                                |
| Grocery / pharmacy               | batch, expiry, case/unit, return                       | **Partial**                                                      | case barcode with unit works (older); expiry hub exists but online-only; `batch_expiry` planned; no return effect         |
| Gold / jewellery                 | purity, making charge, old gold                        | **No**                                                           | calculation unused, no UI, profile does not enable it                                                                     |
| Freight / courier / passenger    | trip, COD, delivery note                               | **No (API only)**                                                | services and routes, `online_required`, no screen, duplicate path families                                                |
| Services / agriculture           | appointments, crops, livestock                         | **No (API only)**                                                | same                                                                                                                      |
| Manufacturing                    | BoM, work order, cost                                  | **Yes** (older work)                                             | single cost rule `computeProductionCost`; no ledger by design                                                             |

## 3. Verdict

The registry is a statement of intent for most trades. Operational support today is: retail/wholesale, measurement-based trades through units, manufacturing, and the older expiry/serial tooling online only. This does not change `INDUSTRY ONBOARDING = BLOCKED`.
