# Tab-by-tab verification (27 Oct 2026) — IN PROGRESS

Dev build on `localhost:3039` against the live API, signed in as the test account. Nothing here claims production verification.

## Status: REQUIRES_ENGINEERING_REMEDIATION (pass not finished)

## Route sweep (dev overlay error flag + failed API calls)

Loaded: dashboard, invoices, customers, warehouse, accounting, till, team-and-payroll, data-and-sync, settings, sync-center, activities, analysis, approvals, assistant, billing, developers, governance, manufacturing, marketplace, operations, stock-count. Not loaded: market-seller, onboarding, public pages, desktop, mobile.

## Bugs found and fixed

| #   | Where          | Bug                                                                                                                                  | Fix                                                                                                                   | Test                                                                                      |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Dashboard      | React 418 (HTML): `DisplayBasisPicker` rendered on the first client pass from the persisted query cache                              | `hooks/use-after-hydration.ts`, used in `display-basis-picker.tsx`                                                    | `display-basis-picker-hydration.test.tsx`                                                 |
| 2   | Billing        | React 418: `BillingContainer` showed a spinner on the first client render because a shared query was already fetching                | guarded with `useAfterHydration`                                                                                      | dev overlay clean after fix                                                               |
| 3   | Developers     | React 418: `SandboxPanel` loading/error panel on the first client render                                                             | `sectionStateFor(hydrated, …)`                                                                                        | dev overlay clean after fix                                                               |
| 4   | Settings       | React 418 (`text`, the one production reports): `BookCurrencySection` server HTML said "could not read", client said "reading…"      | "not read yet" is no longer "unreadable"; only a real error is                                                        | dev overlay clean after fix                                                               |
| 5   | Settings       | `Cannot update a component (StorageSection) while rendering DashboardLayout`: synchronous `setState` from a query-cache subscription | deferred one microtask                                                                                                | dev overlay clean after fix                                                               |
| 6   | Stock count    | Opening a count crashed the page (`list.find is not a function`): `useProducts` data is `{products,total}`, not an array             | reuse `readProducts`                                                                                                  | seen fixed in browser                                                                     |
| 7   | Stock count    | Status showed raw `counting`; variance showed **0** for counted 3 vs expected 0 (null read as zero)                                  | status keys in fa/af/en; `varianceOf` = counted − expected                                                            | seen fixed in browser                                                                     |
| 8   | Dashboard      | Custom unit «۱ دستگاه لندکروز = …» could not be removed                                                                              | `DELETE /api/finance/currency/units/:name`, ✕ on the chip                                                             | `currency-delete-unit.test.ts`; needs `docs/custom-units-02-migration.sql` (run by owner) |
| 9   | Customers      | No way to delete a customer although the API supports it                                                                             | `useDeleteCustomer`, «حذف مشتری» on the customer file, 409 → clear message                                            | browser: DELETE 204 and redirect                                                          |
| 10  | Warehouses     | No way to delete a warehouse although the API supports it                                                                            | `useDeleteWarehouse`, «حذف انبار» in the edit dialog                                                                  | browser: 204 for an empty warehouse, 409 + message for one with stock                     |
| 11  | Warehouses     | New-branch form: add button silently disabled without a code                                                                         | visible hint «کد شعبه لازم است»                                                                                       | seen in code; branch POST 201 verified                                                    |
| 12  | Invoice return | `JOURNAL_ENTRY_EMPTY`: the SQL function turned a NULL `exchange_rate` into a NULL journal amount                                     | `v_rate := COALESCE(NULLIF(exchange_rate,0),1)` in `docs/invoice-return-01-migration.sql`; new pg case and VERIFY row | pg test not runnable on Windows; **owner must re-run the migration**                      |

## Flows exercised in the browser

Customer create → delete. Warehouse create → delete; delete refused with stock. Branch create. Stock count: start → record → complete. Invoice INV-000099 issued (80 AFN, paid into «صندوق تست»). Return attempted: failed with `JOURNAL_ENTRY_EMPTY` (item 12).

## Not done

Return re-test after the migration is re-run; branch delete/archive; supplier add/remove; employees, attendance, payroll, POS shift open/close, accounting period close, sync conflict, backup/restore, auth logout/refresh; public pages; mobile and desktop UI. Findings still to verify: stock count «expected 0» for a product the picker shows as 10 in the same warehouse; count summary shows 0 value when the product has no cost.
