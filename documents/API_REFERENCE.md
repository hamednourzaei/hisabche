# Hisabche — API Reference

> Source of truth: `backend/src/routes/*`, `backend/src/index.ts`,
> `packages/validation/src/schemas/*`. Routes registered by the auth
> middleware; most respond under `/api` or `/api/v1`.

## Contract-First (docs-first) — REQUIRED WORKFLOW

This file is a **contract**, not a report. The order of work for any new
API:

1. **Write the contract here first** (method, path, permission, validation,
   example request/response, error codes).
2. Then implement the route + Zod schema in
   `packages/validation`/`backend`.
3. Review diff: contract and code must match.

New API = update this file **before** writing the route. Same rule for new
Electron IPC channels (`ipc-contract.ts` + `SYSTEM_DESIGN.md`).

### Contract template

````markdown
### POST /api/<resource>

**Permission:** <capability or role>
**Validation:** <zod schema reference>
**Offline:** <supported | online-only> — sync behavior
**Idempotency:** <none | by client ref>

Request:

```jsonc
{ ... }
```
````

Response:

```jsonc
{ ... }
```

Errors: 400/401/403/404/409/422/429/500 (see Status Map)

````

### Example (planned — not yet implemented)

Feature: **Invoice Payment** (register a payment against an invoice)

```markdown
### POST /api/payments

**Permission:** `record.update` (member+)
**Validation:** `paymentSchema` (to be added in `@hisabche/validation`)
**Offline:** supported — local payment row + queue; SERVER_WINS on conflict
**Idempotency:** by `reference` (unique per invoice+reference)

Request:
{
  "invoiceId": "uuid",
  "amount": 500,          // > 0
  "currency": "AFN",      // required, one of AFN|USD|PKR|IRR
  "method": "cash",       // cash|credit|bank|mobile_money
  "date": "2026-08-07",
  "reference": "PAY-2026-08-07-01"
}

Response 201:
{
  "id": "uuid",
  "invoiceId": "uuid",
  "remainingDebt": 500    // total - paid_amount after applying
}

Errors: 400 (amount ≤ 0), 404 (invoice not found), 409 (duplicate reference)
````

(Implementing this route is a future task; the contract is the spec.)

## Conventions

- **Base URL**: `https://api.hisabche.com/api` (dev override via
  `NEXT_PUBLIC_API_URL`).
- **Auth**: `Authorization: Bearer <JWT>` required on all routes except
  auth/public ones. Verified by `backend/src/middleware/auth.middleware.ts`.
- **Validation**: request bodies parsed with Zod schemas
  (`@hisabche/validation`); `zod-to-json-schema` feeds Swagger (`/docs`).
  A `z.ZodError` returns **400**.
- **Errors**: `{ message, code, status, details? }` (see `ApiError` in
  `packages/api/src/lib/client.ts`).
- Responses: `{ data, message?, status }` shape on the client wrapper.
- **Multi-tenancy**: every write is scoped to the caller's workspace
  (`request.workspaceId`) and/or `user_id` (RLS).

## Error Status Map

| Status | Meaning                                              |
| ------ | ---------------------------------------------------- |
| 400    | Zod validation failed (invalid body/query)           |
| 401    | Missing/expired/invalid JWT (`UnauthorizedError`)    |
| 403    | Insufficient role/permission (`ForbiddenError`)      |
| 404    | Row not found (`NotFoundError`)                      |
| 409    | Conflict / duplicate (e.g. workspace slug)           |
| 422    | Semantic business validation (e.g. stock below zero) |
| 429    | Rate limited (`@fastify/rate-limit`)                 |
| 500    | Server error (logged; response sanitized)            |

Error classes in `backend/src/errors/`: `base.error.ts`, `auth.error.ts`,
`database.error.ts`.

## Auth

