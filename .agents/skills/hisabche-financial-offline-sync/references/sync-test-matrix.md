# Offline financial sync test matrix

| Scenario                   | Expected invariant                      | Proof                       |
| -------------------------- | --------------------------------------- | --------------------------- |
| Duplicate upload           | one server effect                       | Postgres integration test   |
| Commit + response loss     | same mutation result on retry           | fault injection             |
| Crash before outbox ack    | replay is safe                          | process restart test        |
| Crash during pull          | cursor not advanced past unapplied data | local DB test               |
| Concurrent device edits    | explicit conflict, no LWW               | multi-client test           |
| Permission revoked offline | server rejects on sync                  | HTTP + DB test              |
| Old snapshot arrives late  | local newer state retained              | version/cursor test         |
| Stock over-consumption     | one command rejected/serialized         | concurrent PG test          |
| Payment allocation race    | no over-allocation                      | transaction/constraint test |
| AFN round-trip             | exact integer preserved                 | property test               |
| Weak connectivity          | bounded retry and no data loss          | network shaping/device test |

Use deterministic fault injection where possible. Do not use sleep-based flaky tests when an explicit barrier or transaction hook is available.
