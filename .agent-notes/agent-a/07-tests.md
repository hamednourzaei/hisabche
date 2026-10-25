# Pass 7 — tests are behaviour

## Files read

- Test inventory: 622 `*.test.ts(x)` files, **6642** `it/test` cases
  (`_test-names.txt`, script `test-names.mjs`).
- Grouped by claim (`_test-groups.txt`, script `test-groups.mjs`): reverse 102 /
  profit 123 / offline 334 / permission 198 / plan-limit 69 / currency 303 /
  inventory 319 / printing 33.
- `backend/src/__tests__/offline-license-policy.test.ts` (1-120) + its 12 names.
- Names of `offline-license-routes`, `plan-limits`, `reverse-guards`,
  `offline-license-code`.

## Facts proven

- **Reverse, not delete**: an invoice with history is not deleted and the answer
  says why; same for payments; a product still holding stock is not removed; a
  till sale is voided while the till is open but not after it was counted and
  closed (`reverse-guards.test.ts`, `money-is-reversed-not-deleted.test.ts`).
- **Profit honesty is heavily guarded**: 26 rule tests + 15 backend + 13 UI.
  No consumption → profit and margin are null, never 0; a partially costed sale
  states the known amount and refuses the profit; a zero-cost layer is a KNOWN
  zero (`cost-unknown-is-not-zero.test.ts`).
- **Multi-currency**: owed amounts are stated per currency and never added
  across currencies (`analysis-service.test.ts`); a foreign invoice converts at
  its own rate (`invoice-exchange-rate.test.ts`, `profit-foreign-currency.test.ts`).
- **Roles enforced in the query, not only in the UI**: seller sees only the
  invoices and payments they raised, cannot see what the shop paid for stock
  (`authorization-rules`, `authorization-scope-applied`); cancelling a payment is
  scope-checked as well as SoD-checked.
- **SoD**: 23 rule tests, including that a person who took the money should not
  be the one who erases its record.
- **Offline edition licence**: 1 computer + 1 mobile at once; a second seat is
  refused 409; reinstall on the same device is free; up to 3 transfers a year;
  a ban stops operational writes but **always** keeps read, print, backup and
  export; licence log evidence strips customer names and amounts.
- **Plan limits**: free plan refuses the 51st invoice with 402 and the numbers;
  the 50th is allowed; a resent offline sale is never refused (replay check
  first); a second member on free is refused; a paid trial is never limited.
- **Stock**: 19 transfer-lifecycle tests, 28 stock-count tests, 25 costing rules.

## Facts not proven

- Test names prove the rule is guarded, not that a screen shows it. Screens were
  proven separately in Passes 2/3.
- Nothing measures invoice-entry speed or AI answer time — the promo's
  «۳ ثانیه» / «۲ ثانیه» remain unmeasured.

## Deliberately skipped

- The 6000+ names not in the eight claim groups; `pg.test.ts` bodies (they run
  SQL files against embedded Postgres — Pass 8/9 only if a claim needs it).
