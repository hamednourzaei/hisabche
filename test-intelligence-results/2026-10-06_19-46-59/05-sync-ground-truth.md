# Sync Ground Truth

| Scenario | Current Implementation | Existing Test | Actual Execution | Result | Data Preserved? | Status |
|---|---|---|---|---|---|---|
| offline create | IndexedDB Queue | Yes | EXECUTED | PASS | YES | VERIFIED |
| offline update | IndexedDB Queue | Yes | EXECUTED | PASS | YES | VERIFIED |
| offline delete | IndexedDB Queue | Yes | EXECUTED | PASS | YES | VERIFIED |
| duplicate mutation | Server idempotency | Yes | EXECUTED | PASS | YES | VERIFIED |
| timeout | Outbox retry | Yes | EXECUTED | PASS | YES | VERIFIED |
| reconnect | Flush queue | Yes | EXECUTED | PASS | YES | VERIFIED |
| concurrent update | Optimistic rejection | No | NOT EXECUTED | UNKNOWN | UNKNOWN | UNKNOWN |
| financial mutation | Rejected entirely | Yes | EXECUTED | PASS | NO | VERIFIED |

EVIDENCE for financial mutation rejection: The sync protocol explicitly drops financial field updates from the client to protect the ledger. This is an intentional architectural boundary, not accidental data loss.
