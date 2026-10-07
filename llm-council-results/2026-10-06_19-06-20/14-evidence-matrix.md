| Claim | Evidence Type | Source | Status | Confidence |
|---|---|---|---|---|
| Backend is undeployed and blocking tenancy | Repository | `PROJECT_STATE.md` | FACT | 100% |
| Subscription migration blocked awaiting Part 3 | Repository | `PROJECT_STATE.md`, `docs/subscription-workspace-migration.sql` | FACT | 100% |
| Mobile build broken by Hermes binary | Repository | `PROJECT_STATE.md` | FACT | 100% |
| 29 tables still use legacy `user_id` | Repository | `PROJECT_STATE.md` | FACT | 100% |
| Financial fields dropped from client sync | Repository | Council Analysis (Agent C) / Sync Engine | VERIFIED | 95% |
| MCP Gateway exists for AI agents | Repository | `backend/src/routes/mcp.routes.ts` | VERIFIED | 100% |
| RLS isolation is functioning | Test | `scripts/test-rls-isolation.sql` | VERIFIED | 95% |
| Dual `ADMIN_ALLOWED_EMAILS` config | Documentation | `HANDOFF.md` | FACT | 100% |
| Web build succeeds | Test | CI Output in `PROJECT_STATE.md` | VERIFIED | 100% |
| Admin Workspace Membership UI works | Inference | Council Analysis | PARTIAL | 80% |
