# Posting invariants and review matrix

## Event-to-ledger mapping template

| Source event     | Debit                                      | Credit                                     | Currency              | Amount source                    | Idempotency          | Reversal                 |
| ---------------- | ------------------------------------------ | ------------------------------------------ | --------------------- | -------------------------------- | -------------------- | ------------------------ |
| Sale invoice     | Verify current chart mapping               | Verify current chart mapping               | Invoice/book currency | Server-derived lines             | Existing source key  | Linked reversal          |
| Purchase invoice | Verify current chart mapping               | Verify current chart mapping               | Invoice/book currency | Server-derived lines             | Existing source key  | Linked reversal          |
| Payment received | Verify cash/bank account                   | Verify receivable/clearing                 | Payment currency      | Validated allocation             | Existing payment key | Explicit refund/reversal |
| Payment made     | Verify payable/expense/asset               | Verify cash/bank account                   | Payment currency      | Validated allocation             | Existing payment key | Explicit reversal        |
| COGS             | Inventory/COGS mapping from current policy | Inventory/COGS mapping from current policy | Cost layer currency   | Consumed layers                  | Existing costing key | Cost reversal            |
| Opening stock    | Owner-approved opening mapping             | Owner-approved opening mapping             | Product/book currency | Explicit valued opening quantity | Existing opening key | Audited correction       |

This is a review template, not an assertion that these mappings currently exist. Resolve every account role and posting function from the current code and owner-approved accounting policy.

## Hard assertions

- Sum(debit) = Sum(credit) at the final posted boundary.
- All lines belong to the same journal and workspace.
- A line cannot be orphaned.
- A posted journal has at least the minimum number of valid lines required by the accounting policy.
- A reversal references the original entry and does not mutate it.
- Source state and journal state cannot diverge after a committed transaction.
- Replayed requests return the original result or a deterministic conflict; never create duplicate financial effects.
- Unknown is not zero; null is not silently coalesced to zero for financial meaning.
