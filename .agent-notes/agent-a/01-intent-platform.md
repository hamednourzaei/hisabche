# Pass 1 — product intent, flows, platform truth

## Files read

- `documents/USER_FLOWS.md` (full)
- `documents/PLATFORM_MATRIX.md` (full)
- `documents/OFFLINE_SYNC.md` (full)
- `documents/AUTH_AND_PERMISSION.md` (full)
- `docs/PRODUCT_FEATURE_MATRIX.md` (full — STALE, see below)
- `docs/offline/01-CAPABILITY-MATRIX.md` §0.1, §1, §2, §3, §4.1–4.11, §5, §6, §7.2–7.3 (lines 1–854)
- `docs/offline/ALWAYS-LOCAL-DECISIONS.md` (lines 1–47: A1–A12, C1–C4, D1–D12)
- `docs/offline/ALWAYS-LOCAL-00-FINDING.md` §1–§5.1 (lines 1–260)
- `.claude/POSITIONING-2026-09-15.md` (full)
- `.claude/BUSINESS-OS-SPEC.md` — headers only (intent doc, not proof)

## Facts proven

- Roles + capabilities: owner>admin>member>viewer; `record.delete`=owner,
  `member.invite`=admin, `workspace.manage`=owner (`AUTH_AND_PERMISSION.md` §Roles;
  source `packages/auth-core/src/permissions.ts`).
- Web keeps no local store; Windows = SQLite in main process; Android = expo-sqlite.
  (`OFFLINE_SYNC.md` §1; `PLATFORM_MATRIX.md`).
- Sync pulls exactly three entities: customer, product, invoice
  (`01-CAPABILITY-MATRIX.md` §1, §3.2 `DELTA_ENTITIES`).
- **Only one offline write is queued in the shipped shell: invoice create**
  (`packages/api/src/lib/offline-queue.ts`; §1 and §3.4 of the matrix).
- Android **pushes only, pulls nothing** (`OFFLINE_SYNC.md` §6).
- Invoice line items are not mirrored on the device (`OFFLINE_SYNC.md` §6).
- Payments and the ledger are server-side by design; device tables exist but are
  not pulled (`ALWAYS-LOCAL-DECISIONS.md` C4, D12).
- A **licensed offline edition** exists in the code: `packages/local-engine` with
  routes for invoices/accounting/payments/customers/products/warehouses/transfers/
  shelves/exchange-rates/workspace/backup/dashboard, reusing the same money
  functions as the server (`ALWAYS-LOCAL-00-FINDING.md` §4.3). Its licence gate is
  read in Pass 8. Not called AVAILABLE until the licence screen and its
  enforcement are read.
- Cold start offline is not solved in the _online_ edition: `useLoadWorkspace`
  fails without network → no workspace (`01-CAPABILITY-MATRIX.md` §6.2).
- Payments: a payment may only settle an invoice in the same currency
  (`settlesInCurrency`); balances are per currency, never summed
  (`payments.domain.ts` per §2).
- Profit report carries `costStatus` — unknown cost is not zero
  (`profit-report.domain.ts:185`).
- Invoice numbering is one server sequence, gaps allowed, duplicates not
  (`ALWAYS-LOCAL-00-FINDING.md` §5.1).
- Desktop prints HTML and ESC/POS thermal receipts; Android/web print path exists
  as WebView print (`01-CAPABILITY-MATRIX.md` §4.2 print row; `printing.ts`).

## Facts not proven

- Whether the licensed offline edition is shipped to a customer. Code + tests
  exist; no release artefact read. → PARTIAL at best.
- Multi-device offline numbering: explicitly **not built** (`ALWAYS-LOCAL-DECISIONS.md`
  §5.2 item 3: "No reserved range is built").
- "Team shares one book" for warehouses/employees/purchase orders/BOMs: those 29
  tables still use `user_id` (`PROJECT_STATE.md`). Not provable → avoid claiming.
- Backup/restore window, 2FA, encryption at rest, certifications: `POSITIONING`
  §NOT implemented says never claim. No file yet proves a mechanism.

## Contradictions (code/doc wins)

- `PRODUCT_FEATURE_MATRIX.md`: "Desktop: 0/6 modules, no desktop application" —
  **false**. `packages/app-shell/src/app/app.tsx` is the desktop route list and
  `docs/offline/01-CAPABILITY-MATRIX.md` audits 35 desktop/Android screens.
- `PRODUCT.md` "offline-first on every platform" — **false for web** (no local
  store) and **narrow for Windows/Android** (invoice create only, in the online
  edition).

## Deliberately skipped

- `01-CAPABILITY-MATRIX.md` Appendix A (lines 855+, ~4,000 lines of hook/endpoint
  tables) — the §4 capability tables already carry every claim I need.
- `BUSINESS-OS-SPEC.md` body (761 lines) — capability wish-list; intent only.
- `ALWAYS-LOCAL-00-FINDING.md` lines 261+ (numbering details, guards).
