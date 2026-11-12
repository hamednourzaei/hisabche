# HISABCHE V63 — ADMIN CONSOLE COMPLETION (`apps/admin`)

_Payment gateways · live monitoring wall · complete AI administration · zero-leak security · 100+ requirements_
_A teacher's brief. Read all of it before you change a file._

> **خلاصه برای مالک (fa):** پنل ادمین از قبل ۸ هاب، RBAC، MFA، step-up، maker-checker و لاگ
> تغییرناپذیر دارد. ولی این‌ها کم یا ناقص است:
>
> - **درگاه پرداخت:** فقط Stripe با کلیدی در env؛ هیچ تبی برای پی‌پال یا کد درگاه نیست.
> - **مانیتورینگ:** فقط CPU و RAM هر سرور؛ نه دیتابیس، نه کاربران آنلاین، نه پهنای باند و نشانی‌ها،
>   نه سقف‌ها و نه صفحه‌ی تلویزیونی.
> - **هوش مصنوعی:** کلید به‌صورت متن ساده ذخیره می‌شود؛ مصرف و هزینه‌ای ثبت نمی‌شود.
> - **امنیت:** چند مسیر حساس (کلید AI، تعداد سرور، بلاگ، مارکت، OAuth) **بدون MFA و بدون مجوز
>   ریز** هستند.
>
> V63 اول این نشتی‌ها را می‌بندد و بعد بقیه را روی همان زیرساخت می‌سازد.

---

## 0. Rules (unchanged)

- `AGENTS.md` is canonical. Also read `CLAUDE.md`, `.claude/skills/hisabche-session-rules/SKILL.md`,
  `hisabche-auth`, `hisabche-ux-consolidation`, `hisabche-scripted-edits` and `hisabche-migrations`.
- Never commit, push, stash, reset, rebase, `checkout --` or clean. No live SQL. No `.env`. No subagents.
- No `any`, `@ts-ignore` or `eslint-disable`. Every key in fa/af/en (`admin.*`; Dari per `.claude/DARI-GLOSSARY.md`).
- Migrations only as `docs/*-migration.sql` + `VERIFY-*.sql` + `*.pg.test.ts`, with RLS + REVOKE + an explicit
  GRANT on every new table, and `PENDING HUMAN CONFIRMATION`.
- **No new infrastructure or dependency**: no Prometheus, Grafana, TimescaleDB, BullMQ or Redis-as-truth. The
  data lives in Postgres aggregates. Anything external (Render API, Cloudflare API, Supabase Management API,
  PayPal) is an **adapter** that reports `NOT_CONFIGURED` until the owner adds a credential.
- The 8-hub contract (`apps/admin/components/admin-shell/admin-nav.ts`, guard
  `apps/admin/src/__tests__/hubs-and-redirects.test.ts`) **stays**. New things are **tabs or sections** of the
  existing hubs. A ninth hub needs the owner.
- **Execution model:** implement every slice and write every test; run verification **once**, at the end (§9).

---

## 1. What exists today (verified at the local tree; re-verify)

### 1.1 The admin app

- `apps/admin` is a Next.js app (port 3040). About 16k lines in `app/`, `components/`, `hooks/`, `lib/`.
- **Hubs and their tabs today:**

| Hub        | `*_TABS` today                                                               |
| ---------- | ---------------------------------------------------------------------------- |
| dashboard  | overview · revenue · alerts                                                  |
| customers  | workspaces · users · devices · support · trial_abuse                         |
| revenue    | plans · subscriptions · ledger · maker_checker · wallet                      |
| offline    | licences · devices · log · bans · reviews (from `offline-client.tsx` tables) |
| product    | features · ai · oauth · market                                               |
| operations | health · servers · jobs · announcements                                      |
| content    | blog (CMS has its own pages under `cms/`)                                    |
| security   | audit · roles · sessions · events                                            |

- **Auth:** the Supabase session (`lib/admin-api-token.ts`), the email allow-list (`ADMIN_ALLOWED_EMAILS`,
  `backend/src/middleware/platform-admin.middleware.ts`), admin RBAC (`backend/src/services/admin/admin-rbac.domain.ts`
  `ADMIN_PERMISSIONS`), AAL2 MFA inside `requireAdminPermission`, a 5-minute TOTP step-up (`requireAdminStepUp`
  - `components/admin-shell/step-up-dialog.tsx`), the immutable `audit_logs`, and maker-checker for billing
    actions (`docs/admin-04-billing-migration.sql`, `/api/admin/billing/action-requests`).
- **Headers** (`apps/admin/next.config.js`): `X-Robots-Tag`, `nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`. **No CSP, no HSTS, no Permissions-Policy.**

