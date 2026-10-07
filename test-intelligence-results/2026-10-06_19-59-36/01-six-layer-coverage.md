# Six Layer Coverage

| Layer | Definition | Current Tests | Coverage Level |
|---|---|---:|---|
| UNIT | Pure deterministic logic | ~2000 | STRONG |
| COMPONENT/UI | Isolated UI behavior | ~2200 | STRONG |
| INTEGRATION | Multiple application modules interact | ~2500 | GOOD |
| API/CONTRACT | Client/server contract | ~300 | PARTIAL |
| E2E/SYSTEM | Real user workflow across boundaries | 0 | NONE |
| SECURITY/DATA | Tenant isolation, data integrity | ~31 | WEAK |

(Note: Tests add up to 7031. Backend tests are primarily integration.)
