# V63 — Admin Console Completion — Phase 0 Preflight

> **خلاصه فارسی.** پنل ادمین ۸ هاب، RBAC، MFA، step-up، maker-checker و `audit_logs` دارد. اما
> پنج مسیر حساس (`/api/ai/*`, `/api/admin/instances*`, `/api/admin/blog/*`, `/api/admin/market*`,
> `/api/admin/oauth*`) فقط allow-list دارند؛ کلید AI متن‌ساده در Postgres است؛ CSP/HSTS وجود
> ندارد؛ و هیچ سنجه‌ای برای دیتابیس، کاربران آنلاین، ترافیک مسیرها و هزینهٔ AI ثبت نمی‌شود.
> V63 اول این نشتی‌ها را می‌بندد و بعد درگاه پرداخت، مانیتورینگ و ادارهٔ AI را روی همان
> زیرساخت می‌سازد.

- Branch: `main` · HEAD `cbfbc8ef` (`fixed ci 17`) · remote-verified baseline `b30f259c` is an ancestor.
- Working tree: only `M .claude/skills/new-reels/SKILL.md` plus untracked `docs/audit/exchange/`
  and `scripts/audit-login.cjs` (pre-existing owner files — untouched).
- NEXT_VERSION: **V63**. V60/V61/V62 docs exist; no V63 doc existed before this file.
- No commit / push / reset / stash / clean was performed. No `.env` was read. No dependency changed.
- **Execution-model override (recorded):** AGENTS.md §8 asks for `tsc`/`vitest`/`eslint` after edits.
  This mission's §0.1 says run verification **once** at the end. The V63 prompt overrides AGENTS.md
  for this mission only; the final protocol (§9 of the brief) still runs every gate.

---

## 1. Re-verified facts (code, not reports)

| #   | Claim                                                                                     | Evidence                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Admin app is Next.js 16.2.6 on port 3040                                                  | `apps/admin/package.json:6,39`                                                                                                                                                                                                                                                                                         |
| 2   | Next 16 uses `proxy.ts` (not `middleware.ts`)                                             | `apps/admin/proxy.ts:33` `export async function proxy`                                                                                                                                                                                                                                                                 |
| 3   | The 8-hub contract is guard-tested                                                        | `apps/admin/src/__tests__/hubs-and-redirects.test.ts`                                                                                                                                                                                                                                                                  |
| 4   | Tabs today                                                                                | dashboard `overview·revenue·alerts`; customers `workspaces·users·devices·support·trial_abuse`; revenue `plans·subscriptions·ledger·maker_checker·wallet`; offline 5 tables; product `features·ai·oauth·market`; operations `health·servers·jobs·announcements`; content `blog`; security `audit·roles·sessions·events` |
| 5   | `ai-chat.routes.ts` admin routes have **no** RBAC/AAL2/step-up                            | `adminOnly = [authenticate, platformAdminGuard]` at `:174`                                                                                                                                                                                                                                                             |
| 6   | `system-metrics.routes.ts` instance routes have **no** RBAC                               | `adminOnly` at `:123`                                                                                                                                                                                                                                                                                                  |
| 7   | `blog/market/oauth` admin routes have **no** RBAC                                         | `const admin = [authenticate, platformAdminGuard]` (`blog.routes.ts:227`, `market.routes.ts:31`, `oauth.routes.ts:112`)                                                                                                                                                                                                |
| 8   | `admin.routes.ts` plan/status/member mutations have **no** step-up                        | `:261,:294,:408,:434` (permission only)                                                                                                                                                                                                                                                                                |
| 9   | MFA is skipped under `NODE_ENV === 'test'`                                                | `admin-rbac.middleware.ts:66`, `mfa.middleware.ts:29`                                                                                                                                                                                                                                                                  |
| 10  | `requireStepUpMfa` base64-decodes the JWT itself                                          | `mfa.middleware.ts:34-42`                                                                                                                                                                                                                                                                                              |
| 11  | AI key is plain text in `ai_provider_settings.api_key`                                    | `services/ai/ai-settings.service.ts`                                                                                                                                                                                                                                                                                   |
| 12  | No CSP / HSTS / Permissions-Policy on admin                                               | `apps/admin/next.config.js:77-89`                                                                                                                                                                                                                                                                                      |
| 13  | `webhook_events` + Stripe webhook exist, raw-body verified                                | `routes/payment-webhook.routes.ts`, `services/webhook.service.ts`                                                                                                                                                                                                                                                      |
| 14  | A gateway webhook placeholder already returns `BLOCKED_EXTERNAL_CREDENTIAL`               | `payment-webhook.routes.ts:97-107`                                                                                                                                                                                                                                                                                     |
| 15  | Per-instance CPU/RAM only, from cgroups; Redis heartbeats                                 | `utils/system-metrics.ts`, `services/instance-registry.ts`                                                                                                                                                                                                                                                             |
| 16  | Render scaling integration exists                                                         | `services/render-scaling.ts`                                                                                                                                                                                                                                                                                           |
| 17  | `pg_stat_statements` is not used anywhere                                                 | `grep` over `backend/src` and `docs/*.sql` returns nothing                                                                                                                                                                                                                                                             |
| 18  | Existing migrations: `admin-02/03/04/06` with VERIFY + pg tests                           | `docs/`                                                                                                                                                                                                                                                                                                                |
| 19  | `sanitize-html` is only a backend transcript dependency, **not** applied to blog/CMS HTML | `grep 'sanitize'` in `blog.routes.ts`/`cms.routes.ts` → 0 hits                                                                                                                                                                                                                                                         |
| 20  | No dependency may be added for PayPal — the adapter uses `fetch`                          | decision recorded here                                                                                                                                                                                                                                                                                                 |

