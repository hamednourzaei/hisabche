# Handoff — the parallel agents (E: entitlement + admin · P7: offline Phase 7)

> One file, both agents. E writes the notes it owns; P7 writes «P7 done» here
> before E runs the full suites.

## E — registry ready (20 Oct 2026)

The feature registry and the pure resolver are in `packages/validation` and
exported from the package barrel. P7 can start P7-2.

| What                                                  | Where                                                     |
| ----------------------------------------------------- | --------------------------------------------------------- |
| the rows (every feature, its execution and its plans) | `packages/validation/src/schemas/feature-registry.ts`     |
| the resolver (the six verdicts)                       | `packages/validation/src/schemas/entitlement-resolver.ts` |
| the barrel                                            | `packages/validation/src/index.ts`                        |

```ts
import { FEATURE_REGISTRY, FEATURE_KEYS, isFeatureKey } from '@hisabche/validation'
import { resolveEntitlement } from '@hisabche/validation'

const verdict = resolveEntitlement(
  { state: 'ONLINE_ACTIVE', plan: 'ONLINE_500', edition: 'local' },
  'ai.cashflow_forecast',
)
// { kind: 'REQUIRES_ONLINE' }
```

- The **keys** are the names the contract fixed
  (`docs/offline/entitlement/00-CONTRACT.md` §14.2) — P7 must not invent a
  second list.
- The **verdicts**: `AVAILABLE | REQUIRES_ONLINE | NOT_ENTITLED |
REQUIRES_UPGRADE(plan) | EXHAUSTED | EXPIRED`.
- `execution`: `local | server | hybrid` (a hybrid row names its `local`
  and `server` parts).
- **Always allowed**: reading, printing, backup and export stay available in
  every state (principle 6) — the rows carry `alwaysAllowed: true`.

### For P7: what E still owes the UI (E4)

The UI hook `useActionAvailability` is **P7's file**
(`packages/ui/src/lib/capability/**`). E does not write it. E will send the
entitlement hook-up as a note here; P7 applies it.

The shape P7 can build against today:

- `resolveEntitlement(input, feature)` with
  `input = { state, plan, edition, usageExhausted? }`.
- `edition`: `'cloud' | 'local'` — the device's edition, not the plan's.
- The registry is plain data: `FEATURE_REGISTRY[feature].execution`,
  `.plans`, `.local`, `.server`, `.alwaysAllowed`.

### Shared files (the rule from the parallel prompt)

- The i18n file: E added `auth.offlineFirstRun.timeZone`, `auth.offlineFirstRun.timeZoneHint`,
  `auth.offlineFirstRun.timeZoneRequired` in `auth.offlineFirstRun.*`,
  verdicts and messages in `entitlement.*`, and plans in `billing.plans.*`.
  P7's `offline.cloudRequired.*` is untouched by E.
- E does not write `packages/ui/src/lib/capability/**` and does not write
  `packages/ui/src/components/ui/cloud-required-notice.tsx`.

## E — Entitlement Core ready (E2 done, 20 Oct 2026)

- Usage policy: pure function `countsTowardsInvoiceQuota` and `mayCreateInvoice` in `packages/validation`.
- Lifetime cap 50 on FREE, daily ceilings on ONLINE_* in `plan-limit-defaults.ts`.
- `plan-pricing.ts`: IRR stored, Toman shown, versioned.
- `entitlement.service.ts`: answers through resolver, export ALWAYS allowed.
- Migration `docs/entitlement-01-migration.sql` + `docs/VERIFY-entitlement-01.sql` + `backend/src/__tests__/entitlement-01.pg.test.ts` verified twice.
- All 41 tests passed.
- **E2 done**

## E — Signed licence ready (E3 done, 20 Oct 2026)

- Pure JS Ed25519 signing and verification with `@noble/curves@2.4.0` in `packages/validation` (`schemas/offline-license.ts`, exported in barrel).
- Deterministic canonical JSON serialization (`canonicalizeJson`, `canonicalizeLicensePayload`).
- Pure verifier `verifyOfflineLicense(options)` returns:
  `VALID | EXPIRED | WRONG_WORKSPACE | WRONG_DEVICE | TAMPERED | REVOKED | CLOCK_ROLLED_BACK | BANNED`.
