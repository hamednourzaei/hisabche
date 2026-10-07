| ID | Risk | Severity | Probability | Impact | Evidence | Mitigation | Verification |
|---|---|---:|---:|---:|---|---|---|
| R-01 | Codebase diverges from production DB schema | CRITICAL | High | Catastrophic | `PROJECT_STATE.md` (Backend undeployed) | Halt new table migrations until backend deploys | Verify production deploy logs |
| R-02 | Subscription to Workspace mapping ambiguity | HIGH | Medium | High | `docs/subscription-workspace-migration.sql` | Run Part 3 backfill manually and inspect | Review Part 4a/4c SQL output |
| R-03 | Mobile cross-platform parity blocked | HIGH | High | Medium | `PROJECT_STATE.md` (Hermes broken) | Repair `hermesc.exe` or Expo build chain | Successful `android:debug` build |
| R-04 | Admin API 403 silent failures | MEDIUM | High | Low | `HANDOFF.md` (Dual env configs) | Unify `ADMIN_ALLOWED_EMAILS` into one source | Login and execute API mutation |
| R-05 | AI Agent initiates unauthorized transaction | LOW | Low | High | `mcp.routes.ts` | Enforce human-in-the-loop approval queue | Security audit of `ai_action_requests` |
