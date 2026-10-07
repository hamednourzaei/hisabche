# Sync Execution Evidence

| Scenario | Test Exists | Executed | Result | Rejected or Lost | Evidence |
|---|---|---|---|---|---|
| offline create | Yes | Yes | PASS | Neither | packages/sync tests |
| financial mutation | Yes | Yes | PASS | Rejected | Intentional guardrail dropping updates |