### 1.2 Backend admin surface

| Routes file                                                                               | What                                                                                         | Guard chain today                                                                                                       |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `admin.routes.ts`                                                                         | metrics, users, workspaces, members, subscriptions (plan/status), webhook-events, audit-logs | allow-list + RBAC (+AAL2); **0 step-ups**, even on subscription plan/status changes and member removal                  |
| `admin-billing.routes.ts`                                                                 | prices, ledger, action-requests (maker-checker), dunning                                     | allow-list + RBAC + step-up on writes                                                                                   |
| `admin-customers.routes.ts`                                                               | 360, user actions, support sessions, notes, data requests, trial abuse                       | allow-list + RBAC + step-up                                                                                             |
| `admin-offline.routes.ts`                                                                 | licences, devices, logs, bans, reviews, fleet health                                         | allow-list + RBAC + step-up                                                                                             |
| `admin-ops.routes.ts`                                                                     | flags, health, jobs, announcements, the CSV export (allow-listed tables — good)              | allow-list + RBAC + step-up                                                                                             |
| `admin-security.routes.ts`                                                                | roles, accounts, sessions, security events, step-up                                          | allow-list + RBAC + step-up                                                                                             |
| **`ai-chat.routes.ts`** (`/api/ai/config` GET/PUT, `/config/test`, `/quota/:ws`)          | changes the AI provider key that **bills the owner**                                         | **allow-list only: no RBAC, no AAL2, no step-up**, although `product.ai.read` / `product.ai.quota` exist and are unused |
| **`system-metrics.routes.ts`** (`/api/admin/instances`, `PUT /api/admin/instances/scale`) | adds or removes paid servers                                                                 | **allow-list only**                                                                                                     |
| **`blog.routes.ts`, `market.routes.ts`, `oauth.routes.ts`** (admin parts)                 | publish content, approve market/OAuth apps                                                   | **allow-list only** (CMS uses RBAC; blog does not)                                                                      |

### 1.3 Monitoring today

- Per instance: container CPU% / RAM% from cgroups (`backend/src/utils/system-metrics.ts`), heartbeats in Redis
  (`services/instance-registry.ts`, observation only), the public `/api/system/metrics(/stream)`, and the
  `/api/admin/instances` list + scale.
- **Nothing** for: database vitals, connections, limits, live users, requests/bytes/latency per route, top
  URLs, error rates, AI usage and cost, history, alerts, or a wall display.

### 1.4 Payments today

- Stripe only (`services/billing.service.ts`, `checkout.service.ts`, `routes/payment-webhook.routes.ts` with
  `process.env.STRIPE_WEBHOOK_SECRET`), plus "manual" in billing.
- **No PayPal, no gateway configuration UI, and secrets in env.** That contradicts the owner's rule
  ("everything in the DB; the backend is a stateless step").

### 1.5 AI today

- `ai_provider_settings` (one row: provider, base_url, model, **api_key stored as plain text**,
  system_prompt, topup_contact, is_enabled). It has RLS with no policy (good) and is never returned to clients
  (good).
- `ai_query_log` has `model_provider`, `model_name`, `latency_ms`, but **no token or cost columns**, so spend
  cannot be computed.
- There is a quota per workspace. The AI pipeline (`ai_action_requests`) has its own approval.

### 1.6 Security risks found (fix these FIRST)

| #   | Risk                                                                                                                                                            | Evidence                                | Fix (§3)                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------- |
| S1  | Sensitive admin routes without RBAC/AAL2/step-up                                                                                                                | §1.2 bold rows                          | S-1                             |
| S2  | MFA is skipped when `NODE_ENV === 'test'`, in both `mfa.middleware.ts` and `admin-rbac.middleware.ts`. A misconfigured production would silently drop admin MFA | `refuseWithoutAal2`, `requireStepUpMfa` | S-2                             |
| S3  | `requireStepUpMfa` reads claims by base64-decoding the JWT itself; safe only because `authenticate` verified the same token earlier                             | `mfa.middleware.ts`                     | S-2 (use `verifiedTokenClaims`) |
| S4  | The AI key in plain text; the Stripe secret in env                                                                                                              | §1.4, §1.5                              | S-3                             |
| S5  | The admin app has no CSP / HSTS / Permissions-Policy, while the admin renders rich HTML (TipTap blog/CMS)                                                       | `next.config.js`                        | S-4                             |
| S6  | Subscription plan/status changes and member removal have no step-up                                                                                             | `admin.routes.ts`                       | S-1                             |
| S7  | No guard ensures that **every** admin-only route has the full chain; a new route can regress silently                                                           | —                                       | S-1 guard                       |