- Clock rollback detection against `highestSeenAt` from device `meta` table (clock cheating prevented).
- Hardware key (TPM / Android Keystore) is optional hardening per Contract §6 and never locks out a device.
- Key rotation supported via key ID and public key map.
- Final E3 Licence Policy (owner specification):
  - **Seats**: 1 COMPUTER (Windows or macOS) + 1 MOBILE (Android or iOS; iPad counts as mobile). Model seats as `computer | mobile`, not OS. Online activation decided by server; 2nd computer or 2nd mobile -> `LICENSE_SEATS_FULL` (409) and no dashboard access.
  - **Reinstall**: on same physical device (`stable-id` match + new device key) is free forever and does not consume transfers.
  - **Transfers**: max 3 per calendar year, 4th refused with `LICENSE_TRANSFERS_EXCEEDED` (409) unless admin override is provided.
  - **Two-Tier Enforcement**:
    - **Tier 1 (Definitive Cryptographic Evidence)**: unregistered device key, invalid signature, seat key collision, tampered app integrity -> AUTOMATIC permanent ban of licence immediately, all active seats deactivated, evidence written to licence log. Only an admin can lift it (`POST /api/billing/offline-license/:licenseId/unban`).
    - **Tier 2 (Heuristic Signals)**: two business identities, parallel invoice sequences, disparate cities -> queued in `license_review_queue` for review, NEVER auto-ban.
  - **Ban Effect**: online devices at once, offline devices at next connection (`/connect`); operational writes stop (`NOT_ENTITLED`); read, print, backup and Excel/CSV export always keep working (`AVAILABLE`); no data locked, encrypted or deleted.
  - **Licence Log**: append-only table (`license_logs`) with Postgres trigger preventing `UPDATE` and `DELETE`. Events logged: `activation`, `rejected_activation`, `reinstall`, `transfer`, `connection`, `ban`, `unban`, `tier2_flagged`. Strict privacy filter `sanitizeLicenseLogEvidence` strictly strips invoice IDs, customer names, and money amounts.
- Database:
  - `docs/entitlement-02-migration.sql`: idempotent migration adding `status`, `banned_at`, `ban_reason`, `transfer_count`, `transfer_year` to `offline_licenses`; `license_id`, `seat`, `stable_id`, `public_key`, `ip_address`, `is_active` to `devices`; append-only `license_logs`; `license_review_queue`; updated `subscription_events` check constraint.
  - `docs/VERIFY-entitlement-02.sql`: post-migration verification queries (marked PENDING HUMAN CONFIRMATION).
  - `backend/src/__tests__/entitlement-02.pg.test.ts`: embedded postgres test running migration twice, testing check constraints and append-only trigger (5/5 passed).
- Backend routes in `backend/src/routes/billing.routes.ts`:
  - `POST /api/billing/offline-license/activate-seat`: enforces 1 computer + 1 mobile, reinstall, 3 transfers/year, admin override.
  - `POST /api/billing/offline-license/connect`: device heartbeat informing ban status.
  - `POST /api/billing/offline-license/tier1-report`: auto-ban on cryptographic violation.
  - `POST /api/billing/offline-license/tier2-report`: enqueues heuristic signal without banning.
  - `POST /api/billing/offline-license/:licenseId/unban`: admin-only unban route.
  - `GET /api/billing/offline-license/logs`: lists licence logs.
  - `GET /api/billing/offline-license/review-queue`: lists review queue.
  - `POST /api/billing/offline-license`: issues licence.
  - `GET /api/billing/offline-license`: lists licences.
  - `POST /api/billing/offline-license/:licenseId/revoke`: revokes licence.
  - `GET /api/billing/offline-license/revocations`: lists revocations.
  - `POST /api/billing/devices/activate` & `POST /api/billing/devices/:deviceId/release`: device registration/release.
- Mutating routes mapped in `backend/src/utils/concurrency-safety-map.ts`.
- Verified: `tsc --noEmit` 0 errors, eslint 0 errors, 16 validation tests passed, 11 policy tests passed, 6 route integration tests passed, 5 pg tests passed, 15 concurrency safety map tests passed.
- **E3 done**

## E — User Side & Entitlement UI Hook-up (E4 done, 20 Oct 2026)

### For P7: Entitlement hook-up for `useActionAvailability` (do not edit capability files directly)

Agent E does NOT edit `packages/ui/src/lib/capability/**`. Here is the exact hook-up seam for Agent P7 to connect `useActionAvailability(featureKey)` to `resolveEntitlement`:

