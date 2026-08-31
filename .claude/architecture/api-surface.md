# سطح API — روت، سرویس، hook

> تولیدشده از کد در ۳۱ اوت ۲۰۲۶. اگر با کد نمی‌خواند، **کد درست است**.
> بازتولید: `grep -rE "fastify\.(get|post|put|patch|delete)\(" backend/src/routes/`

---

## قانون آدرس‌دهی

`apiClient` در `packages/api/src/lib/client.ts` باز‌URL ی دارد که به `/api`
ختم می‌شود. پس:

```
hook:   apiClient.get('/governance/sod')
server: fastify.get('/sod')  با prefix '/api/governance'
```

روت‌فایل‌هایی که prefix ندارند، مسیر کاملشان را خودشان می‌نویسند
(`'/api/products'`).

⚠️ `client-route-contract.test.ts` این تطابق را قفل می‌کند — دو باگ ۴۰۴ از
همین‌جا آمد.

---

## روت‌ها با prefix

| prefix                 | فایل                     | تعداد | سرویس                                 |
| ---------------------- | ------------------------ | ----- | ------------------------------------- |
| `/api/accounting`      | accounting.routes        | 15    | `services/accounting/`                |
| `/api/inventory`       | inventory-costing.routes | 6     | `services/inventory-costing/`         |
| `/api/payments`        | payments.routes          | 7     | `services/payments/`                  |
| `/api/conflicts`       | conflict.routes          | 3     | `services/conflict/`                  |
| `/api/governance`      | governance.routes        | 3     | `services/authorization/`             |
| `/api/branches`        | branch.routes            | 4     | `services/branch/`                    |
| `/api/suppliers`       | supplier.routes          | 5     | `services/supplier/`                  |
| `/api/personalization` | personalization.routes   | 4     | `services/personalization/`           |
| `/api/rules`           | rules.routes             | 6     | `services/rules/`                     |
| `/api/intelligence`    | intelligence.routes      | 7     | `services/mdm/`, `services/insights/` |
| `/api/tax`             | tax.routes               | 6     | `services/tax/`                       |
| `/api/pos`             | pos.routes               | 8     | `services/pos/`                       |
| `/api/finance`         | finance-ops.routes       | 20    | assets, banking, currency, dimensions |
| `/api/operations`      | operations.routes        | 16    | budgeting, traceability, timesheets   |
| `/api/migrations`      | migration.routes         | 7     | `services/migration/`                 |

## روت‌های بدون prefix (مسیر کامل در خود فایل)

`activity`(5) `admin`(18) `ai`(2) `analytics`(4) `audit`(7) `auth`(7)
`billing`(6) `crm`(11) `customer`(6) `debug`(3) `event`(5)
`human-resources`(17) `invoice`(5) `manufacturing`(7) `notification`(4)
`permission`(12) `product`(6) `project`(16) `purchasing`(4) `sync`(6)
`transaction`(4) `warehouse`(6) `workflow`(9) `workspace`(14)

---

## نگاشت hook ← endpoint

| hook                                                        | endpoint اصلی                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `accounting.ts`                                             | `/accounting/accounts`, `/accounting/journal`, گزارش‌ها       |
| `till.ts`                                                   | `/pos/sessions*`                                              |
| `assets.ts`                                                 | `/finance/assets*`                                            |
| `bank.ts`                                                   | `/finance/bank/*`                                             |
| `budgets.ts`                                                | `/operations/budgets*`                                        |
| `timesheets.ts`                                             | `/operations/timesheets*`                                     |
| `expiry.ts`                                                 | `/operations/batches`, `/serials`, `/expiry`, `/lot-trail`    |
| `conflicts.ts`                                              | `/conflicts*`                                                 |
| `governance.ts`                                             | `/governance/sod` — ⚠️ **PUT** برای ذخیره                     |
| `sales-followup.ts`                                         | ⚠️ روی `/interactions` نگاشته شده                             |
| `products.ts`                                               | `/products` — ⚠️ **PATCH** برای ویرایش                        |
| `migrations.ts`                                             | `/migrations*` — فایل در **بدنه‌ی JSON** می‌رود، نه multipart |
| `invoices.ts` `customers.ts` `projects.ts` `employees.ts` … | نام مشابه                                                     |