**"100% security" is not a real claim.** Teach yourself the honest version:

- write a **threat model** (STRIDE);
- give every control a **test**;
- give every route a **guard**;
- define a residual-risk list.
  Reading: OWASP ASVS 4.0 — https://owasp.org/www-project-application-security-verification-standard/ ;
  OWASP Top 10 — https://owasp.org/www-project-top-ten/ ; STRIDE — https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats

---

## 2. The pasted 113-item list, judged against the code

Mark each item in the preflight: **EXISTS (file) · BUILD (slice) · EXTEND (file) · REJECT (reason) ·
BLOCKED_EXTERNAL**.

The teacher's rulings on the ones that must not be built as written:

- **#66 "Environment variables management UI": REJECT.** Showing or editing env from a web page is a leak
  vector. Instead: move every secret the product needs at runtime into **Supabase Vault**, administered as
  write-only secrets (S-3). Env keeps only bootstrap values (DB URL, the service key).
- **#69 "Database migration runner from the UI": REJECT.** A hard rule: humans run DDL in the SQL Editor. The
  admin may **list** migrations with their VERIFY status (read-only) — that is a BUILD.
- **#14/#15/#20/#24 "Prometheus, BullMQ stats, Nginx logs, TimescaleDB": REJECT the tools, BUILD the
  metrics:**
  - the per-route aggregates in Postgres (M-2);
  - the job runtime is `distributed-work.ts` (Postgres claims), so read its tables, not BullMQ;
  - the history = minute rollups → hourly, in Postgres.
- **#57/#64/#65 "Vulnerability scanner, security training, SOC2 badges": REJECT** as UI theater (G1). Build
  a security **checklist computed from facts** (S-6) instead.
- **#90 "User impersonation": EXTEND** the existing support sessions (`/api/admin/workspaces/:id/support-sessions`);
  never a login-as-user token.
- **#95/#103 "AI churn prediction / revenue forecasting": EXTEND** with the existing forecast domain
  (`services/intelligence/forecast.domain.ts`) for platform revenue, labelled as a forecast with an
  `insufficient_data` state. No invented "AI".
- **#83 "Edit translations in the admin": REJECT** for now (translations live in the repo and are guarded by
  tests).

---

## 3. Slice S — Security first (do this before any feature)

### S-1 One guard chain for every admin route

- Define `adminRoute(permission, { stepUp?: boolean })` in `backend/src/middleware/admin-rbac.middleware.ts`,
  returning `[authenticate, platformAdminGuard, requireAdminPermission(permission), ...(stepUp ? [requireAdminStepUp] : [])]`.
- Migrate **every** admin-only route to it:
  - `ai-chat.routes.ts`: `product.ai.read` for GET; `product.ai.write` [NEW permission] + stepUp for the config
    PUT and the test; `product.ai.quota` + stepUp for the quota;
  - `system-metrics.routes.ts`: `operations.servers.read`; `operations.servers.scale` [NEW] + stepUp;
  - `blog.routes.ts`: `content.blog.*`;
  - `market.routes.ts`, `oauth.routes.ts`: `product.market.*`, `product.oauth.*`;
  - `admin.routes.ts`: step-up on the subscription plan/status changes, the membership delete, and user
    actions.
- **Maker-checker** (reuse the billing action-requests table and flow; generalize it to an `admin_action_requests`
  domain only if the existing table cannot carry `action_type`) for:
  - changing a payment gateway secret;
  - changing the AI key;
  - scaling **up**;
  - granting an admin role;
  - bulk exports.
- New permissions go into `ADMIN_PERMISSIONS`, plus their role mapping and labels in fa/af/en.
- **The guard** `backend/src/__tests__/admin-route-chain.test.ts` must:
  - build the server;
  - enumerate every registered route whose path starts with `/api/admin/` **or** that uses
    `platformAdminGuard`;
  - assert the chain includes `requireAdminPermission`;
  - assert that every non-GET route on a list of sensitive patterns includes `requireAdminStepUp`;
  - be injection-tested (remove one, see red).

### S-2 No test bypass in production; one way to read claims

- Replace `process.env.NODE_ENV === 'test'` in `admin-rbac.middleware.ts` and `mfa.middleware.ts` with one
  helper, `isTestRuntime()` (`backend/src/runtime/test-runtime.ts` [NEW]). It is true only when `VITEST` is
  set **and** the server was built by `buildServer({ testRuntime: true })`.
- At startup in production (`render`, or `NODE_ENV=production`), the server **refuses to start** if test
  markers are present.