```ts
import {
  resolveEntitlement,
  isFeatureKey,
  type FeatureKey,
  type EntitlementInput,
  type EntitlementVerdict,
} from '@hisabche/validation'

export function checkActionEntitlement(
  featureKey: string,
  state: {
    status?: string | null
    plan?: string | null
    edition: 'cloud' | 'local'
    usageExhausted?: boolean
  },
): EntitlementVerdict | null {
  if (!isFeatureKey(featureKey)) {
    return null // Not gated by feature registry
  }

  const entitlementState =
    state.edition === 'local'
      ? state.status === 'active'
        ? 'OFFLINE_ACTIVE'
        : 'OFFLINE_EXPIRED'
      : state.status === 'active'
        ? 'ONLINE_ACTIVE'
        : 'FREE_ACTIVE'

  const input: EntitlementInput = {
    state: entitlementState,
    plan: state.plan ?? 'FREE',
    edition: state.edition,
    usageExhausted: state.usageExhausted ?? false,
  }

  return resolveEntitlement(input, featureKey)
}
```

When verdict is:

- `AVAILABLE` -> action is enabled
- `REQUIRES_ONLINE` -> render `<CloudRequiredNotice />`
- `REQUIRES_UPGRADE(plan)` -> prompt upgrade to `plan`
- `NOT_ENTITLED` -> action disabled / lock
- `EXHAUSTED` / `EXPIRED` -> prompt limit reached / lock screen

### E4 Implementation deliverables:

1. **Landing Page Pricing Scene (`pricing-scene.tsx`)**:
   - Two boxes (Online / Offline selector) above pricing section.
   - Offline plan card displayed when offline is toggled.
   - All numbers fetched via API (`usePlans`), zero hardcoded prices, `landing-claims.test.ts` (48 tests) passed.
2. **Lock Screen (`subscription-lock.tsx`)**:
   - Updated message: «اطلاعات کسب‌وکار شما محفوظ است و حذف نشده است. برای ادامه‌ی عملیات، یکی از طرح‌های حسابچه را انتخاب کنید.»
   - Reassurance message: «مشاهده، چاپ و خروجی اطلاعات همواره در دسترس است.»
   - Unlocked `/data-and-sync` and `/settings` in `READ_ONLY_ROUTES` so users can always export their data even when expired.
3. **Offline Account Components**:
   - `OfflineAccountPrompt`: prompts on device login: «حساب شما آفلاین است - استفاده به صورت محلی» with `[ادامه]` and `[ارتقا به آنلاین]`.
   - `OfflinePortalView`: web portal view for offline accounts with device list, license status, upgrade credit breakdown, and backup/export action.
   - `GET /api/billing/upgrade-credit`: server endpoint computing credit from actual paid amount and remaining days.
4. **i18n**: keys in `fa`, `af`, `en` for `entitlement.offlineAccount.*` and `landing.pricing.edition*`.

- **E4 done**

### Note for P7 (TypeScript fixes needed in P7's files)

Please fix the following two lines in your files to unblock `packages/ui` `tsc --noEmit`:

1. `packages/ui/src/components/ui/analysis/peer-benchmark.tsx:43`:
   Change `title={t('title', 'مقایسه با همتایان')}` to `title={t('title')}` (next-intl does not accept string fallback as second parameter).
2. `packages/ui/src/components/ui/team-and-payroll/attendance-devices.tsx:117`:
   Change `title={t('title', 'دستگاه‌های حضور و غیاب')}` to `title={t('title')}`.

## P7 — Offline Phase 7 «این کار اینترنت می‌خواهد» (P7 done, 20 Oct 2026)

All steps of Phase 7 (P7-0 through P7-4 Gate 7) are completed and verified:

1. **Step P7-0 (Audit & Capability Mapping)**:
   - Audited `docs/offline/01-CAPABILITY-MATRIX.md` against `packages/validation/src/schemas/feature-registry.ts`.
   - Mapped all 31 C-class capability rows + 5 hybrid rows to exact `FEATURE_REGISTRY` keys.
   - Identified exact action triggers and locations across Web, Windows Electron, and Android Expo shells (unified under `One UI, One Contract, Two Hosts`).
   - Recorded plan in `docs/offline/P7-0-PLAN.md`.