---

## ترتیب گاردها (قابل مذاکره نیست)

```ts
preHandler: [authenticate, requireWorkspaceContext, requireCapability('...')]
```

معمولاً در یک const مشترک بالای فایل:

```ts
const read = [authenticate, requireWorkspaceContext, requireCapability('report.financial.read')]
const write = [authenticate, requireWorkspaceContext, requireCapability('ledger.post')]
```

⚠️ اگر کش workspace-scoped داری، **بعد** از `requireWorkspaceContext` بیاید —
کلیدش از `request.tenancy.workspaceId` ساخته می‌شود. نبودش ۵۰۰ می‌دهد با
پیامی درباره‌ی کش، که آدم را به فایل اشتباه می‌فرستد.

⚠️ در handler از `request.tenancy` استفاده کن، **نه** `request.userId` +
`request.userRole`. دومی برای کاربر چند-workspace خالی است.

---

## RPCهای Postgres

supabase-js تراکنش ندارد، پس هر نوشتن چندجدولی یک تابع است:

| تابع                            | برای                                      |
| ------------------------------- | ----------------------------------------- |
| `accounting_post_journal_entry` | سند + سطرها، اتمیک                        |
| `pos_record_order`              | سفارش + پرداخت‌ها، با قفل session         |
| `payments_record`               | پرداخت + تخصیص‌ها                         |
| `payments_cancel`               | لغو + برگرداندن مانده‌ی فاکتور            |
| `accounting_trial_balance`      | تراز آزمایشی                              |
| `auth_workspace_ids()`          | **SECURITY DEFINER** — workspaceهای کاربر |
| `is_workspace_member(ws, user)` | **SECURITY DEFINER**                      |
| `auth_owned_workspace_ids()`    | **SECURITY DEFINER** — مالکیت             |

⚠️ سه تابع آخر باید SECURITY DEFINER بمانند. بدون آن، policy روی
`workspace_members` خودش را صدا می‌زند → `42P17`.

⚠️ کد از پیام خطای RPC یک کد SCREAMING_CASE بیرون می‌کشد:

```ts
const code = /\b([A-Z][A-Z_]{6,})\b/.exec(error.message ?? '')?.[1]
```

پس `RAISE EXCEPTION 'POS_SESSION_NOT_OPEN'` قرارداد است.

---

## ۲۱ Core

```
accounting  assets  authorization  banking  branch  budgeting  conflict
currency  dimensions  insights  inventory-costing  mdm  payments
personalization  plugins  pos  rules  supplier  tax  timesheets  traceability
```

الگو در هر پوشه:

```
<x>.domain.ts       خالص — بدون DB، بدون شبکه، بدون زمان
<x>.service.ts      TenancyContext می‌گیرد
<x>.repository.ts   فقط SQL (اگر جدا شده)
<x>.port.ts         قرارداد برای Coreهای دیگر
index.ts            سطح عمومی
```

---

## ۷ endpoint که کلاینت صدا می‌زند و وجود ندارند

در `KNOWN_MISSING` داخل `backend/src/__tests__/client-route-contract.test.ts`.
هر کدام امروز ۴۰۴ می‌دهد:

- `GET /v1/activities/entity/:type/:id` و `/summary`
- `GET /api/v1/entities/:type/:id/summary` و `/activities`
- `DELETE /employees/:id` — سرور فقط GET و PATCH دارد
- `GET /purchase-orders/:id` — فقط PATCH وجود دارد
- `GET /transactions/ledger`

این فهرست فقط **کوچک** می‌شود. حذف یک خط یعنی endpoint ساخته شد.