- `requireStepUpMfa` uses `verifiedTokenClaims` (the same function admin-rbac uses), never its own JWT decode.
- **Tests:** a production boot with `NODE_ENV=test` refuses to start; MFA is enforced when the test runtime is
  off.

### S-3 Secrets in Vault (write-only)

- **The infrastructure:** Supabase Vault (`vault.create_secret`, `vault.update_secret`,
  `vault.decrypted_secrets`). Read https://supabase.com/docs/guides/database/vault .
- A migration `admin-secrets-01`:
  - `platform_secrets` (name, purpose, `vault_secret_id`, `last4`, `rotated_at`, `rotated_by`) with RLS and no
    policy;
  - SECURITY DEFINER functions `platform_secret_set(name, value)` and `platform_secret_get(name)`;
  - `get` executable **only by service_role** (REVOKE from everyone else);
  - `set` writes an `audit_logs` row.
- The backend reads secrets through `services/secrets/secret-store.ts` [NEW], with a 5-minute in-memory
  cache. **The value is never sent to any client.** The admin UI shows only `last4` + `rotated_at`.
- **Move into Vault:** the AI api_key (with a migration that copies the plain-text value once, then NULLs the
  column — the human runs it), Stripe secret + webhook secret (env fallback during transition, logged as
  `SECRET_FROM_ENV`), and PayPal/gateway credentials (P-1).
- **Tests:**
  - GET never returns the value (assert on every admin route response);
  - set writes an audit row;
  - rotation invalidates the cache;
  - the pg test: an anon/authenticated client cannot call `platform_secret_get`.

### S-4 Admin app headers + content safety

- `apps/admin/next.config.js`:
  - a strict CSP with a nonce via Next middleware (`proxy.ts`): `default-src 'self'`, `script-src 'self' 'nonce-…'`,
    `connect-src` = the API + Supabase origins, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`;
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`;
  - `Permissions-Policy` (camera, mic, geolocation off);
  - `Cross-Origin-Opener-Policy: same-origin`.
  - Read: https://nextjs.org/docs/app/guides/content-security-policy
- Blog/CMS HTML is sanitized on the **server** before storing (`sanitize-html` is already a backend
  dependency; verify the allowlist).
- **A test** asserts that the headers are present (it reads the config).

### S-5 Sessions, brute force, optional IP allow-list

- An admin idle timeout (setting, default 30 min) + absolute timeout (default 12 h), enforced on the backend
  from the token `iat` and the last admin activity. "Revoke session" exists: verify that it revokes the refresh
  token.
- A rate limit on every `/api/admin/*` route (per admin + IP; the store is Redis when present, memory
  otherwise; a limiter error answers 429, never 500 — BUG-119).
- An **optional** IP allow-list (`admin_ip_allowlist` table, default empty = off).
  - **Break-glass:** the owner email can always reach `/api/admin/security/*` to fix the list after a
    step-up, so nobody gets locked out.
  - Every refusal is logged as a security event.
- **Tests:** a limiter 429; the allow-list refusal; break-glass works; the idle timeout.

### S-6 A security posture page computed from facts (not badges)

`security?tab=posture` [NEW tab]. Each check reads the real state:

- MFA enrolment per admin;
- admins with step-up in the last 30 days;
- secrets still in env (`SECRET_FROM_ENV` hits);
- routes failing the S-1 guard (0 expected; computed at build into a JSON);
- the CSP present;
- the backup-restore test age (V61 B.2.24);
- open maker-checker requests;
- the IP allow-list state.

Each check shows **pass / fail / unknown + evidence**. Unknown never counts as pass.

### S-7 The threat model document

`docs/architecture/admin/THREAT-MODEL.md`: STRIDE per asset, for:

- the admin session;
- secrets;
- payment configuration;
- the AI key;
- server scaling;
- customer data export;
- content publishing.

Give each asset its controls (S-1..S-6) and the residual risk. Persian summary on top.

---

## 4. Slice P — Payment gateways (Revenue › `gateways` tab)

### P-1 The model

- Migration `payment-gateways-01`: `payment_gateways` table with:
  - `id`, `kind`;
  - `kind`: `stripe | paypal_api | paypal_manual | bank_manual | local_adapter`;
  - `display_name_key`, `is_enabled`, `mode` (`test|live`);
  - `public_config jsonb` (a PayPal email / PayPal.me link, bank account text, supported currencies) — this
    is **safe** to show to paying customers;
  - `secret_names text[]` (references into `platform_secrets`), `updated_at`, `updated_by`.
- One row per configured gateway. Enabling a **live** gateway, or changing any secret, goes through
  maker-checker (S-1).

### P-2 The adapter interface (`backend/src/services/payments-gateway/`) [NEW]