| Method | Path                        | Body / Query                                                           | Notes                                       |
| ------ | --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| POST   | `/api/auth/signup`          | `{ email, password (≥8, upper+lower+digit), fullName, businessName? }` | Creates profile; 201                        |
| POST   | `/api/auth/login`           | `{ email, password }`                                                  | Returns `{ token, user }`                   |
| POST   | `/api/auth/logout`          | —                                                                      | Clears session server-side                  |
| GET    | `/api/auth/me`              | —                                                                      | Returns sanitized profile (`SanitizedUser`) |
| POST   | `/api/auth/forgot-password` | `{ email }`                                                            | Sends reset email (Resend)                  |
| POST   | `/api/auth/reset-password`  | `{ password, confirmPassword, token }`                                 |                                             |
| PATCH  | `/api/auth/profile`         | profile fields                                                         | Update profile                              |

Schemas: `packages/validation/src/schemas/auth.schema.ts`
(`loginSchema`, `signUpSchema`, `forgotPasswordSchema`,
`resetPasswordSchema`, `updateProfileSchema`).

## Workspaces (multi-tenancy)

| Method | Path                                    | Notes                               |
| ------ | --------------------------------------- | ----------------------------------- |
| GET    | `/api/workspaces`                       | List caller workspaces              |
| POST   | `/api/workspaces`                       | Create (slug unique → 409 on clash) |
| GET    | `/api/workspaces/:id`                   | Detail                              |
| PATCH  | `/api/workspaces/:id`                   | Update name/logo                    |
| GET    | `/api/workspaces/:id/members`           | List members                        |
| PATCH  | `/api/workspaces/:id/members/role`      | Change member role (owner)          |
| DELETE | `/api/workspaces/:id/members/:memberId` | Remove member                       |
| POST   | `/api/workspaces/:id/leave`             | Leave workspace                     |
| GET    | `/api/workspaces/:id/invites`           | List invites                        |
| POST   | `/api/workspaces/:id/invites`           | Create invite                       |
| POST   | `/api/workspaces/accept-invite`         | Accept invite token                 |
| POST   | `/api/workspaces/:id/members/direct`    | Add member directly                 |
| DELETE | `/api/workspaces/:id/invites/:inviteId` | Revoke invite                       |

To resolve a workspace scoped view your `auth-core` will set
`workspaceId` from the token/session (see AUTH_AND_PERMISSION.md).

## Invoices