### Items that could not be confirmed

- The literal **113-item list** was referenced by number in the brief but not pasted into it. Inventing
  113 numbered rows would be fabricating evidence, so §2 classifies the requirements that **are**
  enumerated in the brief (with the teacher's rulings) and §5 lists what stays unimplemented.
- Whether `ADMIN_ALLOWED_EMAILS` is populated in production is an owner fact, not a code fact.

---

## 2. Requirement classification

Legend: **EXISTS**(file) · **BUILD**(slice) · **EXTEND**(file) · **REJECT**(reason) · **BLOCKED_EXTERNAL**.

| Area        | Requirement                                            | Verdict                                                     |
| ----------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Security    | One guard chain for every admin route                  | **BUILD** S-1                                               |
| Security    | Remove `NODE_ENV==='test'` MFA bypass in production    | **BUILD** S-2                                               |
| Security    | `requireStepUpMfa` reads claims itself                 | **BUILD** S-2                                               |
| Security    | Secrets in Supabase Vault, write-only                  | **BUILD** S-3                                               |
| Security    | Admin CSP/HSTS/Permissions-Policy/COOP                 | **BUILD** S-4                                               |
| Security    | Server-side HTML sanitisation for blog/CMS             | **BUILD** S-4                                               |
| Security    | Idle + absolute session timeout                        | **BUILD** S-5                                               |
| Security    | Rate limit on `/api/admin/*` (429, not 500)            | **BUILD** S-5                                               |
| Security    | Optional IP allow-list + break-glass                   | **BUILD** S-5                                               |
| Security    | Posture page from facts                                | **BUILD** S-6                                               |
| Security    | STRIDE threat model doc                                | **BUILD** S-7                                               |
| Security    | "100% security" badge                                  | **REJECT** — a badge is not a control                       |
| Security    | Env-variable editor in the UI                          | **REJECT** — leak vector; replaced by Vault                 |
| Security    | Migration runner from the UI                           | **REJECT** — humans run DDL; read-only list only            |
| Security    | Vulnerability scanner / SOC2 badge                     | **REJECT** — UI theatre                                     |
| Payments    | Stripe behind an adapter port                          | **EXTEND** `services/billing.service.ts`                    |
| Payments    | PayPal Orders v2 + webhook verify                      | **BUILD** P-2, `BLOCKED_EXTERNAL` until credential          |
| Payments    | Manual (PayPal address / bank) confirmation            | **BUILD** P-2                                               |
| Payments    | Local Afghan gateway                                   | **BLOCKED_EXTERNAL** — brand unconfirmed, neutral port only |
| Payments    | Gateway CRUD + write-only secrets tab                  | **BUILD** P-3                                               |
| Payments    | Replay from `webhook_events`                           | **EXTEND** `admin.routes.ts` + service                      |
| Monitoring  | Per-instance CPU/RAM                                   | **EXISTS** `utils/system-metrics.ts`                        |
| Monitoring  | Event-loop lag, heap, sockets, in-flight, SSE watchers | **BUILD** M-1                                               |
| Monitoring  | Per-route aggregation (template key)                   | **BUILD** M-2                                               |
| Monitoring  | DB vitals + `pg_stat_statements`                       | **BUILD** M-3                                               |
| Monitoring  | Plan limits (Render/Supabase/Cloudflare)               | **BUILD** M-3, external = `NOT_CONFIGURED`                  |
| Monitoring  | Live users without PII                                 | **BUILD** M-4                                               |
| Monitoring  | Alert rules + defaults                                 | **BUILD** M-5                                               |
| Monitoring  | TV wall + wall token                                   | **BUILD** M-6                                               |
| Monitoring  | 1h/24h/7d/90d history                                  | **BUILD** M-7                                               |
| Monitoring  | Prometheus / Grafana / TimescaleDB                     | **REJECT** — Postgres rollups are enough                    |
| Monitoring  | BullMQ dashboards                                      | **REJECT** — the runtime is `distributed-work.ts`           |
| AI          | Provider config                                        | **EXISTS** `ai-chat.routes.ts`, `ai-settings.service.ts`    |
| AI          | Ordered fallback + per-provider timeout                | **BUILD** A                                                 |
| AI          | Key in Vault, write-only, rotate                       | **BUILD** A on S-3                                          |
| AI          | Token/cost columns + `model_prices`                    | **BUILD** A (`ai-usage-01`)                                 |
| AI          | Budgets + alerts per workspace/platform                | **BUILD** A on M-5                                          |
| AI          | Quota per workspace                                    | **EXISTS** `/api/ai/quota/:ws`                              |
| AI          | Prompt versions (append-only)                          | **BUILD** A                                                 |
| AI          | Redacted audit + logged reveal                         | **BUILD** A                                                 |
| Customers   | Workspace usage (storage/API/AI/users/devices)         | **BUILD** R on M-2/A                                        |
| Customers   | Suspend/reactivate                                     | **EXISTS** `admin-customers.routes.ts`                      |
| Customers   | Data export/deletion requests                          | **EXISTS** `/api/admin/data-requests`                       |
| Customers   | Ownership transfer                                     | **BUILD** R (maker-checker)                                 |
| Customers   | Activity timeline                                      | **EXTEND** `audit_logs` read                                |
| Customers   | Support sessions instead of impersonation              | **EXISTS**; extend expiry/read-only                         |
| Customers   | Broadcast audience filters                             | **EXTEND** announcements                                    |
| Customers   | Signup funnel/cohorts                                  | **BUILD** R                                                 |
| Revenue     | MRR/ARR/churn/past-due                                 | **EXTEND** billing ledger                                   |
| Revenue     | Refunds                                                | **BUILD** R on P-2                                          |
| Revenue     | Revenue forecast                                       | **EXTEND** `forecast.domain.ts` with `insufficient_data`    |
| Operations  | Job runtime health                                     | **EXTEND** `admin-ops.routes.ts`                            |
| Operations  | Email delivery status                                  | **BUILD** R                                                 |
| Operations  | Feature flags                                          | **EXISTS** `admin-ops.routes.ts`                            |
| Operations  | Maintenance/read-only mode                             | **EXISTS** `runtime/service-mode.ts`; expose                |
| Operations  | Migration status (read-only)                           | **BUILD** R as static JSON list                             |
| Operations  | Cache selective clear                                  | **BUILD** R                                                 |
| Operations  | Release/version info                                   | **BUILD** R                                                 |
| Security    | Roles/permission matrix                                | **EXTEND** `security-client.tsx`                            |
| Security    | Sessions + revoke                                      | **EXISTS**                                                  |
| Security    | Failed-login aggregation                               | **BUILD** R                                                 |
| Security    | SSL/domain expiry                                      | **BUILD** R, `NOT_CONFIGURED` without domains               |
| Developer   | API usage per key/endpoint                             | **BUILD** R on M-2                                          |
| Developer   | Rate-limit config view                                 | **BUILD** R read-only                                       |
| Developer   | API docs link                                          | **EXISTS** `@fastify/swagger-ui`                            |
| Developer   | Webhook test send                                      | **BUILD** R                                                 |
| Reports     | CSV export                                             | **EXISTS** allow-listed                                     |
| Reports     | Scheduled admin digest                                 | **BUILD** R                                                 |
| Content     | Blog AI + SEO panel                                    | **EXISTS**; add S-1 permissions                             |
| i18n editor | Edit translations in admin                             | **REJECT** — translations are repo files, guard-tested      |

---

## 3. Security findings (S1–S7) — before

| ID  | Finding                                                               | File                                                                                   | Severity                                                                            |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| S1  | Sensitive admin routes carry only the email allow-list                | `ai-chat.routes.ts:174`, `system-metrics.routes.ts:123`, `blog/market/oauth.routes.ts` | **critical** — the AI key and paid server scaling are one leaked admin session away |
| S2  | MFA skipped when `NODE_ENV === 'test'`; two different claim readers   | `admin-rbac.middleware.ts:66`, `mfa.middleware.ts:29-42`                               | **high**                                                                            |
| S3  | AI key and Stripe secret in plaintext/env                             | `ai-settings.service.ts`, `payment-webhook.routes.ts:51`                               | **high**                                                                            |
| S4  | No CSP/HSTS/Permissions-Policy on a console that renders rich HTML    | `next.config.js`                                                                       | **high**                                                                            |
| S5  | No admin rate limit; no idle/absolute timeout; no IP allow-list       | —                                                                                      | **medium**                                                                          |
| S6  | Subscription plan/status and member removal without step-up           | `admin.routes.ts:408,434,294`                                                          | **high**                                                                            |
| S7  | No guard preventing a new admin route from shipping without the chain | —                                                                                      | **high** (systemic)                                                                 |

---

## 4. Architecture decisions taken in this slice set

1. `adminRoute(permission, { stepUp })` is the single builder; `adminRouteByMethod(read, write, …)`
   covers files where one `const admin` serves GET and mutations (blog/market/oauth).
2. `isTestRuntime()` returns true only when `VITEST` is set **and** `buildServer({ testRuntime: true })`
   was called. Production startup refuses if either marker is present.
3. Secrets: `platform_secrets` + SECURITY DEFINER `platform_secret_set/get` over Supabase Vault.
   Cache 5 minutes. `get` is `service_role`-only. No admin route ever returns a value.
4. Monitoring: Postgres rollups only (`request_metrics_minute`, `instance_metrics_minute`,
   `request_metrics_hour`, `active_users_minute`, `metric_alert_rules`). Route key is the Fastify
   **template**; no query strings, no ids, no emails.
5. Wall display: a hashed, scoped, expiring **wall token** exchanged for an httpOnly cookie; it can
   read only the aggregated monitor stream.

---

## 5. What this preflight does **not** claim

- No migration in this document has been run. Every migration stays
  `PENDING HUMAN CONFIRMATION`.
- `pg_stat_statements` may not be enabled on the live database; the vitals function returns `null`
  plus a reason instead of failing.
- The local Afghan gateway brand is unknown — the adapter is a neutral interface only.
- PayPal, Render, Supabase Management and Cloudflare credentials are absent: those surfaces report
  `NOT_CONFIGURED`, never a guessed number.

## 6. NEEDS_OWNER_DECISION

1. Which local Afghan gateway (HesabPay and others are candidates) should be the first real adapter?
2. Which alert channels should be enabled by default (in-app only, or email too)?
3. Should the IP allow-list be enabled for production, and with which addresses?
4. Budget thresholds for AI spend per workspace and for the platform.

## 7. Slices

`S-1…S-7` → `P-1…P-3` → `M-1…M-7` → `A` → `R` → docs. Progress is recorded in
`docs/architecture/V63-IMPLEMENTATION-PROGRESS.md`.
