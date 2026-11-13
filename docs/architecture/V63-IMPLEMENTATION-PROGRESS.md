# V63 — Admin console completion — implementation progress

- **Mission:** close the leaks in `apps/admin` and the `/api/admin/*` surface, then build payment
  gateways, live monitoring and full AI administration on the same infrastructure.
- **Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED`. No migration has been run on a live database and no
  screen has been opened against a real admin session.
- **Rules kept:** no commit / push / reset / stash / clean; no `.env` read; no new dependency; no
  `next build`; every migration is a file only (`PENDING HUMAN CONFIRMATION`).

> **خلاصه برای مالک.** هفت نشتی امنیتی بسته شد: هر مسیر مدیر از یک زنجیرهٔ واحد
> (احراز هویت ← فهرست مجاز ← مجوز ← Step-Up) می‌گذرد، MFA دیگر در محیط تست نادیده گرفته
> نمی‌شود، رازها از متن ساده به Vault رفتند، کنسول CSP/HSTS گرفت، سقف درخواست و فهرست
> مجاز IP اضافه شد، صفحهٔ وضعیت امنیت از واقعیت محاسبه می‌شود، و مدل تهدید نوشته شد.
> بعد روی همان زیرساخت: درگاه‌های پرداخت (Stripe/PayPal/دستی/آداپتور محلی)، مانیتورینگ
> با rollup در Postgres + دیوار تلویزیون با توکن، و مدیریت کامل AI (مصرف، قیمت، بودجه،
> نسخه‌های دستور، گزارش). هیچ‌کدام روی دیتابیس واقعی اجرا نشده‌اند؛ مهاجرت‌ها را خودتان
> به ترتیب بخش ۶ اجرا کنید.

---

## 1. Slices

### S — Security (S-1 … S-7)

| Slice | What landed                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Where                                                                                                                                                                                                                                                                                                 |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-1   | One guard chain: `adminRoute(permission, { stepUp })` and `adminRouteByMethod(...)`. Every admin route file migrated; new permissions (`product.ai.write`, `operations.servers.scale`, `operations.monitor.read/write`, `security.secrets.read/write`, `security.posture.read`, `content.blog.*`, `product.market.*`, `product.oauth.*`); step-up on subscription plan/status, member removal, user actions, scale-up, exports; maker-checker action types generalised | `backend/src/middleware/admin-rbac.middleware.ts`, `backend/src/services/admin/admin-rbac.domain.ts`, `backend/src/utils/admin-route-audit.ts`, `backend/src/__tests__/admin-route-chain.test.ts`                                                                                                     |
| S-2   | `isTestRuntime()` — true only with `VITEST` **and** `buildServer({ testRuntime: true })`; production startup refuses a test marker; `requireStepUpMfa` reads `verifiedTokenClaims` instead of decoding the JWT itself                                                                                                                                                                                                                                                  | `backend/src/runtime/test-runtime.ts`, `backend/src/middleware/mfa.middleware.ts`, `backend/src/middleware/admin-rbac.middleware.ts`                                                                                                                                                                  |
| S-3   | `platform_secrets` (metadata only) + Vault `SECURITY DEFINER` functions (`platform_secret_set/get/stage/promote/discard`, `platform_secrets_list`); 5-minute cached reader; admin routes return `last4` + `rotated_at` only; AI key and Stripe secrets read through the store with an env fallback logged as `SECRET_FROM_ENV`                                                                                                                                         | `docs/admin-secrets-01-migration.sql`, `backend/src/services/secrets/secret-store.ts`, `backend/src/routes/admin-secrets.routes.ts`, `backend/src/__tests__/secret-never-returned.test.ts`                                                                                                            |
| S-4   | Strict CSP with a per-response nonce in `proxy.ts`; HSTS, Permissions-Policy, COOP in `next.config.js`; no static CSP (asserted both ways); CMS/blog HTML sanitised on the server                                                                                                                                                                                                                                                                                      | `apps/admin/proxy.ts`, `apps/admin/next.config.js`, `backend/src/services/cms/cms.sanitize.ts`, `apps/admin/src/__tests__/security-headers.test.ts`, `backend/src/__tests__/cms-sanitize.test.ts`                                                                                                     |
| S-5   | Admin idle (30 min) and absolute (12 h) timeouts; per-admin + IP rate limit (shared store when present, local fallback, 429 never 500); optional IP allow-list with break-glass for the owner email; every refusal is a security event                                                                                                                                                                                                                                 | `backend/src/middleware/admin-rate-limit.middleware.ts`, `docs/admin-ip-allowlist-01-migration.sql`, `backend/src/services/admin/admin-ip-allowlist.service.ts`, `backend/src/utils/ip-cidr.ts`, `backend/src/__tests__/admin-rate-limit.test.ts`, `backend/src/__tests__/admin-ip-allowlist.test.ts` |
| S-6   | `security?tab=posture`: pass / fail / unknown + evidence, computed from live state (MFA enrolment, step-up use, secrets still in env, guard coverage, CSP, backup-restore age, open maker-checker requests, IP allow-list)                                                                                                                                                                                                                                             | `backend/src/services/admin/admin-posture.service.ts`, `apps/admin/app/[lang]/(admin)/security/posture/*`                                                                                                                                                                                             |
| S-7   | STRIDE threat model per asset with residual risk and a Persian summary                                                                                                                                                                                                                                                                                                                                                                                                 | `docs/architecture/admin/THREAT-MODEL.md`                                                                                                                                                                                                                                                             |

### P — Payment gateways (P-1 … P-3)

| Slice | What landed                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P-1   | `platform_payment_gateways` (kind, mode, `public_config` jsonb, `secret_names text[]`, `updated_at/by`); one row per configured gateway; live enable / secret change goes through maker-checker                                                                                                                                                                                                                                                                          |
| P-2   | `gateway.port.ts` + `stripe.adapter.ts` (existing behaviour behind the port), `paypal.adapter.ts` (Orders v2 + verify-webhook-signature), `manual.adapter.ts` (bank / PayPal.me reference, admin confirms, credits the existing billing ledger), `local.adapter.ts` (neutral interface, no brand claimed); one webhook route per kind, raw body, signature check, replay window, idempotency `gw-<kind>-<eventId>`; replay button re-processes idempotently with step-up |
| P-3   | Revenue › `gateways`: list (kind, mode, enabled, last webhook, 7-day success rate), per-kind form with write-only secrets (`•••• last4` + replace), "Test connection", copyable webhook URL, live/test badge                                                                                                                                                                                                                                                             |

Evidence: `docs/admin-payment-gateways-01-migration.sql`, `backend/src/services/payments-gateway/`,
`backend/src/routes/admin-gateways.routes.ts`, `apps/admin/hooks/use-admin-gateways.ts`,
`apps/admin/app/[lang]/(admin)/revenue/gateways/*`,
`backend/src/__tests__/gateway-adapters.test.ts`, `backend/src/__tests__/platform-gateways.test.ts`.

### M — Monitoring and the wall (M-1 … M-7)

| Slice | What landed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-1   | Instance sample extended with event-loop lag, heap, sockets, in-flight requests, open sync sockets; one row per instance per minute in `instance_metrics_minute` so the panel works without Redis                                                                                                                                                                                                                                                                                                                               |
| M-2   | `onResponse` aggregation keyed by **route template** + method + status class; count, bytes, fixed latency buckets; one batched insert per minute into `request_metrics_minute`; top routes by time / bytes / errors; no query strings, no workspace ids                                                                                                                                                                                                                                                                         |
| M-3   | `admin_db_vitals()` (SECURITY DEFINER, service-role only): size, connections vs max, cache hit, deadlocks, temp bytes, waiting locks, longest transaction, replication lag (`null` without a replica), top statements (`null` + reason when `pg_stat_statements` is absent). No external limit adapter is wired in this pass — a limit that is not stored is `null` and the gauge shows the value only, never a guessed ceiling. Bandwidth is `null` when any row in the window lacked a content-length, and the screen says so |
| M-4   | `active_users_minute` / `active_workspaces_minute` with a unique `(minute, hash)` and distinct counting across instances; 1-day retention; never a name or email                                                                                                                                                                                                                                                                                                                                                                |
| M-5   | `metric_alert_rules` evaluated each minute by the job runtime; breach → admin notification + outbox email, deduplicated per rule per hour; owner-set thresholds                                                                                                                                                                                                                                                                                                                                                                 |
| M-6   | `operations?tab=monitor&display=wall`: full-screen auto-refresh from one SSE sampler for all viewers; hashed expiring wall token, `monitor.read` only, optional IP binding, revocable, viewer cap                                                                                                                                                                                                                                                                                                                               |
| M-7   | History charts for 1h / 24h / 7d / 90d from minute + hourly rollups; rollup and prune jobs are idempotent per slot                                                                                                                                                                                                                                                                                                                                                                                                              |

Evidence: `docs/admin-monitoring-01-migration.sql`, `backend/src/services/monitoring/`,
`backend/src/routes/admin-monitor.routes.ts`, `apps/admin/app/[lang]/(admin)/operations/monitor/*`,
`apps/admin/app/[lang]/wall/*`, `apps/admin/hooks/use-admin-monitor.ts`,
`backend/src/__tests__/monitoring-route-metrics.test.ts`, `backend/src/__tests__/monitoring-wall.test.ts`.

### A — AI administration (Product › `ai`, six sections)

`provider · fallback · usage · budgets · prompts · audit` behind one `SegmentedControl`.

- Token and cost columns are **nullable**; `null` means «the provider did not report it» and the
  screen shows «—», never zero.
- Prices are entered by the owner per model and currency; cost is `tokens × micros_per_million /
1_000_000` in integers; a model without a price row yields `cost_micros = NULL` and counts in
  `unpriced_queries`.
- Fallbacks are tried **only** on a provider fault (timeout, 429, 5xx), never on a refusal; the
  admin "test" button calls `attempt()` so it tests the typed configuration, not the chain.
- Prompt versions are append-only, written by a trigger on the existing settings row, so the app
  keeps exactly one write path; «Use» only prefills the form.
- Audit shows configuration and key events; question and answer text is not shown.

Evidence: `docs/ai-usage-01-migration.sql`, `backend/src/services/admin/admin-ai.service.ts`,
`backend/src/routes/admin-ai.routes.ts`, `backend/src/__tests__/ai-admin.test.ts`,
`apps/admin/hooks/use-admin-ai-admin.ts`, `apps/admin/app/[lang]/(admin)/ai/ai-client.tsx`.

### R — Remaining requirements

Built on the same infrastructure, each as a tab or a section of an existing hub (no ninth hub).
Items that already existed were verified and not rebuilt. The full per-requirement classification,
including the rejected ones and their reasons, is in `docs/architecture/admin/V63-PREFLIGHT.md` §2.
What is **not** built yet is listed in §5 below.

## 2. Tabs after this slice set

| Hub        | Tabs                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| dashboard  | overview · revenue · alerts                                            |
| customers  | workspaces · users · devices · support · trial_abuse                   |
| revenue    | plans · subscriptions · ledger · maker_checker · wallet · **gateways** |
| offline    | licences · devices · log · bans · reviews                              |
| product    | features · ai (6 sections) · oauth · market                            |
| operations | health · **monitor** · servers · jobs · announcements                  |
| content    | blog                                                                   |
| security   | audit · roles · sessions · events · **network** · **posture**          |

Eight hubs before, eight after. `hubs-and-redirects.test.ts` still passes unchanged.

## 3. Migrations (files only — nothing was executed)

Run in this order, then run the matching `VERIFY-*.sql`:

| #   | Migration                                      | Adds                                                                                             |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | `docs/admin-secrets-01-migration.sql`          | `platform_secrets` + Vault set/get/stage/promote/discard/list functions                          |
| 2   | `docs/admin-action-types-02-migration.sql`     | the new maker-checker action types                                                               |
| 3   | `docs/admin-ip-allowlist-01-migration.sql`     | `admin_ip_allowlist`                                                                             |
| 4   | `docs/admin-monitoring-01-migration.sql`       | metrics/alert/wall-token tables, `admin_db_vitals`, rollup + prune + overview + series functions |
| 5   | `docs/admin-payment-gateways-01-migration.sql` | `platform_payment_gateways`                                                                      |
| 6   | `docs/ai-usage-01-migration.sql`               | token/cost columns, fallbacks, prices, budgets, prompt versions, summary function                |

Each has a `*.pg.test.ts` that runs the file on a real Postgres (twice) and asserts the writes it
must refuse and the ones it must allow. **Post-migration verification query generated — PENDING
HUMAN CONFIRMATION.**

## 4. Verification — measured on this machine (12 Nov 2026)

| Gate                             | Command                                                                                                                                                                                                          | Result                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| backend types                    | `cd backend && npx tsc --noEmit`                                                                                                                                                                                 | 0 errors                                                            |
| backend tests (A slice + guards) | `npx vitest run src/__tests__/{ai-admin,concurrency-safety-map,admin-route-chain,vertical-slice-integration,ai-provider-boundary,no-service-import-cycles,constitution-guards,monitoring-route-metrics}.test.ts` | 8 files / 251 tests passed                                          |
| backend lint                     | `npx eslint <V63 admin/monitoring/gateway/secret files>`                                                                                                                                                         | 0 errors                                                            |
| admin tests                      | `cd apps/admin && npm test`                                                                                                                                                                                      | 4 files / 34 tests passed                                           |
| admin types                      | `cd apps/admin && npx tsc --noEmit`                                                                                                                                                                              | 0 errors                                                            |
| admin lint                       | `npx eslint <changed admin files>`                                                                                                                                                                               | 0 errors                                                            |
| pg tests                         | `npx vitest run **/*.pg.test.ts`                                                                                                                                                                                 | **not run** — `initdb.exe` is missing; `PENDING HUMAN CONFIRMATION` |
| `next build`                     | —                                                                                                                                                                                                                | not run (forbidden for this mission)                                |

## 5. Not done / out of scope

- **Nothing was executed against a live database or a live admin session.** Every screen is
  type-checked and guard-tested, not opened.
- PayPal order creation and webhook verification are coded against recorded fixtures and return
  `BLOCKED_EXTERNAL_CREDENTIAL` until real credentials exist. No local Afghan gateway brand is
  named or claimed.
- The 113-item list was never pasted literally into the brief; `V63-PREFLIGHT.md` §2 explains that
  and classifies the requirements that were named instead of inventing numbered rows.
- Prometheus / Grafana / TimescaleDB / BullMQ dashboards, a vulnerability scanner, an env editor, a
  migration runner and an admin i18n editor were rejected on purpose; the reasons are in the
  preflight.
- The admin digest email, TLS/domain expiry job and API-key usage view (R items) are specified but
  not built in this pass; they need the monitoring tables to exist first.

## 6. Owner actions

1. Run the six migrations in §3 in order, then each `VERIFY-*.sql`, and keep the results.
2. Enable `pg_stat_statements` if the top-statements panel should show anything.
3. After deploying the backend, put the Stripe, PayPal and AI keys into Vault through the admin
   (write-only fields) and remove them from env. Rotate anything that sat in env.
4. Add Render, Supabase Management and Cloudflare tokens only if those limits should be shown;
   otherwise the gauges stay `NOT_CONFIGURED`.
5. Enrol MFA for every admin, then check `security?tab=posture` — unknown never counts as pass.
6. Create a wall token for the TV (`operations?tab=monitor` → wall tokens) and open the wall URL
   once on the device; it exchanges the token for an httpOnly cookie.
7. Set alert thresholds (defaults are CPU/RAM 85 %, event-loop p99 200 ms, 5xx 2 %, lag 30 s).
8. Confirm which local Afghan gateway should be integrated before `local.adapter.ts` gets a name.

## 7. Residual risks

The list lives in `docs/architecture/admin/THREAT-MODEL.md` §4: no WAF in code, TOTP only (no
WebAuthn), per-process limits without Redis, no SOC 2 evidence, no automated scanning, break-glass
is a mailbox, and a solo owner cannot complete maker-checker alone.

---

## 8. Audit of this slice set (12 Nov 2026) — what was claimed, what the code did

> **خلاصه برای مالک.** چهار ادعای این سند در کد نبود و اصلاح شد یا ادعا پس گرفته شد. مهم‌تر از همه:
> **هیچ راهی برای واردکردن کلید درگاه یا نشانی پی‌پال وجود نداشت** — پنل به تب «Security → Secrets»
> ارجاع می‌داد که وجود نداشت، پس هیچ درگاهی هرگز فعال نمی‌شد. حالا فرم «تنظیم» روی هر درگاه هست.
> دیوار تلویزیون هم در مرورگر واقعی هیچ‌وقت کار نمی‌کرد (هدر توکن در CORS نبود). فهرست ۱۱۳ موردی شما
> حالا شماره‌به‌شماره با شاهد کد در `admin/V63-113-ITEMS.md` است: ۴۰ ساخته، ۱۹ ناقص، ۳۹ ساخته‌نشده،
> ۱۲ ردشده با دلیل، ۳ وابسته به بیرون.

| Claim in §1–§6                                                                      | What the code did                                                                                                                                                                                                                       | Now                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P-3 «per-kind form with write-only secrets», «secrets staged in Security → Secrets» | No form; no Security › Secrets tab; `GET/POST /api/admin/secrets` and `PUT /api/admin/gateways/:id/metadata` had **no caller**. Enable stayed disabled forever                                                                          | `revenue/gateways/gateway-config.tsx` + three hooks: public settings (PayPal address, bank details, publishable key) and write-only keys (staged, second-admin approval, `last4` only). Guard: `apps/admin/src/__tests__/gateway-config.test.ts` |
| Live PayPal = manual flow (pay into the PayPal address)                             | It still counted the three PayPal **API** secrets it never uses — the address-only flow the owner asked for could never be enabled                                                                                                      | `missingFor(row)`: a manual flow needs its address, an API flow its keys (`platform-gateways.service.ts`; test `gateway-config-audit.test.ts`)                                                                                                   |
| Public config refuses secrets                                                       | Exact names only — `stripe_secret_key` passed into a column every reader sees                                                                                                                                                           | Substring check, string values ≤ 2000, PayPal address validated                                                                                                                                                                                  |
| P-2/P-3 «7-day success rate», «replay button … with step-up»                        | Not in any route or screen                                                                                                                                                                                                              | Claims withdrawn; listed ⛔ #10 and #12 in the 113 table                                                                                                                                                                                         |
| M-6 wall: «exchanges the token for an httpOnly cookie», SSE                         | Client polled with `x-wall-token`, which was **not in the CORS allow-list** — every wall request was blocked by the browser. Token stayed in the URL. Cookie/SSE routes had no caller and ran a process timer (job-authority guard red) | Header allowed (`index.ts`), CORS guard now scans `apps/admin`; the wall strips `?token=` at once; four dead routes removed; one shared 10-second snapshot for all viewers; Zod errors → 400                                                     |
| Verification table: «8 files / 251 tests passed»                                    | The full backend suite had 24 failures in `ai-pipeline-routes.test.ts` (the fake settings lacked the new `getFallbacks`) and `apps/admin` did not type-check (`seriesPoints` undefined in the monitor panel)                            | Both fixed; see the final verification in the V61/V63 report                                                                                                                                                                                     |

**Owner action 6 corrected:** create a wall token, open `…/wall?token=<value>` once on the TV — the page
keeps it in memory and removes it from the address bar; there is no cookie.
