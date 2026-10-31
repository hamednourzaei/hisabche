# BUG-DISCOVERY-100 — Module Coverage

Status: INCOMPLETE. Only the modules below were read against current source; every other module is `NOT_EXAMINED` (see the main report, section 6).

| Module / core                   | Files read                                                                                                                        | Result                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Sync engine (push)              | `packages/app-shell/src/features/sync/sync-engine.ts` 557-624, 700-800; `packages/app-bridge/src/push-routing.ts`; `local-sql.ts` | BUG-NEW-001, 17B                                |
| Outbox wiring in local-engine   | `routes/*.ts` (grep of `buildEnqueue` across all route files)                                                                     | 21B, 13A, GAP-NEW-001                           |
| Local-engine authorization      | `auth.ts`, `context.ts`, capability caller count                                                                                  | 30B, BUG-NEW-006                                |
| Invoice cancel (offline)        | `routes/invoices.ts` 905-1095                                                                                                     | BUG-NEW-003, BUG-NEW-004                        |
| Invoice reverse (online)        | `backend/src/services/invoice.service.ts` 1735-1830, 2296-2308                                                                    | BUG-NEW-005                                     |
| Payments cancel (offline)       | `routes/payments.ts` 460-560                                                                                                      | used as the correct reference                   |
| Year-end close                  | `backend/src/services/accounting/accounting.service.ts` 1010-1095                                                                 | `NOT_A_BUG` (DB-keyed unique source)            |
| Document dating                 | grep over `backend/src/services`                                                                                                  | BUG-NEW-002                                     |
| Mutating route guards (backend) | `scripts/routes-scan` (temp, outside repo)                                                                                        | no defect proven (named `preHandler` constants) |

## Round two (appended)

| Module / core               | Files read                                                                                                                                                                                             | Result                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Payroll / HR                | `backend/src/routes/human-resources.routes.ts` 377-424; `services/human-resources.service.ts` 608-818; `packages/validation/src/schemas/payroll-rules.ts` 129-160, `human-resources.schema.ts` 220-242 | BUG-NEW-007, -008, -010; the x100 minor conversion round-trips and is `NOT_A_BUG` |
| Attendance routes           | `routes/attendance.routes.ts`, `attendance-device.routes.ts` (`requireRole('manager')` present)                                                                                                        | no defect proven                                                                  |
| Attendance link (public)    | `routes/attendance-link.routes.ts`, `services/payroll/attendance-link.service.ts`                                                                                                                      | RISK-NEW-001                                                                      |
| Local backup                | `packages/local-engine/src/routes/backup.ts` (all 104 lines)                                                                                                                                           | BUG-NEW-009, GAP-NEW-004                                                          |
| Offline licence             | `packages/app-shell/src/features/auth/offline-license.ts`, `packages/validation/src/schemas/offline-license.ts` 253-360                                                                                | 03B reopened, GAP-NEW-003                                                         |
| i18n                        | `packages/i18n/messages/{fa,af,en}/common.json` (key and placeholder diff script, outside the repo)                                                                                                    | no defect proven                                                                  |
| Dashboard / reporting reads | grep of `.limit(` and `count:'estimated'` over backend services                                                                                                                                        | no defect proven                                                                  |

## Round three (appended)

| Module / core          | Files read                                                                                                                           | Result                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| CRM / appointments     | `routes/crm.routes.ts`, `services/crm/crm.repository.ts`, `crm.service.ts`, `appointment.service.ts`, `routes/appointment.routes.ts` | BUG-NEW-011 (CRM task and opportunity writes are tenant-scoped by `workspace_id`) |
| Manufacturing          | `routes/manufacturing.routes.ts`, `services/manufacturing.service.ts` (rpc, idempotency key)                                         | no defect proven                                                                  |
| Import (server)        | `routes/migration.routes.ts`, `cloud-migration.routes.ts` (all guarded by `data.import`)                                             | no defect proven                                                                  |
| Import (local)         | `packages/local-engine/src/routes/import.ts` (all 182 lines)                                                                         | BUG-NEW-013, BUG-NEW-014                                                          |
| Subscriptions / limits | `middleware/subscription.middleware.ts`, `services/plan-limits.service.ts` 236-330, `routes/billing.routes.ts`                       | 25C reopened                                                                      |
| Licence devices        | `routes/billing.routes.ts` 771-812, `services/offline-license.service.ts` 946-996, `docs/entitlement-01-migration.sql` 103-114       | BUG-NEW-012                                                                       |
| Notifications          | `services/notification.service.ts` (writes scoped by `user_id`)                                                                      | no defect proven                                                                  |
| Realtime stream        | `routes/sync-stream.routes.ts` 1-110                                                                                                 | no defect proven                                                                  |
| Admin routes           | guard counts in `routes/admin*.routes.ts`, `system-metrics.routes.ts`                                                                | no defect proven                                                                  |