- `gateway.port.ts`: `createCheckout`, `verifyWebhook(rawBody, headers)`, `parseEvent`, `refund?`,
  `testConnection`.
- Adapters:
  - `stripe.adapter.ts` — move the existing Stripe code behind the port; no behaviour change, and the existing
    tests stay green;
  - `paypal.adapter.ts` — the Orders v2 API + webhook signature verification via PayPal's
    verify-webhook-signature endpoint. Read https://developer.paypal.com/docs/api/orders/v2/ and
    https://developer.paypal.com/api/rest/webhooks/ . Status `BLOCKED_EXTERNAL_CREDENTIAL` until the owner
    adds credentials; the code and the tests use recorded fixtures;
  - `manual.adapter.ts` (PayPal address / bank) — the customer sees the address and submits a payment
    reference; an admin confirms it via maker-checker; the confirmation credits the subscription through the
    **existing billing ledger** (never a second ledger);
  - `local.adapter.ts` — the neutral interface only. **No brand is named or claimed** until it is tested with
    real credentials (the same rule as attendance devices). HesabPay and others are `NEEDS_OWNER_DECISION`.
- **Webhooks:**
  - one route per kind (`/api/webhooks/<kind>`), raw body, signature check, replay window;
  - idempotency key `gw-<kind>-<eventId>`;
  - stored in the existing `webhook-events` log (`/api/admin/webhook-events`, already in the admin). A replay
    button re-processes idempotently (step-up).

### P-3 The admin UI

The `gateways` tab:

- a list (DataTable): kind, mode, enabled, last webhook, success rate 7d;
- a form per kind: public fields editable; secret fields **write-only** (shows `•••• last4` + "replace");
- a "Test connection" button (calls `testConnection`, shows the result);
- the webhook URL to copy (`copyText()`);
- a live/test badge.

The `payments` sub-view of `ledger`: success/failure rates, failure reasons, refunds — from the billing ledger

- webhook events.

**Tests:**

- adapter units with fixtures (Stripe unchanged; PayPal verify ok/fail; manual confirm credits once);
- HTTP: a secret never appears in any response;
- an invalid signature → 400 + a security event;
- a replay → no double credit;
- maker-checker is required for live enable.

---

## 5. Slice M — Monitoring and the TV wall (Operations › `monitor` tab, `?display=wall`)

**The principle:** **cheap to collect, aggregated at the source, stored as small rollups.** The monitor must
never become the load it measures.

### M-1 Instance metrics (extend what exists)

- `system-metrics.ts` already samples the container CPU and RAM. Add: event-loop lag
  (`perf_hooks.monitorEventLoopDelay`), heap used/limit, open sockets, in-flight requests, and **open sync
  WebSockets** (the count from `sync-stream.ts` watches).
- Heartbeats: keep Redis when present. **Also** write one row per instance per minute into
  `instance_metrics_minute` (Postgres, see M-3), so the panel works without Redis.

### M-2 Per-route traffic (bandwidth, top URLs, errors, latency)

- A Fastify `onResponse` hook: key = **route template** (`request.routeOptions.url`, never the raw URL: no IDs,
  no PII) + method + status class; values = count, bytes out (`content-length` or the stream byte counter), and
  latency in fixed histogram buckets.
- Accumulate in memory per instance; flush **once per minute** as one batched insert into
  `request_metrics_minute`.
- "Which invoices/URLs occupy resources" = the top route templates by total latency, by bytes and by error
  count. Plus the DB top statements (M-3).
- Keep personal data out of metrics: workspace ids are hashed or omitted; never a query string.

### M-3 Database vitals

- Migration `admin-monitoring-01`:
  - **tables:** `request_metrics_minute`, `instance_metrics_minute`, `request_metrics_hour` (the rollup) and
    `metric_alert_rules`, all with RLS and no policy (service role only);
  - **retention:** minute rows for 7 days, hourly rows for 90 days (a rollup + prune job in
    `distributed-work.ts`, once per slot);
  - **`admin_db_vitals()`** (SECURITY DEFINER, `service_role` only, read-only), returning:
    - the database size (`pg_database_size`);
    - connections by state (`pg_stat_activity`) against `max_connections`;
    - the cache hit ratio (`pg_stat_database`);
    - deadlocks and temp bytes;
    - waiting locks;
    - the longest transaction age;
    - replication lag (`pg_stat_replication` / `pg_last_xact_replay_timestamp`, null when there is no replica);
    - the top 10 statements by total time from `pg_stat_statements`. If the extension is not enabled, return
      `null` + a reason; never fail.
  - Read: https://www.postgresql.org/docs/current/monitoring-stats.html ,
    https://www.postgresql.org/docs/current/pgstatstatements.html ,
    https://supabase.com/docs/guides/database/extensions/pg_stat_statements
