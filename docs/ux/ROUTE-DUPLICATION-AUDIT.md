# Hisabche UX Reconstruction — Route Duplication & Orphan Audit

> **Phase 0 Deliverable** | Generated: `2026-11-26`

## 1. Already Consolidated (October 2026 Single-UX Rollout)

Per `CLAUDE.md §0.6` and `apps/web/next.config.js`, 31 legacy routes were already consolidated into hubs and redirected (`308` on web, `<Navigate>` in `app-shell`), reducing `(dashboard)` routes from 57 to 30:

- `/crm`, `/sales-followup`, `/tasks`, `/campaigns` -> `/customers?tab=outreach...`
- `/bank`, `/assets`, `/budgets`, `/reports` -> `/accounting?tab=...`
- `/expiry`, `/product-list`, `/inventory` -> `/warehouse?tab=...`
- `/human-resources`, `/team`, `/timesheets` -> `/team-and-payroll...`
- `/quick-invoice`, `/purchasing`, `/promotions`, `/sales*` -> `/invoices...`
- `/conflicts`, `/data-migration` -> `/data-and-sync?view=...`
- `/wallet`, `/referrals` -> `/billing?tab=money...`

## 2. Remaining Duplication / Overlap Candidates (To Evaluate in Phase 3+)

| Candidate Pair                                   | Shared Core / Observation                                                                                         | Recommendation (Needs Phase 3 Verification)                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/invoices/new` + `/invoices/new/preview`        | Two-step invoice creation flow (`InvoiceBuilderContainer` -> `InvoicePreviewContainer`)                           | Evaluate merging preview into `?step=preview` or side-by-side drawer while preserving URL compatibility                               |
| `/data-and-sync` vs `/sync-center`               | Both surface sync/outbox status (`DataHubContainer` vs `SyncCenterContainer`)                                     | Keep `/sync-center` standalone on Windows/Mobile per `CLAUDE.md §0.6` (device outbox), clarify boundary on Web                        |
| `/audit` vs `/activities` vs `/governance`       | Overlapping oversight/event streams; `/audit` is unlinked in `NAV_CONTRACT`                                       | Inspect in Phase 3 whether `/audit` belongs as a tab in `/governance` or stays standalone                                             |
| `/operations` & `/stock-count` vs `/warehouse`   | Both belong to `operations` pack / inventory domain, currently hidden from `NAV_CONTRACT`                         | Inspect in Phase 3; per `hisabche-ux-consolidation`, `/stock-count` was left out because no UI started counts (`useCreateCycleCount`) |
| `/developers` vs `/settings`                     | `/developers` is hidden from `NAV_CONTRACT` and linked from `/settings`                                           | Keep or surface cleanly inside Settings -> Integrations without losing direct URL                                                     |
| `CustomerListContainer` / `ProductListContainer` | Kept in `@hisabche/ui/screens` for `contract-consumers.test.ts` while `/customer-list` & `/product-list` redirect | Do not delete without updating contract guard                                                                                         |

## 3. Disabled / Gated Routes (`DISABLED_PAGES`)

- `/market-seller` and `/marketplace` are globally switched off via `DISABLED_PAGES` in `packages/ui-contract/src/navigation.ts` and `gated()` in `app.tsx`. They must remain hidden/redirected until explicitly enabled by the owner.
