# V72 — Operations Runbooks (G3) and commercial / data checks (W10 P2–P8)

> Every path and command here was located in the repository on 16 Nov 2026. Where the product has no
> mechanism, the section says NOT_IMPLEMENTED instead of describing one. Nothing here was executed by the agent.

## 1. Release

Order matters: the backend before the web build (a client that sends a new header to an old server is
refused by CORS — CLAUDE.md §8, BUG-099).

1. Migrations first, each with its VERIFY (`V72-OWNER-RUNBOOK.md` §2).
2. Backend deploy (Render). Then `GET /ready` must answer `200 {"status":"ok","database":"connected"}`
   (`backend/src/index.ts`, `server.get('/ready', …)`); `GET /live` and `GET /api/health` are liveness only.
3. Web: `apps/web` → `build` (`next build`). After it, restart any `next start` preview (it reads the build at start).
4. Windows: `apps/desktop` → `package:win` (`electron-vite build && electron-builder --win --publish never`).
   On this machine set `TMP`/`TEMP` to `C:\Users\hamed\Desktop\hisabche\.esbuild-tmp` first (lesson 249).
5. Android: `apps/mobile` → `android:release`. ⚠️ Check the APK's file date, not Gradle's message
   (an `UP-TO-DATE` run leaves the old APK — CLAUDE.md §8).

## 2. Rollback

- **Code:** redeploy the previous backend / web build; Windows and Android keep working offline on their local
  engine until the next update.
- **Database:** every migration file carries its own `Rollback / Mitigation` block at the top; there is no
  automatic down-migration. Run the block only after a FINDING shows what rows it would touch.
- **Device outbox:** never clear `sync_queue` to "roll back" a device — those rows are unsent sales and payments.

## 3. Incident

1. `GET /ready` — `503` means the API cannot read the database.
2. Error codes are stable strings (`code` in the response body); read the code, not the HTTP status
   (CLAUDE.md §8: «کدِ ۴۰۳ را از بدنه‌ی پاسخ بخوان»).
3. A device that cannot sync: the sync centre (`/sync-center`) shows each outbox row's stage (pending /
   rejected / conflict). A rejected financial row is never auto-resent.
4. Never print or paste `.env*` values or keys into a ticket or chat.

## 4. Backup and restore (P2) — **IMPLEMENTED_NOT_LIVE_VERIFIED (restore)**

- **What exists:** the local engine's `GET /workspaces/backup` (`packages/local-engine/src/routes/backup.ts`,
  capability `backup.manage`) returns a JSON dump of the device tables plus `sync_queue`, naming tables it
  could not read (`failedTables`) or cut short (`truncatedTables`).
- **Restore now has a real path (this round):** the portable, checksummed archive from
  `createExportPackage` is restored by `POST /workspaces/restore` in the same route file. It validates
  the archive and the workspace BEFORE writing, then restores in ONE SQLite transaction; an identical
  repeat is a no-op and a different local row with the same id is refused. The endpoint is exposed
  through the existing `localApiRequest` IPC channel, listed as locally available in
  `offline-endpoint-matrix.ts`, called from `useRestoreWorkspaceBackup` and offered in the Sync Centre
  (`BackupRestorePanel`). Tests: `restore.test.ts` (5) and `restore-route.test.ts` (6).
- **What still needs proof:** a real device round-trip — export from one install, restore into a fresh
  workspace, reconcile balances. A passing local test is not a production restore witness.
- **Cloud drill available today:** Supabase point-in-time restore into a **separate** project, then
  compare row counts of `invoices`, `payments`, `journal_lines` per workspace. Owner action; record the result.
- Decision D15 in `V72-OPEN-DECISIONS.md`.

## 5. Key rotation (offline licences)

`node scripts/generate-offline-licence-keys.mjs` prints a new public key entry and the SQL for the
database row. Order (from the script's header): add the public key to `TRUSTED_LICENCE_KEYS`
(`packages/app-shell/src/shared/lib/licence-keys.ts`) and ship Windows + Android **first**; then retire
the old row and insert the new one in one transaction. Keep the old public key while its licences live.
Never commit the printed private value.

## 6. Observability and error hygiene (P5)

- Health: `/live`, `/ready`, `/api/health` (above).
- New routes in this round reuse `sendFailure` / `fail` (stable codes) — no new logger, no new log field.
- Not measured in this round: whether any existing log line carries personal or financial data.

## 7. Performance (P6)

No query was added in this round that needs a new index (the repair QC read filters
`quality_events` by `workspace_id, source_type, source_id`, which `quality_events_ws_source_idx` already covers).
`EXPLAIN` on the live database is an owner action.

## 8. Claim guard (P7)

Per-industry limitations are generated from the capability registry into
`docs/industries/<id>/GAPS-AND-REQUIREMENTS.md` (`node scripts/industry/generate-industry-docs.mjs`).
Sales and onboarding copy must not describe a `planned` capability as available; five were wrongly moved
from `planned` to `partial` in the first V72 pass and were moved back (table service, room nights, asset
rental, livestock, crop cycle).

## 9. Data lifecycle (P8)

Export exists (§4). Workspace deletion / retention periods: NEEDS_OWNER_DECISION (no retention rule is invented here).
