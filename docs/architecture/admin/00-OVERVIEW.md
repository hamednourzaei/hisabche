# Admin console — overview

> **خلاصه برای مالک.** کنسول مدیر یک اپ Next.js جدا (پورت ۳۰۴۰) است که فقط با نشست Supabase،
> فهرست ایمیل مجاز، نقش مدیر و کد دوم (AAL2) باز می‌شود. هشت هاب دارد و هر کار جدید یک تب یا
> بخش داخل همان هاب‌هاست. هیچ نوشتنی بدون مجوز ریز و — برای کارهای حساس — بدون کد یک‌بارمصرف
> پنج‌دقیقه‌ای (Step-Up) انجام نمی‌شود. رازها در Vault هستند و هرگز به مرورگر نمی‌رسند. اعداد
> مانیتورینگ از rollupهای Postgres می‌آیند، نه از ابزار بیرونی؛ و عدد ناشناخته همیشه «—» است،
> نه صفر.

Scope: `apps/admin` (browser), `/api/admin/*` and `/api/wall/*` in `backend/`, plus the Postgres
objects they read. Customer workspaces are out of scope except where an admin action reaches them.

---

## 1. Context (C4 level 1)

```
        ┌──────────────┐        ┌─────────────────────┐        ┌──────────────────┐
        │   Admin      │  HTTPS │  hisabche backend   │  SQL   │  Supabase        │
        │  (browser)   │───────>│  (Fastify, stateless)│──────>│  Postgres + Auth │
        └──────┬───────┘        └──────┬──────────────┘        │  + Vault         │
               │                       │                       └──────────────────┘
               │  Supabase Auth        │  HTTPS
               │  (session, AAL2)      ├──────────────> AI provider (Anthropic / OpenAI)
               ▼                       ├──────────────> Stripe / PayPal
        ┌──────────────┐               └──────────────> Render (instance scaling)
        │ Supabase Auth│
        └──────────────┘

        TV wall ──── wall token (hashed, expiring) ────> /api/wall/*
```

The browser is never trusted. The backend holds the service key; the console never does.

## 2. Containers (C4 level 2)

```
apps/admin
  app/[lang]/(admin)/…        one page per hub; each hub switches tabs with a SegmentedControl
  components/admin-shell/     rail, command palette, StepUpDialog, table helpers
  hooks/use-admin-*.ts        one hook per endpoint (React Query)
  proxy.ts                    CSP nonce per response, no-store, Supabase session refresh
  next.config.js              HSTS, Permissions-Policy, COOP, frame-deny, noindex

backend
  routes/admin*.routes.ts     thin: parse, guard, call service, map response
  services/admin/*.ts         RBAC matrix, billing, customers, ops, security, AI, posture,
                              IP allow-list, payment gateways
  services/secrets/           Vault reader with a 5-minute cache
  services/monitoring/        per-route aggregation, vitals, alerts, wall tokens
  services/payments-gateway/  port + stripe / paypal / manual / local adapters
  middleware/                 authenticate → platformAdminGuard → requireAdminPermission →
                              requireAdminStepUp; rate limit; IP allow-list
```

## 3. One request through the admin chain

```
request
  → authenticate                 verified Supabase JWT (one decode, shared claims)
  → platformAdminGuard           email allow-list, IP allow-list (break-glass for the owner)
  → requireAdminPermission(x)    role → permission (admin_rbac.domain.ts), AAL2, idle + absolute
  → requireAdminStepUp           TOTP check ≤ 5 minutes old (writes only)
  → route handler                service → Postgres / Vault
  → audit                        audit_logs + admin_security_events (actor, IP, user agent)
```

A route that skips a link fails `admin-route-chain.test.ts`. That test enumerates the registered
routes at build time, so a new route cannot regress silently.

## 4. Where each tab lives

| Hub        | Tab          | Read path                                                                        | Write path                                                                |
| ---------- | ------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| revenue    | `gateways`   | `GET /api/admin/gateways`                                                        | `PUT /api/admin/gateways/:kind` (step-up + maker-checker for live/secret) |
| operations | `monitor`    | `GET /api/admin/monitor/overview                                                 | series                                                                    | vitals | alerts | wall-tokens` | `PUT /api/admin/monitor/alerts/:id`, wall token create/revoke (step-up) |
| operations | wall display | `GET /api/admin/monitor/stream` (SSE) or `/api/wall/overview` (wall cookie)      | —                                                                         |
| product    | `ai`         | `/api/admin/ai/{fallbacks,prices,usage,budgets,prompts,audit}`, `/api/ai/config` | all writes step-up; key never returned                                    |
| security   | `network`    | `GET /api/admin/security/ip-allowlist`                                           | `PUT/DELETE` (step-up)                                                    |
| security   | `posture`    | `GET /api/admin/security/posture`                                                | —                                                                         |

## 5. Data that is money or a secret

- Money on this surface is integer minor units (micros for AI cost). No `/100`, no float, no sum
  across currencies. A cost with no price row is `null`.
- Secrets exist only in Vault. `platform_secrets` stores `name`, `purpose`, `last4`, `rotated_at`,
  `rotated_by` — never a value. No admin route returns a value; a test asserts it for every route.
- `audit_logs` is append-only from the application's point of view; security events record refusals
  as well as successes.

## 6. Related documents

- `docs/architecture/admin/V63-PREFLIGHT.md` — the facts and the per-requirement classification.
- `docs/architecture/admin/THREAT-MODEL.md` — STRIDE per asset and the residual risks.
- `docs/architecture/admin/ADR-001-vault-for-secrets.md` … `ADR-004-one-guard-chain.md`.
- `docs/architecture/V63-IMPLEMENTATION-PROGRESS.md` — what landed, what did not, and the numbers.
- `docs/runbooks/rotate-a-secret.md`, `gateway-webhook-failing.md`, `wall-display-setup.md`.