2. **Step P7-1 (Shared Notice Component & i18n)**:
   - Created `packages/ui/src/components/ui/cloud-required-notice.tsx` with `card`, `inline`, and `fullscreen` variants.
   - Fully accessible (`role="region"` / `role="alert"`, `aria-live="polite"`), design-token based (`hsl(var(--...))`), RTL logical classes (`ms-`, `me-`, `text-start`).
   - Injected `offline.cloudRequired.*` i18n translations across all 3 languages (`fa`, `af`, `en`) via single-operation script adhering to shared-file discipline.
   - Component test suite `packages/ui/src/__tests__/cloud-required-notice.test.tsx` (12 tests passed).

3. **Step P7-2 (Availability Hook & Entitlement Seam)**:
   - Created `packages/ui/src/lib/capability/use-action-availability.ts` and barrel export.
   - Implemented `useActionAvailability(featureKey, options)` and pure `checkActionAvailability(featureKey, options)`.
   - Wired to `resolveEntitlement()` from `@hisabche/validation` using device edition (`getAppEdition()`: `'offline'` -> `'local'`, `'cloud'` -> `'cloud'`).
   - Supported hybrid capabilities (`part: 'local' | 'server'`).
   - Provided `registerEntitlementContextProvider` seam for Agent E.
   - Implemented `isOfflineNotAvailableError(error)` to identify 501 `OFFLINE_NOT_AVAILABLE` responses from the local engine.
   - Hook test suite `packages/ui/src/lib/capability/__tests__/use-action-availability.test.ts` (6 tests passed).

4. **Step P7-3 (Trigger Wiring & React Hooks Discipline)**:
   - Wired all mapped triggers across the repository:
     1. `ai-assistant-container.tsx` (`ai.assistant`)
     2. `manufacturing-container.tsx` (`manufacturing.bom`)
     3. `manufacturing-dashboard-card.tsx` (`dashboard.manufacturing_card`)
     4. `dashboard-view.tsx` (`dashboard.ai_insight`)
     5. `customer-profile-panel.tsx` (`customer.documents`)
     6. `customer-portal-panel.tsx` (`customer.portal_link`)
     7. `settings-page.tsx` (`settings.business_stamp`)
     8. `attendance-devices.tsx` (`hr.attendance_devices`)
     9. `attendance-link-dialog.tsx` (`hr.attendance_links`)
     10. `peer-benchmark.tsx` (`analysis.benchmark`)
     11. `bank-container.tsx` (`bank.import`)
     12. `developers-container.tsx` (`developer.keys`)
     13. `marketplace-container.tsx` (`marketplace.apps`)
     14. `market-seller-container.tsx` (`storefront.public`)
     15. `billing-hub-container.tsx` (`billing.portal`)
     16. `permissions-container.tsx` (`governance.permission_matrix`)
     17. `approvals-container.tsx` (`approvals.workflows`)
     18. `conflicts-container.tsx` (`sync.conflicts`)
     19. `data-and-sync-container.tsx` (`sync.overview`)
     20. `sync-page.tsx` (`sync.push_pull`)
     21. `invoice-preview-container.tsx` (`invoice.recurring`)
     22. `invoice-detail-container.tsx` (`invoice.approval`)
     23. `production-editor.tsx` (`manufacturing.produce`, `manufacturing.definition`)
     24. `team-and-payroll-container.tsx` (`team.members`)
   - Maintained strict React hooks discipline: clean outer/inner container separation (`Container` vs `Content`) so that hooks are never called conditionally or after early returns, and 0 network requests are initiated when offline.
   - Fixed the two TS/next-intl issues noted by Agent E in `peer-benchmark.tsx` and `attendance-devices.tsx`.

5. **Step P7-4 (Gate 7 Verification Suite)**:
   - Created `packages/ui/src/__tests__/cloud-required.test.ts`:
     - Tested all 31 C-class rows in `FEATURE_REGISTRY`: verified 100% return `REQUIRES_ONLINE` offline and normal execution online.
     - Tested all 5 hybrid rows (`data.backup`, `data.migration`, `dashboard.work_queue`, `product.images`, `inventory.costing_method`): verified local parts work offline while server parts require online.
     - Source audit: automated test verifying all 24 mapped UI component files import and call `useActionAvailability`.
     - Zero HTTP requests test: verified 0 calls to `apiClient.get/post/put/delete` and `fetch` when checking C actions offline.
   - Test metrics: 48 tests in 3 suites passed (100% green).
   - TypeScript check (`tsc --noEmit`): 0 errors across `@hisabche/ui`, `@hisabche/api`, and `@hisabche/app-shell`.
   - ESLint: 0 errors across all touched files.