- **Plan limits:**
  - Render (instances, plan RAM/CPU): through the existing Render API integration used by `/admin/instances/scale`;
  - Supabase (DB size limit, max connections, egress): through the Supabase Management API **only if** the
    owner adds a token (`NOT_CONFIGURED` otherwise), or entered manually by the owner in a `platform_limits`
    setting (labelled "entered by owner");
  - Cloudflare bandwidth: the GraphQL Analytics API with a token, else `NOT_CONFIGURED`.
  - **Never show a guessed limit.** A gauge without a known limit shows the value only.

### M-4 Live users

- "Online now" = distinct authenticated users with a request in the last 5 minutes. Each instance keeps a
  per-minute set of user-id hashes and flushes the **count + a HyperLogLog-free exact set size**
  (small) per minute. Sum across instances **with dedupe**: store the minute's hashed ids in
  `active_users_minute (minute, user_hash)` with a unique constraint and 1-day retention, then count distinct.
- Also show open sync sockets (devices connected) and active workspaces (distinct workspace hashes).
- **Never** names or emails on the wall.

### M-5 Alerts

- `metric_alert_rules` (metric, comparator, threshold, duration, severity, channel) is evaluated each minute by
  the job runtime. Breach → an `admin` notification + email via the outbox, deduplicated per rule per hour.
- **Defaults** (owner-editable): CPU > 85% for 5 min; RAM > 85%; event-loop p99 > 200 ms; DB connections >
  80% of max; 5xx rate > 2%; replication lag > 30 s; disk > 80% of the known limit.

### M-6 The TV wall

- `operations?tab=monitor&display=wall`: a full-screen, auto-refreshing layout. It updates by SSE from a
  single admin stream (`/api/admin/monitor/stream`, one sampler for all viewers, like `system-metrics`). It
  shows:
  - online users;
  - instances with CPU/RAM/event-loop gauges against their limits;
  - DB size/connections/cache-hit/lag against their limits;
  - requests/min;
  - 5xx rate;
  - bandwidth/min;
  - the top 5 routes by time and by bytes;
  - the top 5 DB statements;
  - the active alerts.
- **A display token for a TV:** a TV cannot hold an admin session with MFA.
  - Create a **wall token**: a random secret, stored hashed, scope `monitor.read` only, an optional IP
    binding, an expiry, and revocable.
  - The wall URL carries it once and exchanges it for an httpOnly cookie.
  - It can read **only** the aggregated monitor stream: no customer data, no money, no names.
- **Tests:**
  - the wall token cannot reach any other admin route;
  - an expired or revoked token is refused;
  - the stream caps viewers (503 beyond the cap).

### M-7 History

`operations?tab=monitor` (normal mode) shows charts for 1h / 24h / 7d / 90d from the minute and hourly tables.
Reuse the existing chart components (`packages/ui` charts are lazy-loaded; keep them lazy).

**Monitoring tests:**

- the onResponse aggregation (template not raw URL; buckets);
- one flush per minute per instance;
- the rollup + prune job (idempotent per slot);
- `admin_db_vitals` returns null sections when an extension is missing;
- every limit is either sourced or `NOT_CONFIGURED`;
- no PII in any metric table (a schema guard).

---

## 6. Slice A — AI administration (Product › `ai`, with sections via one SegmentedControl)

Sections: **provider · keys · usage · policies · audit**.

- **provider:** the existing config, plus an **ordered fallback list** (primary, secondary) and a per-provider
  timeout. The `callProvider` path in `services/ai` uses the fallback **only** for transient errors (timeout,
  429, 5xx), never for refusals.
- **keys:** Vault secrets (S-3); write-only, `last4`, rotate (maker-checker + step-up); "Test" uses the stored
  key without returning it.
- **usage:**
  - migration `ai-usage-01` adds `input_tokens`, `output_tokens` and `cost_micro_usd` (nullable) to
    `ai_query_log`, filled from the provider response when present (`null` = unknown, never 0);
  - a `model_prices` table (price per 1M tokens, effective dates), **entered by the owner** (no invented
    prices);
  - charts: tokens and cost per day, per workspace, per feature, per model; the top workspaces;
  - a budget per workspace and a platform budget, with alerts (M-5).
- **policies:**
  - quotas per workspace (exist: `/api/ai/quota/:ws`);
  - a rate limit per user/workspace;
  - the feature toggles per workspace use the **existing feature registry / entitlement** (`ai.*` features),
    not a new toggle table;
  - the system-prompt versions: a `ai_prompt_versions` table (append-only; one active).
