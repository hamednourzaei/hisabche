# FINANCIAL-INVARIANTS — what must hold at any load, and how the lab checks it

These are **gates**, not metrics. A load stage that breaks any of them is
classified **FAILURE** regardless of its latency (`SLO.md` §“Classification
bands”). They run after every stage, and again after the kill/restart recovery
work in M7.

**Enforcement legend** — **[DB]** = the rebuilt schema itself enforces it (a
trigger or constraint, measured present in the lab); the lab verifies the object
exists, is enabled, and that zero violations accumulate. **[probe]** = no single
database object enforces it end to end; the lab queries for violations.

| #   | Invariant                                                                         | Enforced by                                                                                                              | Lab check                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Σ debit = Σ credit **per journal document**                                       | **[DB]** `journal_entries_balance_trg` — constraint trigger, `DEFERRABLE INITIALLY DEFERRED` (measured present)          | unbalanced documents = 0; the trigger exists and is enabled                                                                                                                 |
| 2   | Money on the money path is **integer minor units — no floating point**            | services + schema (`AGENTS.md` §1.3)                                                                                     | column-type census over the frozen money-column list (read from the migrations in M2, not guessed): any `real`/`double precision` on the path = FAILURE                     |
| 3   | A **cancelled/voided** document nets to zero                                      | `ledger.reverseDocument`, `payments_cancel`                                                                              | per cancelled invoice: the original and its reversal ledger effects sum to 0                                                                                                |
| 4   | Cost layers: **consumed ≤ received**, valuation = remaining × unit cost           | costing RPCs (`inventory_receive_layer`, `inventory_consume_layers`, `inventory_release_consumption` — measured present) | no layer with negative remaining; recomputed valuation equals stored                                                                                                        |
| 5   | `products.quantity` equals the movement log                                       | **[DB]** `stock_movements_project_trg` (measured present)                                                                | products whose quantity differs from Σ of their movements = 0                                                                                                               |
| 6   | Per payment, Σ allocations ≤ amount; **one currency per allocation**              | **[DB]** `payment_allocations_same_currency_trg` (measured present)                                                      | violation count = 0                                                                                                                                                         |
| 7   | **Idempotency**: one key → one document; duplicates are refused deterministically | invoice/POS RPC guards                                                                                                   | a duplicate submission — sequential and, in M5, concurrent — yields exactly one row; the loser gets a deterministic refusal, never a duplicate and never an unhandled error |
| 8   | **Tenancy**: money rows carry `workspace_id`; child rows share their parent's     | RLS + services                                                                                                           | NULL `workspace_id` on tenant tables = 0; invoices vs their lines / payments / ledger rows — workspace mismatch = 0                                                         |
| 9   | **No capped read feeds a total**                                                  | measurement rule (`AGENTS.md` §3)                                                                                        | every total the lab reports comes from `count(*)` or full pagination; a `LIMIT` never sits under a number a decision leans on                                               |
| 10  | **Recovery** breaks nothing                                                       | WAL                                                                                                                      | M7: kill during load → restart → the whole suite above runs again and must pass                                                                                             |

Probe output format: `reports/invariants-<stage>.json` — per invariant, the
exact SQL and the measured count. Expected count is **0** for every row above
(except the existence assertions, which must be true). The exact column names in
invariants 2, 3 and 8 are frozen against the rebuilt schema during M2
(`information_schema`), quoted in the dataset manifest, and never written from
memory into this file.
