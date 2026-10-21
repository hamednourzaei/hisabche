# Always-Local F3/F4: final decisions. Stop deliberating and implement.

> You are stuck re-deriving the same design questions. **Every question below is closed.** The owner decided them.
> Do **not** re-open, re-verify, or re-argue any row. Read this file once, then write code.
> All rules in `ALWAYS-LOCAL-PROMPT.en.md` §0 and `ALWAYS-LOCAL-CONTINUE.en.md` still apply.

---

## 0. Thinking discipline (hard rule)

- **No more than 5 lines of reasoning per step.** If you notice you are re-reading a file you already read, or re-weighing an option listed below, **stop thinking and do the row as written**.
- Read only the exact lines you will edit. Do not re-scan the codebase "to be sure".
- Each step runs this loop: **one edit batch → tests for that step → one line in `ALWAYS-LOCAL-RUN-LOG.md` → next step.**
- If a step does not go green after **2 attempts**, write it in `ALWAYS-LOCAL-DECISIONS.md` as `REMAINING: <step> — <reason> — <file:line>` and **move on to the next step**. Do not loop.
- A new question not covered here ⇒ pick the option that reuses the existing code and changes the fewest lines, write one line in DECISIONS, and continue. Never stop to ask.

---

## 1. Binding decisions

| #   | Question                                                                                         | Decision (final)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | How does a **cloud-edition** offline invoice reach the local engine?                             | Add one small exported `localRequest(method, path, body)` in `packages/api/src/lib/client.ts` that uses the already-registered local transport. In `submitInvoice`, the offline branch calls `localRequest('POST','/invoices', body)`. **If no local transport is registered, fall back to the existing `queueIt()`**, so behaviour stays the same.                                                                                                                  |
| D2  | Who writes the outbox row, and how do we avoid filling the offline edition with unsendable rows? | The local engine `POST /invoices` writes the outbox row via the shared `buildEnqueue` **inside the same `db.transaction`**, **only when the request carries header `x-hisabche-queue: 1`**. Only `localRequest` sets that header. The offline edition never sends it, so it is unchanged. `client_id` = the local invoice id; payload = the raw request body; idempotency key = derived from the local invoice id. The `user_id`/`workspace_id` scope comes from F1. |
| D3  | How does the local projection reconcile with the server row?                                     | After the outbox push for that invoice succeeds, delete the **local projection only** (the invoice and its items, matched by `client_id`) in one SQLite transaction. The next pull brings the server row with the official number. Stock and balance projections are rebuilt from pulled data. If `client_request_id` is not part of the pull, **do not add a column**; write that in DECISIONS.                                                                     |
| D4  | Temporary number                                                                                 | Keep what is already done: `OFF-<device>-<seq>` plus the "temporary" label. The official number comes only from the server's `nextval`. Nothing more to design.                                                                                                                                                                                                                                                                                                      |
| D5  | Conflict states: a new column, or extend `status`?                                               | **Neither.** Keep `sync_conflicts.status`/`resolution` as they are. Expose a **derived** `state` in one pure function: `open → PENDING_REVIEW`, `keep_client → ACCEPTED`, `keep_server → REJECTED`, `merge`/`auto_merge → RESOLVED`, `superseded → SUPERSEDED`. One function, used by the server and the UI.                                                                                                                                                         |
| D6  | Migration for F4                                                                                 | Only a **forward-only trigger** on `sync_conflicts`: no going back from `resolved`/`superseded` to `open`; when resolved, `resolved_by` and `resolved_at` must not be null. Use `SET search_path`, and revoke EXECUTE from `public, anon, authenticated, service_role`. Files: `docs/sync-conflicts-forward-01-migration.sql` + `docs/VERIFY-sync-conflicts-forward-01.sql` + a `*.pg.test.ts` that runs the migration twice. Do not wait for the human.             |
| D7  | Who may decide                                                                                   | Keep the existing `requireCapability('ledger.reverse')` and **also** check `request.tenancy.role === 'owner'` explicitly in the route. Return 403 otherwise.                                                                                                                                                                                                                                                                                                         |
| D8  | Reject = reverse?                                                                                | A conflict from M2.4 negative stock is a sale **the server already accepted** (M2.4: overselling is recorded, not refused). **Rejecting the conflict never reverses that sale.** It records the decision, the reason, who decided and when; the invoice stays. Write this in DECISIONS as an owner decision. **Do not import `InvoiceService` into the conflict service**, which would create a cycle. Making `reverseEffects` public is out of scope: `REMAINING`.  |
| D9  | Seller sees state and reason                                                                     | Use the existing conflict list or route plus the D5 `state` and `resolution_reason`. Show it in the **existing** conflict UI with labels in fa, af and en. No new route or page.                                                                                                                                                                                                                                                                                     |
| D10 | F3.4 KPI "pending" label                                                                         | The local-engine dashboard route returns `pendingInvoiceCount` (the rows in the outbox for this owner). Add the label "includes N invoices awaiting confirmation" (fa/af/en) **only if** the app-shell dashboard already consumes that local route. If it does not, write `REMAINING` in DECISIONS and move on.                                                                                                                                                      |
| D11 | F4.4 two-device test                                                                             | A **domain-level deterministic test**: server stock 5; two outbox entries each selling 3, applied in queue order. Assert: both invoices exist, final stock is −1, exactly one `negative-stock` conflict with `breachKey = <mutationId>:negative-stock:<productId>`, and re-applying the same entries changes nothing. Assert balances, not row counts. No real devices.                                                                                              |
| D12 | One-financial-engine guard (F3.2)                                                                | A source-scanning test: files under `packages/local-engine` and `packages/app-shell` must not hold their own FIFO, AVCO, COGS or profit formula. They import from the shared core. Injection-test it once.                                                                                                                                                                                                                                                           |

---

## 2. Order (do exactly this, top to bottom)

```
F3.1  D1 + D2  (localRequest, header-gated outbox row in the same transaction)
F3.2  D12 guard
F3.3  D3 reconciliation after push (D4 already done)
F3.4  D10
F4.1  D5 derived state + D6 migration files
F4.2  D7 owner decision route
F4.3  D8 + D9
F4.4  D11
END   the final verification, builds, lessons, graphify and report, as in ALWAYS-LOCAL-CONTINUE.en.md §6
```

Report in Persian once, at the very end. Any migration not yet run by the human ⇒ `Post-migration verification query generated — PENDING HUMAN CONFIRMATION`. Every `REMAINING` item goes in the report. No commit, no push.