- **audit:**
  - the existing `ai_query_log`, with question/answer **redacted** in the admin view by default (show on
    explicit reveal, which is logged);
  - the AI pipeline approvals (`ai_action_requests`) as a read-only list.
- **Tests:**
  - the key is never returned;
  - fallback only on transient errors;
  - an unknown cost is null;
  - a budget alert fires once;
  - prompt versions are immutable;
  - reveal writes an audit row.

---

## 7. Slice R — The remaining requirements (built on the same infrastructure)

Each row is a section inside an existing hub. **EXISTS rows** are only verified and completed; never rebuilt.

| Area       | Item                                                          | Home                                                                                 | Build on                                                                                                                             |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Customers  | Workspace usage (storage, API calls, AI cost, users, devices) | customers › workspaces 360                                                           | `request_metrics_*` (hashed ws), `ai_query_log`, offline devices                                                                     |
| Customers  | Suspend/reactivate                                            | EXISTS? verify `/api/admin/users/:id/action` + workspace suspension (`suspended_at`) | —                                                                                                                                    |
| Customers  | Data export / deletion requests                               | EXISTS `/api/admin/data-requests`                                                    | —                                                                                                                                    |
| Customers  | Ownership transfer                                            | customers › 360                                                                      | maker-checker + `workspace_members`                                                                                                  |
| Customers  | Activity timeline per user                                    | customers › users                                                                    | `audit_logs` + `activities` (read)                                                                                                   |
| Customers  | Support sessions (instead of impersonation)                   | EXISTS support-sessions                                                              | extend with expiry + read-only scope                                                                                                 |
| Customers  | Broadcast message                                             | operations › announcements                                                           | EXISTS announcements; add audience filters                                                                                           |
| Customers  | Signup funnel and cohorts                                     | dashboard › overview                                                                 | workspace creation, onboarding progress (`ONBOARDING_STATES`), first invoice                                                         |
| Revenue    | MRR/ARR, churn, past-due                                      | dashboard › revenue                                                                  | EXISTS partly (`/subscriptions/past-due`); compute from the billing ledger                                                           |
| Revenue    | Refunds                                                       | revenue › ledger                                                                     | gateway `refund` + maker-checker                                                                                                     |
| Revenue    | Revenue forecast                                              | dashboard › revenue                                                                  | `forecast.domain.ts`, with `insufficient_data`                                                                                       |
| Operations | Job runtime health (claims, age, failures, retry)             | operations › jobs                                                                    | EXISTS list + retry; add age/failure-rate charts                                                                                     |
| Operations | Email delivery status                                         | operations › health                                                                  | email outbox table (sent/failed/bounced)                                                                                             |
| Operations | Feature flags                                                 | EXISTS `/api/admin/ops/flags`                                                        | add audit + step-up on change                                                                                                        |
| Operations | Maintenance / read-only mode                                  | operations › health                                                                  | V61 Part C `serviceMode` (one switch, step-up, audit)                                                                                |
| Operations | Migrations status (read-only)                                 | operations › health                                                                  | list `docs/*-migration.sql` (built into JSON at build time) + VERIFY results the owner pasted (stored manually) — **never runs SQL** |
| Operations | Cache: selective clear                                        | operations › health                                                                  | `invalidateMoneyCaches(ws)` / cache prefixes; step-up                                                                                |
| Operations | Release / version info                                        | operations › servers                                                                 | the commit SHA, the build time, `app_releases` (desktop)                                                                             |
| Security   | Admin accounts + roles + permission matrix                    | EXISTS roles/accounts; add a matrix view from `ADMIN_PERMISSIONS` × roles            | —                                                                                                                                    |
| Security   | Sessions + revoke                                             | EXISTS                                                                               | verify the refresh revoke                                                                                                            |
| Security   | Security events + failed logins                               | EXISTS events; add brute-force aggregation                                           | —                                                                                                                                    |
| Security   | Posture, threat model, IP allow-list                          | S-5, S-6, S-7                                                                        | —                                                                                                                                    |
| Security   | SSL/domain expiry                                             | security › posture                                                                   | a TLS check of the configured domains (daily job), `NOT_CONFIGURED` if no domains are set                                            |
| Developer  | API usage per key / per endpoint                              | product › oauth                                                                      | `request_metrics_minute` with the api-key id hash                                                                                    |
| Developer  | Rate-limit config per route                                   | product › oauth                                                                      | read-only view of the configured limits (a code change stays in code)                                                                |
| Developer  | API docs                                                      | EXISTS `@fastify/swagger-ui` — link it (admin-only exposure)                         | —                                                                                                                                    |
| Developer  | Webhook test send                                             | product › oauth                                                                      | the existing developer webhook delivery, with a test event                                                                           |
| Reports    | Export CSV of admin tables                                    | EXISTS export-csv (allow-list)                                                       | add tables only through the allow-list                                                                                               |
| Reports    | Scheduled admin digest email                                  | dashboard › alerts                                                                   | the job runtime + the outbox (one per admin per day)                                                                                 |
| Content    | Blog AI article, SEO panel                                    | EXISTS                                                                               | add S-1 permissions                                                                                                                  |

