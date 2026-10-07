# Sync Behavior Matrix

| Scenario | Result | Preserved? | Retriable? | Resolvable? | Lost? | Evidence |
|---|---|---|---|---|---|---|
| offline create | ACCEPTED | Yes | Yes | N/A | No | TH-SYNC-001 |
| duplicate mutation | REJECTED | Yes | N/A | Yes | No | TH-SYNC-002 |
| stale version conflict | REJECTED | Yes | Yes | Yes | No | TH-SYNC-001 |
| timeout-after-success | IDEMPOTENT | Yes | Yes | N/A | No | TH-SYNC-002 |
