# BUG-DISCOVERY-100 — Test Evidence

Environment: Windows 11, Node via pnpm workspace, no database, no Android/Windows native, no production access. All runs read-only for the repository.

| Command                                                                                                                     | Result                                                          | Exit                |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| `npx tsc --noEmit` in `backend`, `packages/validation`, `packages/local-engine`, `packages/api`, `packages/ui`, `apps/web`  | no diagnostics                                                  | 0 for each of the 6 |
| `npx vitest run src/__tests__/gate3-payment-idempotency.test.ts src/__tests__/purchase-return-accounting.test.ts` (backend) | Test Files 2 passed, Tests 11 passed                            | 0                   |
| `npx vitest run src/__tests__/transfer-cost-layers.test.ts src/__tests__/gate2-authorization.test.ts` (local-engine)        | Test Files 2 passed, Tests 11 passed                            | 0                   |
| `node -e` (outside repo): `new Date('2026-10-31T21:00:00Z')` formatted three ways                                           | UTC slice `2026-10-31`; Kabul `2026-11-01`; Tehran `2026-11-01` | 0                   |
| `grep -c` capability callers (13 capabilities in `auth.ts`)                                                                 | 12 have 0 callers; `product.write` has 1                        | 0                   |

Limitations: no reproduction test was executed for BUG-NEW-001, -003, -004, -005, -006; they are `SOURCE_CONFIRMED` and `NOT_LIVE_VERIFIED`. Existing green suites do not exercise delivery of queue entries, so they do not contradict these findings. No temporary file was left in the repository.

## Round two (appended)

| Command                                                                                         | Result                                                                                                                                                                             | Exit |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `node i18n-diff.js` (scratchpad, outside the repo): flatten and diff `fa`/`af`/`en` common.json | keys: af 9158, en 9149, fa 9156; differences are legacy `landing.security.badge.*` keys and one extra af section; the single placeholder "mismatch" is an ICU `select` false alarm | 0    |
| `grep` capability/role guards in `human-resources.routes.ts`                                    | `requireCapability`=0, `requireRole`=0 for 11 mutating routes; `attendance.routes.ts` uses `requireRole('manager')`                                                                | 0    |
| `grep bookPayroll`                                                                              | only two call sites (`human-resources.service.ts:661,723`)                                                                                                                         | 0    |

Limitations: BUG-NEW-007 to -010 are `SOURCE_CONFIRMED` and `NOT_LIVE_VERIFIED`. The live database was not queried, so a unique index on `payrolls` outside the repository SQL cannot be excluded for BUG-NEW-010.

## Round three (appended)

| Command                                                 | Result                                                    | Exit                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `grep` guard counts per route file (`platformAdminGuard | requireCapability                                         | requireRole`) over admin, billing, crm, manufacturing, migration, cloud-migration | admin files 15-38 guards; `crm.routes.ts` 7 mutating routes with membership only; migration and cloud-migration use a shared `guarded` array with `data.import` | 0        |
| `grep -rn "maxDevices                                   | max_devices                                               | device_limit                                                                      | seatLimit" backend/src`                                                                                                                                         | no match | 0   |
| `grep` of `docs/entitlement-01-migration.sql`           | `device_id uuid PRIMARY KEY` (line 104)                   | 0                                                                                 |
| `grep -n "failed: 0                                     | 'local_only'" packages/local-engine/src/routes/import.ts` | lines 147, 168, 179                                                               | 0                                                                                                                                                               |

Limitations: BUG-NEW-011 to -014 and 25C are `SOURCE_CONFIRMED` and `NOT_LIVE_VERIFIED`; no reproduction test was executed. The live database was not queried (an exclusion constraint on `appointments` or a unique index outside the repository SQL cannot be excluded for BUG-NEW-011).