Write the full 113-item classification table in the preflight (§2). The final report must show each item's
outcome.

---

## 8. Files and folders

```
apps/admin/
  app/[lang]/(admin)/revenue/gateways/*        gateway list + forms (client components)
  app/[lang]/(admin)/operations/monitor/*      monitor tab + wall layout
  app/[lang]/(admin)/product/ai/*              ai sections
  app/[lang]/(admin)/security/posture/*        posture tab
  hooks/use-admin-gateways.ts · use-admin-monitor.ts · use-admin-ai-usage.ts · use-admin-posture.ts
  src/__tests__/admin-tabs.contract.test.ts    every *_TABS id has a label (fa/af/en) and a render
backend/src/
  middleware/admin-rbac.middleware.ts          adminRoute()
  runtime/test-runtime.ts                      isTestRuntime()
  services/secrets/secret-store.ts             Vault-backed, cached
  services/payments-gateway/{gateway.port,stripe.adapter,paypal.adapter,manual.adapter,local.adapter}.ts
  services/monitoring/{route-metrics,instance-metrics,db-vitals,live-users,alerts,rollup}.ts
  routes/admin-payments.routes.ts · admin-monitor.routes.ts (+ /stream) · webhooks per gateway
  __tests__/admin-route-chain.test.ts · secret-never-returned.test.ts · monitoring/*.test.ts · gateways/*.test.ts
docs/
  admin-secrets-01 · payment-gateways-01 · admin-monitoring-01 · ai-usage-01   (migration + VERIFY + pg test each)
  architecture/admin/{THREAT-MODEL.md, 00-OVERVIEW.md, ADR-*.md}
  runbooks/{rotate-a-secret.md, gateway-webhook-failing.md, wall-display-setup.md}
```

**Documentation:**

- MADR ADRs: "Vault for secrets", "Postgres rollups instead of a TSDB", "wall token", "one guard chain";
- a C4 diagram;
- runbooks written for 3 a.m.;
- a Persian summary on top of each overview.

---

## 9. Order of work and final verification

**Order:**

1. Phase 0 preflight (`docs/architecture/admin/V63-PREFLIGHT.md`: §1 re-verified, the 113-item table,
   S1–S7 evidence).
2. **S-1 → S-7** (security first).
3. P-1 → P-3.
4. M-1 → M-7.
5. A.
6. R.
7. Docs.

After each slice, update `docs/architecture/V63-IMPLEMENTATION-PROGRESS.md`.

**Final verification** (once; sequential; `TMP/TEMP=C:/Users/hamed/Desktop/hisabche/.esbuild-tmp`):

- `tsc --noEmit` in validation, api, ui, backend, apps/admin, apps/web;
- vitest in validation, api, ui and backend (`--exclude '**/*.pg.test.ts'`), plus the admin tests
  (`apps/admin`: `npm test` uses `../../packages/ui/node_modules/vitest`);
- ESLint on the changed files;
- **no `next build`**.

pg tests are `BLOCKED` on this machine (`initdb.exe` is missing). Never weaken a guard.

**Owner actions (list them; never perform them):**

- run the four migrations + VERIFY;
- enable `pg_stat_statements` if needed;
- put the Stripe, PayPal and AI keys into Vault through the admin (after deploy);
- add Render, Supabase-management and Cloudflare tokens if those limits should show;
- enrol MFA for every admin;
- create the wall token for the TV;
- set alert thresholds;
- confirm which local Afghan gateway to integrate.

**Persian final report:**

1. The security findings S1–S7, before/after.
2. The 113-item table with outcomes.
3. Tabs before/after per hub.
4. The migrations in run order (`PENDING HUMAN CONFIRMATION`).
5. The commands and real results.
6. The owner actions.
7. The residual risks from the threat model.

Allowed statuses: `VERIFIED_COMPLETE` · `IMPLEMENTED_NOT_LIVE_VERIFIED` · `VERIFIED_WITH_LIMITATIONS` ·
`BLOCKED` · `NOT_IMPLEMENTED`.
