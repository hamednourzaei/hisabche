# Live audit of 14 Oct — what was fixed and what it taught

The bug list itself: `.claude/LIVE-AUDIT-2026-10-14.md` (82 rows, each with its status).
Production was read-only during the fixing round; everything below is local, not committed.

## Waiting for a human

| Item | What | Status |
|---|---|---|
| `docs/custom-units-01-migration.sql` | table `custom_unit_rates` (a unit the business names itself) | Post-migration verification query generated — PENDING HUMAN CONFIRMATION (`docs/VERIFY-custom-units-01.sql`) |
| `docs/FINDING-till-units-and-routing-2026-10-14.sql` | F1–F4, F6 (F5 was run: «صندوق تست» +419,760) | run each block separately |
| live data | the till ×100 payments and the bank payments booked to cash | a separate, reviewed repair — never merged with the code fix |
| «صندوق تست» | do NOT close it until repaired — it would book a fake shortage | |

## Lessons (numbered in `lessons-learned.md` style)

1. **The API client threw away the shape every screen reads.** The response interceptor rejected
   with `ApiError { message, code, status }` instead of the axios error, so 26 places reading
   `error.response.status` never saw a 503 («not configured») or 403, and `apiErrorMessage` /
   `apiErrorFields` — which read `error.response.data` — never saw the server's message. The
   storefront panel said «دریافت اطلاعات انجام نشد» for a feature that was simply not set up.
   Fixed at the source: `ApiError.response = { status, data }`. Guard in
   `live-audit-2026-10-14.test.ts`.
2. **`placeholderData: []` makes «still loading» look like «empty».** React Query v5 reports
   success with placeholder data, so `isPending` is false and the empty state renders. The
   English dashboard said «No activity recorded yet» until the answer came.
3. **`String.replace` that finds nothing changes nothing — silently.** A script moved the invoice
   rate box: the removal matched, the insertion's indentation did not, and the box vanished from
   the invoice. tsc was silent (an unused import is not an error); a source guard caught it.
   Every scripted edit must assert its match count (`split(a).length === 2`), for removals AND
   insertions.
4. **`t.has()` is next-intl's, not the desktop shim's.** Web tsc passed; app-shell and desktop
   failed. Use `translateOr(t, key, fallback)` (`lib/translate-or.ts`).
5. **A dotted id is not a message key.** `governance.rule_${'budget.draft-then-approve'}` is a
   nested path that does not exist, so every SoD rule showed its English rationale. Keys built
   from ids go through `id.replace(/[.-]/g, '_')`.
6. **The afghani is a word.** `currencySign(code, locale)`: «افغانی» in fa/af, «AFN» in en, the
   sign for every other currency. `formatCurrency`'s Intl output replaces «؋» the same way.
7. **Stock is valued at what it cost.** The warehouse card used `sell_price` beside a row column
   and a ledger at `buy_price` (1,360 vs 850). `summarizeStock` now uses buy price and ignores
   oversold (negative) quantities.
8. **A second rate list is a parallel architecture.** The warehouse chips read rates typed into
   the device's currency store, beside the business's saved `exchange_rates`. They now read and
   write the saved rates.
9. **A switch nothing runs is theatre.** «پشتیبان خودکار هر ۲۴ ساعت» was scheduled only when
   toggled on in that session, and copied the device's localStorage, not the business's records.
   Removed; the page says where the data really is.
10. **Display level ≠ stored level.** A module whose only rung is «read» showed the owner as
    limited. The fix is on screen (`shownLevel`), because the server's level must round-trip
    for the matrix to be editable.
11. **Server text is not a translation.** Smart insights were finished Persian sentences with
    «افغانی» written in; the server now sends `code` + `values` + `currency`, the screen writes
    the sentence. Same for notification amounts (metadata, not «10000 AFN» in the body).