**P7 done**

## A — Admin Panel Foundation (A1 done, 20 Oct 2026)

All requirements for Step A1 (Admin Foundation) are completed and verified:

1. **New shadcn primitives in `packages/ui/src/components/ui/`**:
   - `alert-dialog.tsx`: accessible dialog with `role="alertdialog"`, design tokens, RTL logical layout.
   - `command.tsx`: accessible command palette wrapping `cmdk` with full design tokens.
   - `checkbox.tsx`: radix checkbox with token styling and RTL support.
   - `textarea.tsx`: token-styled textarea.
   - `pagination.tsx`: standard shadcn pagination primitive + `PaginationBar`.
   - Exported in `packages/ui/src/index.ts` and `apps/admin/components/ui/index.ts`.

2. **Clean-up of hand-made primitives in `apps/admin`**:
   - Migrated all 17 consumer components across `apps/admin` to use shared `@hisabche/ui` primitives.
   - Deleted `Panel`, `FilterPill`, `Pagination`, `ListSkeleton`, `EmptyState`, and `StatusDot` from `apps/admin/components/admin-shell/admin-ui.tsx`.
   - Only `ErrorState` remains in `admin-ui.tsx`.

3. **8 Hubs Architecture (`HubTabs` + `?tab=`)**:
   - Established 8 hubs under `apps/admin/app/[lang]/(admin)/`:
     - `dashboard`: `overview` · `revenue` · `alerts`
     - `customers`: `workspaces` · `users` · `devices` · `support`
     - `revenue`: `plans` · `subscriptions` · `payments` · `upgrades` · `wallet`
     - `offline`: `licences` · `fleet` · `migration` · `reconciliation`
     - `product`: `features` · `ai` · `oauth` · `market`
     - `operations`: `health` · `servers` · `jobs`
     - `content`: `blog`
     - `security`: `audit` · `roles` · `sessions` · `events`
   - Updated `admin-nav.ts`, `admin-sidebar.tsx`, and `admin-header.tsx` with design tokens and the 8 hubs.

4. **Redirects for legacy routes**:
   - Configured 301 permanent redirects in `proxy.ts`, `next.config.js`, and legacy route page components for all 10 legacy paths (`/workspaces`, `/users`, `/subscriptions`, `/wallet`, `/ai`, `/oauth-apps`, `/market`, `/servers`, `/blog`, `/audit-logs`) to their respective hub tabs.

5. **`af` (Dari) Locale Added**:
   - Configured in `apps/admin/app/[lang]/i18n-config.ts`, `apps/admin/i18n/request.ts`, and `apps/admin/proxy.ts`.
   - All `admin.nav` and `admin.hubs` keys added across `packages/i18n/messages/{fa,af,en}/common.json`.

6. **Vitest & Guard Test in `apps/admin`**:
   - Added `"test": "node ../../packages/ui/node_modules/vitest/vitest.mjs run"` in `apps/admin/package.json`.
   - Created `apps/admin/vitest.config.mts`.
   - Created `apps/admin/src/__tests__/no-duplicated-primitives.guard.test.ts` (fails if `apps/admin` defines its own button/table/card/dialog/select/pagination).
   - Created `apps/admin/src/__tests__/hubs-and-redirects.test.ts`.
   - All 7 tests passed (100% green).

7. **Verification**:
   - `packages/ui`: `tsc --noEmit` -> 0 errors, `eslint` -> 0 errors.
   - `apps/admin`: `tsc --noEmit` -> 0 errors, `vitest` -> 7 passed, `eslint` -> 0 errors.

**A1 done**

## M — Safe Migration ready (M0–M4 done, 20 Oct 2026)

All requirements for Phase 8 Safe Migration (Offline -> Cloud) are completed, tested, and verified across local engine and backend:

1. **M0 — Contract & Architecture Survey**:
   - `docs/offline/migration/00-SURVEY.md`: Audited all canonical backend services with file:line citations; confirmed 0 blockers and verified reuse of file-import runner patterns (`claimRun`, `IMPORT_LIMITS`, `MIGRATION_RUNNING` lease, 2-minute takeover).
   - `docs/offline/migration/00-CONTRACT.md`: Complete 8-stage state machine (`REQUESTED` -> `COMPLETED | ROLLED_BACK` with intermediate `AWAITING_CONFIRMATION`), mapping table, numbering decision (`reference` preservation + cloud sequence), frozen exchange rates, and chronological recreation order.

