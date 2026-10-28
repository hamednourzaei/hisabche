# Tab-by-tab verification (27–28 Oct 2026) — IN PROGRESS

Dev build on `localhost:3039` and the live site, signed in as the test account. Anything marked "live" was checked on hisabche.com after the deploy.

## Status: REQUIRES_ENGINEERING_REMEDIATION (pass not finished)

The fixes below are done and verified; the walkthrough of the remaining areas is not.

## Route sweep (dev overlay error flag + failed API calls)

Loaded: dashboard, invoices, customers, warehouse, accounting, till, team-and-payroll, data-and-sync, settings, sync-center, activities, analysis, approvals, assistant, billing, developers, governance, manufacturing, marketplace, operations, stock-count. Not loaded: market-seller, onboarding, public pages, desktop, mobile.

## Bugs found and fixed

| #   | Where          | Bug                                                                                                           | Fix                                                                                                                                                      | Evidence                                                                                               |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Dashboard      | React 418 (HTML): `DisplayBasisPicker` rendered on the first client pass from the persisted query cache       | `hooks/use-after-hydration.ts`, used in `display-basis-picker.tsx`                                                                                       | `display-basis-picker-hydration.test.tsx`                                                              |
| 2   | Billing        | React 418: spinner on the first client render because a shared query was already fetching                     | guarded with `useAfterHydration`                                                                                                                         | dev overlay clean                                                                                      |
| 3   | Developers     | React 418: `SandboxPanel` loading/error panel on the first client render                                      | `sectionStateFor(hydrated, …)`                                                                                                                           | dev overlay clean                                                                                      |
| 4   | Settings       | React 418 (`text`, the variant production reports): server HTML said "could not read", client said "reading…" | "not read yet" is no longer "unreadable"                                                                                                                 | dev overlay clean                                                                                      |
| 5   | Settings       | `Cannot update a component (StorageSection) while rendering DashboardLayout`                                  | query-cache subscription deferred one microtask                                                                                                          | dev overlay clean                                                                                      |
| 6   | Stock count    | Opening a count crashed the page (`list.find is not a function`)                                              | reuse `readProducts`                                                                                                                                     | seen fixed in browser                                                                                  |
| 7   | Stock count    | raw `counting` status; variance showed 0 for counted 3 vs expected 0                                          | status keys fa/af/en; `varianceOf` = counted − expected                                                                                                  | seen fixed in browser                                                                                  |
| 8   | Dashboard      | Custom unit «۱ دستگاه لندکروز = …» could not be removed                                                       | `DELETE /api/finance/currency/units/:name`, ✕ on the chip                                                                                                | `currency-delete-unit.test.ts`; needs `custom-units-02` (owner ran it)                                 |
| 9   | Customers      | No way to delete a customer although the API supports it                                                      | `useDeleteCustomer`, «حذف مشتری», 409 → clear message                                                                                                    | browser: 204 and redirect                                                                              |
| 10  | Warehouses     | No way to delete a warehouse although the API supports it                                                     | `useDeleteWarehouse`, «حذف انبار»; matrix row corrected to local/available                                                                               | browser: 204 empty, 409 + message with stock                                                           |
| 11  | Warehouses     | New-branch form: add button silently disabled without a code                                                  | visible hint «کد شعبه لازم است»                                                                                                                          | branch POST 201 verified                                                                               |
| 12  | Invoice return | `JOURNAL_ENTRY_EMPTY`: SQL function turned a NULL `exchange_rate` into a NULL journal amount                  | `v_rate := COALESCE(NULLIF(exchange_rate,0),1)` in `invoice-return-01-migration.sql`                                                                     | **live**: RET-LIVE-0099 on INV-000099 posted; journal «برگشت فاکتور فروش», warehouse value 450 → 500   |
| 13  | Customer file  | The statement and balances ignored sale returns (no return row; «we owe the customer» stayed 0)               | shared rule `party-statement` + `payments.domain`: return = `return` movement, subtracted in summary; `getBalance` too; return route clears money caches | **live**: row «برگشت RET-LIVE-0099 ۸۰», net −80 labelled «ما بدهکاریم»; 8 new tests (injection-tested) |

## Flows exercised

Customer create → delete. Warehouse create → delete; delete refused with stock. Branch create. Stock count start → record → complete. Invoice INV-000099 issued (80 AFN, paid into «صندوق تست») and returned. Customer statement and balance after the return.

## Return follow-ups (fixed 28 Oct, verified live)

- A returned UNPAID invoice no longer stays open: INV-000100 (130,000, unpaid) returned as RET-LIVE-0100 gives receivable 0, overdue 0, open invoices 0 and a statement row «برگشت ۱۳۰٬۰۰۰». Open-invoice reads (allocation, party list, aging) subtract returns (netOfReturns in payments.repository).
- The customers list shows a credit: «مشتری تست — ۸۰ AFN بستانکار», status «بستانکار», instead of «۰ / تسویه» (GET /api/payments/return-effects/customers).
- «بدهی ما به مشتری» is purchase payable plus return credit (server field weOwe), with the hint «شامل اعتبار مرجوعی».
- One shared rule, returnEffectOfInvoice: a return cancels debt on that invoice and becomes credit once nothing is owed.

## Remaining limitations

- The invoice's own status in the invoice list stays «پرداخت‌نشده» after a return (the database computes it from total and allocations).
- The customers list adds one figure in the books currency: debt or credit in another currency is not shown there (the customer file shows each currency).
- After the deploy the live API was slow for several minutes (5–15 s per call, some timeouts) while the new instance warmed up; it recovered without action.

## Not done

Branch delete/archive; suppliers; employees, attendance, payroll; POS shift open/close; accounting period close; sync conflicts; backup/restore; auth logout/refresh; public pages; mobile and desktop UI.
