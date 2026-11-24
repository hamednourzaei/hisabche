# Reconciliation and report contract

A report definition should explicitly state:

- report identifier and version;
- workspace/tenant scope;
- period start/end and timezone;
- currency or currency grouping;
- included journal states;
- source document states;
- treatment of reversals;
- treatment of opening balances;
- treatment of unknown/partial cost;
- rounding and currency scale;
- canonical query/service;
- reconciliation controls;
- freshness timestamp and stale-data behavior.

## Exception categories

- `MISSING_POSTING`
- `DUPLICATE_POSTING`
- `UNBALANCED_JOURNAL`
- `SOURCE_JOURNAL_MISMATCH`
- `CURRENCY_MISMATCH`
- `WORKSPACE_MISMATCH`
- `UNVALUED_STOCK`
- `UNKNOWN_COGS`
- `UNALLOCATED_PAYMENT`
- `ORPHANED_ALLOCATION`
- `PERIOD_CUTOFF_VIOLATION`
- `UNKNOWN_COMMIT_OUTCOME`

Use existing enum vocabulary if present. Do not add a parallel exception registry without proving one does not exist.