2. **M1 — Device Export Engine (`packages/local-engine/src/export/**`)**:
   - `types.ts`, `checksum.ts`, `preview.ts`, `exporter.ts`, `index.ts`.
   - Read-only export package of local SQLite tables in topological order with SHA-256 section hashes and package checksum.
   - Preview generation calculating exact counts, totals by currency, customer receivables, stock per product×warehouse, balanced trial balance, and profit report (Unknown is not zero: null cost and null profit for unpriced products).
   - `packages/local-engine/src/__tests__/export.test.ts`: Round-trip, checksum tamper detection, preview math verified (3/3 passed).

3. **M2 — Server Import Pipeline**:
   - `backend/src/services/cloud-migration/cloud-migration.service.ts`: Chunked, resumable, lease-protected processor.
   - Deterministic idempotency key: `cmig-<entity>-<hash(licenceId, localId)>`.
   - Replays records through canonical domain services only (`CustomerService`, `ProductService`, `InvoiceService`, `PaymentsService`, `WarehouseService`, `CostingService`).
   - Database Migration: `docs/cloud-migration-01-migration.sql` + `docs/VERIFY-cloud-migration-01.sql` (creates `cloud_migration_jobs`, `cloud_migration_map`, `cloud_migration_records`, forward-only state guard trigger, RLS, REVOKE ALL).
   - Real PostgreSQL test: `backend/src/__tests__/cloud-migration-01.pg.test.ts` (embedded-postgres, verified twice, 5/5 passed).
   - Routes: `backend/src/routes/cloud-migration.routes.ts` registered in `backend/src/index.ts` and `backend/src/utils/concurrency-safety-map.ts`.

4. **M3 — Independent Reconciliation Engine**:
   - `backend/src/services/cloud-migration/reconciliation.service.ts`: Re-reads directly from cloud Postgres to verify invoice counts, currency totals, customer receivables, stock positions, trial balance debits/credits, and invoice profit reports before enabling cloud edition switch.

5. **M4 — Comprehensive 100-Invoice Test Suite**:
   - `backend/src/__tests__/cloud-migration-100-invoices.test.ts`:
   - Fixture generated strictly through local engine routes: AFN base, 2 warehouses, 30 products (20 with buy price, 10 without), 40 customers, 15 purchases (10 USD, 5 EUR with historical rates), 85 sales (60 AFN, 20 USD, 5 unknown cost sales), 40 payments (25 full, 15 partial), 5 cancelled invoices (2 paid then cancelled via `reverseEffects`), 3 transfers between warehouses.
   - All 16 must-pass cases verified (Happy path FIFO, Happy path AVCO, Kill at invoice 60 and resume with 0 duplicates, Kill inside invoice, double migration idempotency, lease conflict `MIGRATION_BUSY`, flipped byte rejected by checksum, invalid record rejection, forced mismatch rejection, unknown cost preserved as null, currencies never summed, frozen rates, numbering findable via reference, target workspace validation, device DB byte-identical before and after, injection testing). 16/16 tests passed!

6. **Verification Numbers**:
   - `@hisabche/local-engine`: `vitest run` -> 30/30 passed, `tsc --noEmit` -> 0 errors, `eslint` -> 0 errors.
   - `backend`: `cloud-migration-100-invoices.test.ts` -> 16/16 passed, `cloud-migration-01.pg.test.ts` -> 5/5 passed, `concurrency-safety-map.test.ts` -> 17/17 passed, `job-authority-guard.test.ts` -> 5/5 passed, `eslint` on changed files -> 0 errors.

**M done**

---

## A — Admin Panel 100% (A done, 20 Oct 2026)

Agent A has completed all steps A1 through A7 of the Admin panel programme (`docs/admin/ADMIN-AGENT-PROMPT.md`). All 38 completeness matrix rows are backed by file:line citations and green test suites.

### 1. Delivery Summary