| Method | Path                | Notes                                                                                                                                                                      |
| ------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/invoices`     | List/search invoices — filters: `search, type, status, customerId, supplierId, currency, dateFrom, dateTo, minTotal, maxTotal, page, limit, sortBy, sortDirection, cursor` |
| GET    | `/api/invoices/:id` | Detail incl. items                                                                                                                                                         |
| POST   | `/api/invoices`     | Create sale/purchase invoice + items + totals                                                                                                                              |
| PATCH  | `/api/invoices/:id` | Update invoice / items                                                                                                                                                     |
| DELETE | `/api/invoices/:id` | Delete (hard)                                                                                                                                                              |

Request body (create) — `createInvoiceSchema`, `invoices.schema.ts`:

```jsonc
{
  // currency default "AFN", paymentMethod default "cash"
  "type": "sale", // "sale" | "purchase"
  "date": "2026-08-07",
  "dueDate": "2026-08-21", // optional
  "customerId": "uuid", // optional, or supplierId for purchase
  "items": [
    // min 1
    {
      "productId": "uuid", // optional — item may be a free-typed line
      "productName": "string",
      "quantity": 2, // > 0
      "unitPrice": 12.5, // > 0
      "discount": 0, // percentage 0–100
      "totalPrice": 25,
    },
  ],
  "subtotal": 25,
  "discountTotal": 0,
  "discountType": "fixed", // "percentage" | "fixed"
  "taxRate": 0,
  "taxTotal": 0,
  "total": 25,
  "paidAmount": 0,
  "notes": "",
}
```

Server computes/overrides `invoiceNumber`, id, timestamps, status.
Invoice status allowed values: `pending, paid, completed, cancelled,
partial, overdue`.

## Products

| Method | Path                      | Notes                            |
| ------ | ------------------------- | -------------------------------- |
| GET    | `/api/products`           | List (workspace-scoped)          |
| GET    | `/api/products/:id`       | Detail                           |
| POST   | `/api/products`           | Create product                   |
| PATCH  | `/api/products/:id`       | Update (name, prices, stock…)    |
| DELETE | `/api/products/:id`       | Delete                           |
| GET    | `/api/products/low-stock` | Products below `min_stock_level` |

Schema: `packages/validation/src/schemas/product.schema.ts`.

Fields (server table): `name, barcode, sku, category, quantity, unit,
buy_price, sell_price, wholesale_price, min_stock_level, description,
is_active`.

## Customers

| Method | Path                         | Notes                     |
| ------ | ---------------------------- | ------------------------- |
| GET    | `/api/customers`             | List                      |
| GET    | `/api/customers/:id`         | Detail                    |
| POST   | `/api/customers`             | Create                    |
| PATCH  | `/api/customers/:id`         | Update                    |
| DELETE | `/api/customers/:id`         | Delete                    |
| GET    | `/api/customers/:id/balance` | Customer balance / ledger |

Fields: `full_name, phone, email, address, opening_balance, is_active`.

## Transactions

| Method | Path                                    | Notes                                         |
| ------ | --------------------------------------- | --------------------------------------------- |
| GET    | `/api/transactions`                     | List (workspace-scoped)                       |
| POST   | `/api/transactions`                     | Create (sale/purchase/payment/receipt/return) |
| GET    | `/api/transactions/balance/:customerId` | Balance for a customer                        |
| DELETE | `/api/transactions/:id`                 | Delete                                        |

## Accounting

Registered without `/api` prefix:

| Method     | Path                | Notes                |
| ---------- | ------------------- | -------------------- |
| GET / POST | `/accounts`         | Chart of accounts    |
| GET / POST | `/journal`          | Journal entries      |
| GET        | `/trial-balance`    | Trial balance        |
| GET        | `/balance-sheet`    | Balance sheet        |
| GET        | `/income-statement` | Income statement     |
| GET        | `/cash-flow`        | Cash flow            |
| GET        | `/customer-debt`    | Customer debt report |

## Analytics

| Method | Path                       |
| ------ | -------------------------- |
| GET    | `/api/analytics/dashboard` |
| GET    | `/api/analytics/sales`     |
| GET    | `/api/analytics/inventory` |
| GET    | `/api/analytics/financial` |

## CRM

| Method | Path                              | Notes                  |
| ------ | --------------------------------- | ---------------------- |
| GET    | `/api/interactions`               | List                   |
| POST   | `/api/interactions`               | Create                 |
| PATCH  | `/api/interactions/:id/status`    | Update status          |
| GET    | `/api/opportunities`              | List                   |
| POST   | `/api/opportunities`              | Create                 |
| PATCH  | `/api/opportunities/:id`          | Update                 |
| GET    | `/api/public/tasks/:token`        | Public share (no auth) |
| PATCH  | `/api/public/tasks/:token/status` | Public status change   |

## Purchasing

| Method | Path                               | Notes                    |
| ------ | ---------------------------------- | ------------------------ |
| GET    | `/api/purchase-orders`             | List                     |
| POST   | `/api/purchase-orders`             | Create                   |
| PATCH  | `/api/purchase-orders/:id`         | Update                   |
| POST   | `/api/purchase-orders/:id/receive` | Receive goods (stock in) |

## Warehouse

| Method | Path                        | Notes                             |
| ------ | --------------------------- | --------------------------------- |
| GET    | `/api/warehouses`           | List                              |
| POST   | `/api/warehouses`           | Create                            |
| PATCH  | `/api/warehouses/:id`       | Update                            |
| DELETE | `/api/warehouses/:id`       | Delete                            |
| POST   | `/api/stock-transfers`      | Transfer stock between warehouses |
| GET    | `/api/warehouses/:id/stock` | Warehouse stock                   |

## Projects / HR

| Method                | Path                                                             | Notes           |
| --------------------- | ---------------------------------------------------------------- | --------------- |
| GET/POST              | `/api/projects`, `/api/projects/:id`, PATCH/DELETE               | Projects        |
| GET/POST              | `/api/projects/:projectId/tasks`; PATCH/DELETE `/api/tasks/:id`  | Tasks           |
| GET/POST/DELETE       | `/api/projects/:projectId/members...`                            | Project members |
| GET/POST/PATCH/DELETE | `/api/projects/:projectId/time-entries`, `/api/time-entries/:id` | Time entries    |
| GET/POST/PATCH        | `/api/departments`, `/api/employees`, `/api/employees/:id`       | HR              |
| GET/POST/PATCH        | `/api/attendance...`, `/api/leaves...`, `/api/payrolls...`       | HR ops          |
| GET/POST/PATCH        | `/api/payrolls`, `:id`                                           | Payroll         |

## Manufacturing

| Method   | Path                                             |
| -------- | ------------------------------------------------ |
| GET/POST | `/api/boms`, PATCH `/api/boms/:id`               |
| GET/POST | `/api/work-orders`, PATCH `/api/work-orders/:id` |
| POST     | `/api/work-orders/:id/complete`                  |

## Workflows (Approval Engine, v2.)

| Method | Path                                     | Notes                  |
| ------ | ---------------------------------------- | ---------------------- |
| POST   | `/api/v1/workflows`                      | Create template        |
| GET    | `/api/v1/workflows`                      | List                   |
| GET    | `/api/v1/workflows/:id`                  | Detail                 |
| PATCH  | `/api/v1/workflows/:id`                  | Update                 |
| DELETE | `/api/v1/workflows/:id`                  | Delete                 |
| POST   | `/api/v1/workflows/instances`            | Start instance         |
| GET    | `/api/v1/workflows/instances`            | List instances         |
| GET    | `/api/v1/workflows/instances/:id`        | Instance detail        |
| POST   | `/api/v1/workflows/instances/:id/action` | Approve/reject/forward |

`performAction` checks `actor role` against `step.approver_role`
(`workflow.service.ts`) → 403 mismatch.

Schemas: `packages/validation/src/schemas/workflow.schema.ts`.

## Notifications / Activities

| Method           | Path                                                                        | Notes            |
| ---------------- | --------------------------------------------------------------------------- | ---------------- |
| GET              | `/api/v1/notifications`                                                     | List             |
| PATCH            | `/api/v1/notifications/mark-read`                                           | Mark single read |
| PATCH            | `/api/v1/notifications/mark-all-read`                                       |                  |
| GET              | `/api/v1/notifications/unread-count`                                        |                  |
| GET              | `/api/v1/activities`                                                        | Activity feed    |
| PATCH            | `/api/v1/activities/mark-read` / `mark-all-read`                            |                  |
| GET/PATCH/DELETE | `/api/v1/activities/:id`                                                    |                  |
| POST             | `/api/audit/log`                                                            | Write audit/log  |
| GET              | `/api/audit/logs`, `/api/audit/entity/:type/:id`, `/api/audit/user/:userId` | Audit reads      |
| GET              | `/api/audit/stats`, `/api/audit/export`                                     |                  |
| POST             | `/api/audit/cleanup`                                                        |                  |

## Billing

| Method | Path                                                             |
| ------ | ---------------------------------------------------------------- |
| GET    | `/api/billing/plans`, `/subscription`, `/usage`, `/trial-status` |
| POST   | `/api/billing/upgrade`, `/api/billing/cancel`                    |

## Sync

| Method | Path             | Notes                                                                |
| ------ | ---------------- | -------------------------------------------------------------------- |
| GET    | `/api/sync/pull` | Incremental pull (rows changed since cursor; takes `table`, `since`) |
| POST   | `/api/sync/push` | Apply local queue (creates/updates/deletes per user+workspace)       |

See OFFLINE_SYNC.md for the full protocol.

## Events / AI / Public

| Method               | Path                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| POST                 | `/api/events/emit`, `/process`, `/seed`                               |
| GET                  | `/api/events/stats`                                                   |
| POST                 | `/api/ai/query`, GET `/api/ai/insights`                               |
| GET                  | `/api/public/tasks/:token` (see CRM)                                  |
| Public invoice share | `/pub/...token-based` — see `docs/invoice-public-share-migration.sql` |

`invoice-public.routes.ts` existed but no `/api` literal strings were found;
the public invoice/share features are token-based routes. **Not fully
verified from repository** — exact path prefix for `invoice-public` should be
cross-checked against the running server Swagger at `/docs` before relying on
it in integration code.

## Rate Limits

- `@fastify/rate-limit` applied globally; Auth routes are additionally
  guarded by Arcjet (`middleware/arcjet.ts`). Exact per-route limits are
  config/env based — **not verified in code**.
