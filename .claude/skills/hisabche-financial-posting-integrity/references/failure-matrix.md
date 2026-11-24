# Financial mutation failure matrix

| Failure point | Required behavior | Evidence |
|---|---|---|
| Before transaction | No financial effect | DB integration assertion |
| During source write | Entire transaction rolls back | No partial source row |
| During journal write | Entire transaction rolls back | No source-only success |
| During stock/cost write | Entire transaction rolls back | No ledger/stock divergence |
| After commit, before HTTP response | Retry returns original result | Idempotency replay test |
| Outbox publish unavailable | Durable outbox remains pending | Retry/consumer test |
| Local device goes offline | Draft/outbox persisted locally | Device/local-engine test |
| Two devices mutate same financial entity | Deterministic conflict or serialized command | Concurrent sync test |
| Provider failover during unknown commit | No blind duplicate; reconcile by key/source | DR chaos test |

Never assert a behavior from this table without a test or runtime evidence in the actual repository.