- **A1 — Foundation**: 5 shared shadcn primitives (`alert-dialog`, `command`, `checkbox`, `textarea`, `pagination`), 17 legacy consumers migrated, 8 central hubs with `HubTabs` (`?tab=`), 10 legacy route 301 redirects in `proxy.ts` / `next.config.js`, `af` locale added. Guard tests: `no-duplicated-primitives.guard.test.ts` (3/3), `hubs-and-redirects.test.ts` (4/4).
- **A2 — Security & RBAC**: Fixed roles (`SUPER`, `BILLING`, `SUPPORT`, `CONTENT`, `MARKET`, `OPS`, `SECURITY`) with 61 granular permissions in `admin-rbac.domain.ts`. Middleware `requireAdminPermission`, `requireAdminAal2`, `requireAdminStepUp` (≤300s). Trigger-enforced immutable `audit_logs` (rejects `UPDATE` and direct `DELETE`). Security center (sessions list & revocation, security events, audit logs). Migration `docs/admin-02-security-migration.sql` + `docs/VERIFY-admin-02-security.sql` + `admin-02-security.pg.test.ts` (7/7 passed, verified twice).
- **A3 — Customers & Support**: Workspace 360 `Sheet` (13 tabs), Users full management (suspend, reactivate, revoke sessions, reset MFA), Support sessions (short-lived tokens), Internal notes / tags / timeline, Ctrl+K command palette, Trial-abuse signals, Customer data requests (export 7d, delete 30d, legal hold). Migration `docs/admin-03-customers-migration.sql` + `docs/VERIFY-admin-03-customers.sql` + `admin-03-customers.pg.test.ts` (4/4 passed).
- **A4 — Monetization & Plans**: Plan catalog, Price versioning (`effective_from/until`, IRR stored, Toman displayed), Subscription lifecycle + history with money fields, Entitlements with source, Usage analytics, Billing ledger, Maker-Checker for high-risk actions (`chk_maker_checker_proposer_ne_approver` + server enforcement), preview diff + `Idempotency-Key`, Dunning log. Migration `docs/admin-04-billing-migration.sql` + `docs/VERIFY-admin-04-billing.sql` + `admin-04-billing.pg.test.ts` (4/4 passed).
- **A5 — Offline & Licences (User Addition Complete)**:
  - Hub tabs in «لایسنس آفلاین»: `licences`, `devices` (computer/mobile seats), `log` (append-only licence log with filter/search and evidence Sheet), `bans` (automatic tier-1 bans with evidence; «lift ban» = `AlertDialog` / `StepUpDialog` with mandatory reason + step-up TOTP, audited), `reviews` (review queue for tier-2 heuristic signals; «ban» / «not abuse» with reason + TOTP).
  - Fleet health monitoring, migration center, reconciliation views.
  - Strict boundary: routes in `backend/src/routes/admin-offline.routes.ts` strictly call E's `offlineLicenseService`, never writing licence tables directly.
  - UI: shadcn primitives only (`DataTable`, `Badge`, `Sheet`, `HubTabs`, `AlertDialog`, `Button`).
- **A6 — Product, Operations, Analytics**: Feature flags with instant step-up toggle, real health probes (API, Postgres, storage, queue, AI, sync; no fake greens), background jobs retry, announcements & maintenance mode, audited CSV export (`buildCsvZip`), P2 revenue analytics based strictly on billing ledger (explicit empty state when empty). Migration `docs/admin-06-ops-migration.sql` + `docs/VERIFY-admin-06-ops.sql` + `admin-06-ops.pg.test.ts` (4/4 passed).
- **A7 — Admin Gate & Security Verification**: Real HTTP verification suite `backend/src/__tests__/admin-gate.test.ts` (7/7 passed): 401 unauthenticated, 403 non-admin, 403 RBAC permission denied, 403 Step-up required without fresh TOTP, 200 with fresh TOTP, 403 Maker-Checker violation when proposer attempts approval.

### 2. Measured Numbers

- `apps/admin`: `npx tsc --noEmit` -> 0 errors. `npm test` -> 7/7 passed. `eslint` -> 0 errors.
- `backend`: `npx tsc --noEmit` -> 0 errors. `vitest run src/__tests__/admin-gate.test.ts` -> 7/7 passed.
- `backend (embedded postgres)`:
  - `admin-02-security.pg.test.ts` -> 7/7 passed (run twice).
  - `admin-03-customers.pg.test.ts` -> 4/4 passed (run twice).
  - `admin-04-billing.pg.test.ts` -> 4/4 passed (run twice).
  - `admin-06-ops.pg.test.ts` -> 4/4 passed (run twice).
  - Total pg tests: 19/19 passed.
- `backend`: `concurrency-safety-map.test.ts` -> 20/20 passed.
- Completeness matrix in `docs/admin/ADMIN-AGENT-PROMPT.md`: 38/38 rows filled with file:line and test names.

**A done**
