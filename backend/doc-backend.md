# مستندات کامل بک‌اند Hisabche v2.4

> **آخرین به‌روزرسانی:** ۲۰ ژوئیه ۲۰۲۶  
> **نسخه:** 2.4.0  
> **زبان:** فارسی

---

## فهرست مطالب

1. [معماری کلی](#1-معماری-کلی)
2. [Tech Stack](#2-tech-stack)
3. [ساختار پروژه](#3-ساختار-پروژه)
4. [فایل ورودی — index.ts](#4-فایل-ورودی--indexts)
5. [اتصال به دیتابیس — db.ts](#5-اتصال-به-دیتابیس--dbts)
6. [Schema دیتابیس — drizzle-schema.ts](#6-schema-دیتابیس--drizzle-schemats)
7. [احراز هویت — Auth](#7-احراز-هویت--auth)
8. [API Routes — فهرست کامل](#8-api-routes--فهرست-کامل)
9. [لایه سرویس — Services](#9-لایه-سرویس--services)
10. [Middlewareها](#10-middlewareها)
11. [صف و پردازش غیرهمزمان — Queue](#11-صف-و-پردازش-غیرهمزمان--queue)
12. [PDF Generation](#12-pdf-generation)
13. [کش و بهینه‌سازی](#13-کش-و-بهینه‌سازی)
14. [Job Scheduler و Cron Jobs](#14-job-scheduler-و-cron-jobs)
15. [ایمیل و نوتیفیکیشن](#15-ایمیل-و-نوتیفیکیشن)
16. [Billing و اشتراک‌ها](#16-billing-و-اشتراک‌ها)
17. [Workflow Engine](#17-workflow-engine)
18. [Observability و Monitoring](#18-observability-و-monitoring)
19. [امنیت](#19-امنیت)
20. [تنظیمات Production](#20-تنظیمات-production)
21. [Environment Variables](#21-environment-variables)
22. [نقشه راه توسعه](#22-نقشه-راه-توسعه)

---

## 1. معماری کلی

```
┌─────────────────────────────────────────────────────────┐
│                    Client Apps                          │
│            (Next.js Web + React Native Mobile)          │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTPS / REST API
┌─────────────────▼───────────────────────────────────────┐
│                 Fastify Server (Node.js)                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Middleware Pipeline                 │   │
│  │  Arcjet → CORS → Auth → Cache → Rate Limit →    │   │
│  │  Zod Validation → Service Layer                 │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐   │
│  │  Routes  │→│ Services │→│    Supabase Client   │   │
│  │  (23)    │ │  (27)    │ │    (PostgreSQL)      │   │
│  └──────────┘ └──────────┘ └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**اصول طراحی:**
- **Fat Services, Thin Routes:** منطق کسب‌وکار در Serviceها، Routes فقط validation و routing
- **Single Responsibility:** هر Service یک domain را مدیریت می‌کند
- **Caching در دو لایه:** Memory Cache (in-process) + Redis Cache (distributed)
- **Offline-first sync:** API endpoints مخصوص pull/push برای اپلیکیشن موبایل

---

## 2. Tech Stack

| دسته | تکنولوژی | نسخه |
|------|----------|------|
| **Runtime** | Node.js | 20+ |
| **Framework** | Fastify | 5.10 |
| **زبان** | TypeScript | 5.5 (strict) |
| **دیتابیس** | PostgreSQL (از طریق Supabase) | 15 |
| **ORM** | Drizzle ORM | 0.45 |
| **Validation** | Zod | 3.25 |
| **Auth** | Supabase Auth + JWT | - |
| **Cache** | Redis (ioredis) + In-Memory LRU | 5.10 / 10.4 |
| **PDF** | @react-pdf/renderer | 4.5 |
| **Queue** | BullMQ (Redis) + In-Process Queue | 5.76 |
| **Email** | Resend | 6.17 |
| **Cron** | node-cron | 4.6 |
| **Rate Limit** | @fastify/rate-limit | 11.1 |
| **Anti-bot** | Arcjet | 1.0 |

---

## 3. ساختار پروژه

```
backend/
├── src/
│   ├── index.ts                    ← Entry point — Fastify server
│   ├── db.ts                       ← Supabase client + connection
│   ├── drizzle-schema.ts           ← Drizzle ORM schema (12 جدول)
│   ├── queue.ts                    ← In-process async queue
│   ├── errors/
│   │   ├── base.error.ts           ← BaseError abstract class
│   │   ├── auth.error.ts           ← AuthError, ForbiddenError, TokenExpiredError
│   │   └── database.error.ts       ← DatabaseError, NotFoundError, ConflictError
│   ├── middleware/
│   │   ├── arcjet.ts               ← Anti-bot & rate limiting (Arcjet)
│   │   ├── auth.middleware.ts       ← JWT authentication + cache
│   │   └── cache.middleware.ts      ← HTTP response caching
│   ├── routes/                     ← 23 route files
│   ├── services/                   ← 27 service files
│   ├── plugins/
│   │   └── job-scheduler.plugin.ts ← Background job runner
│   ├── scheduler/
│   │   └── index.ts                ← Cron job scheduler
│   ├── workers/
│   │   └── trial-expiration.worker.ts ← Trial expiration worker
│   ├── queue/
│   │   └── pdf-queue.ts            ← BullMQ PDF generation queue
│   ├── pdf/
│   │   └── InvoicePDFDocument.tsx   ← React PDF template
│   ├── utils/
│   │   ├── batch.ts                ← N+1 query eliminator
│   │   ├── cache.ts                ← Cache keys + helpers
│   │   ├── pagination.ts           ← Keyset pagination + MemoryCache
│   │   └── product.mapper.ts       ← snake_case → camelCase mapper
│   ├── fonts/                      ← Vazirmatn fonts
│   └── __tests__/                  ← Test files
├── drizzle/
│   └── migrations/                 ← Drizzle migrations
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── .env
```

---

## 4. فایل ورودی — index.ts

### 4.1 ترتیب راه‌اندازی

1. **Load Environment** — dotenv در non-production
2. **Create Fastify Instance** — با تنظیمات logger (pino-pretty در dev)
3. **Performance Monitoring Hooks** — `onRequest` (startTime) + `onSend` (X-Response-Time-MS, security headers)
4. **Auth Middleware** — اعمال روی همه مسیرها به‌جز public paths
5. **Cache Middleware** — GET requests با کلید `http:{userId}:{url}`
6. **Health Checks** — `/api/health`, `/live`, `/ready`, `/api/slo`
7. **404 + Error Handlers**
8. **Register Plugins:**
   - Compression (gzip/deflate, threshold: 1KB)
   - CORS (production: hisabche.com only)
   - Swagger + Swagger UI (`/docs`)
   - Rate Limiting (100 req/min per user)
9. **Register 23 Routes + Billing + Job Scheduler**
10. **Start Scheduler** — cron jobs
11. **Graceful Shutdown** — SIGTERM/SIGINT

### 4.2 Health Check Endpoints

| Endpoint | توضیح |
|----------|--------|
| `GET /api/health` | وضعیت سرور، uptime، ورژن |
| `GET /live` | Kubernetes liveness probe |
| `GET /ready` | Kubernetes readiness probe (چک دیتابیس) |
| `GET /api/slo` | SLO metrics |
| `GET /api` | اطلاعات کلی API |

### 4.3 Security Headers

```
X-Response-Time-MS: {duration}
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## 5. اتصال به دیتابیس — db.ts

### 5.1 Supabase Client

- **پیکربندی:** Service Role Key
- **Local Development:** پشتیبانی از proxy (undici + ProxyAgent)
- **Connection pooling:** مدیریت از طریق Supabase

### 5.2 Connection Monitoring

```typescript
dbStats = {
  connectionCount, totalQueries, slowQueries
}
```

- `withConnection()` — wrapper برای اندازه‌گیری duration کوئری‌ها
- کوئری‌های > 500ms به عنوان slow query لاگ می‌شوند

---

## 6. Schema دیتابیس — drizzle-schema.ts

### 6.1 جداول اصلی

| جدول | توضیح | ستون‌های مهم |
|------|--------|-------------|
| `workspaces` | سازمان/فضای کاری | id, name, slug |
| `products` | محصولات | name, barcode, quantity, buy/sell price |
| `customers` | مشتریان | full_name, phone, opening_balance |
| `invoices` | فاکتورها | invoice_number, total, status, currency |
| `invoice_items` | اقلام فاکتور | product_id, quantity, unit_price |
| `transactions` | تراکنش‌های مالی | type, amount, customer_id |

### 6.2 جداول Workflow

| جدول | توضیح |
|------|--------|
| `workflows` | قالب‌های گردش کار تأیید |
| `workflow_steps` | مراحل تأیید (approver_role, order) |
| `workflow_instances` | نمونه‌های در حال اجرا |
| `workflow_actions` | تاریخچه اقدامات (تأیید/رد) |

### 6.3 ایندکس‌های کلیدی

```sql
-- Products
products_user_id_idx, products_workspace_idx, products_barcode_idx

-- Invoices
invoices_user_status_idx (composite), invoices_user_created_idx (composite)
invoices_created_at_idx, invoices_status_idx

-- Transactions
transactions_customer_idx, transactions_type_idx

-- Workflow
workflow_instances_status_idx, workflow_instances_entity_idx
```

---

## 7. احراز هویت — Auth

### 7.1 فلو

```
POST /api/auth/signup → hash password (bcrypt, 12 rounds) → JWT
POST /api/auth/login  → verify password → JWT
GET  /api/auth/me     → return user profile
POST /api/auth/logout → clear cache
```

### 7.2 JWT

- **Secret:** `JWT_SECRET` env variable
- **Expiry:** 7 days
- **Payload:** `{ userId, email }`

### 7.3 Password Reset

1. `POST /api/auth/forgot-password` — تولید token (SHA-256 hash) + ارسال ایمیل
2. `POST /api/auth/reset-password` — verify token + update password via Supabase Admin API

### 7.4 Cache Optimization

- کش نتیجه auth (user + workspace + role) به مدت ۳۰ ثانیه
- کلید: `auth:{token}`
- کاهش ۲ کوئری به ۰ برای درخواست‌های تکراری

---

## 8. API Routes — فهرست کامل

### 8.1 Accounting (7 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/accounts` | لیست حساب‌ها |
| POST | `/api/accounts` | ایجاد حساب |
| GET | `/api/journal` | لیست اسناد حسابداری |
| POST | `/api/journal` | ایجاد سند حسابداری |
| GET | `/api/trial-balance` | تراز آزمایشی |
| GET | `/api/balance-sheet` | ترازنامه |
| GET | `/api/income-statement` | صورت سود و زیان |
| GET | `/api/cash-flow` | گردش نقدی |
| GET | `/api/customer-debt` | گزارش بدهی مشتریان |

### 8.2 AI (2 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| POST | `/api/ai/query` | پرسش به هوش مصنوعی |
| GET | `/api/ai/insights` | پیشنهادات هوشمند |

### 8.3 Analytics (4 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/analytics/dashboard` | KPIهای داشبورد |
| GET | `/api/analytics/sales` | خلاصه فروش |
| GET | `/api/analytics/inventory` | خلاصه موجودی |
| GET | `/api/analytics/financial` | خلاصه مالی |

### 8.4 Audit (6 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| POST | `/api/audit/log` | ثبت رویداد |
| GET | `/api/audit/logs` | لیست لاگ‌ها |
| GET | `/api/audit/entity/:type/:id` | تاریخچه یک موجودیت |
| GET | `/api/audit/user/:userId` | فعالیت کاربر |
| GET | `/api/audit/stats` | آمار |
| POST | `/api/audit/cleanup` | پاکسازی لاگ‌های قدیمی |

### 8.5 Auth (6 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| POST | `/api/auth/login` | ورود |
| POST | `/api/auth/signup` | ثبت‌نام |
| POST | `/api/auth/logout` | خروج |
| GET | `/api/auth/me` | پروفایل کاربر |
| POST | `/api/auth/forgot-password` | فراموشی رمز |
| POST | `/api/auth/reset-password` | بازنشانی رمز |
| PATCH | `/api/auth/profile` | ویرایش پروفایل |

### 8.6 Billing (5 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/billing/plans` | لیست پلن‌ها |
| GET | `/api/billing/subscription` | اشتراک فعلی |
| POST | `/api/billing/upgrade` | ارتقا |
| POST | `/api/billing/cancel` | لغو |
| GET | `/api/billing/usage` | میزان مصرف |

### 8.7 CRM (4 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/interactions` | تعاملات با مشتری |
| POST | `/api/interactions` | ثبت تعامل |
| GET | `/api/opportunities` | فرصت‌های فروش |
| POST | `/api/opportunities` | ایجاد فرصت |
| PATCH | `/api/opportunities/:id` | ویرایش فرصت |

### 8.8 Customers (6 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/customers` | لیست مشتریان |
| GET | `/api/customers/:id` | جزئیات مشتری |
| POST | `/api/customers` | ایجاد مشتری |
| PATCH | `/api/customers/:id` | ویرایش مشتری |
| DELETE | `/api/customers/:id` | حذف مشتری |
| GET | `/api/customers/:id/balance` | مانده حساب |

### 8.9 Events (5 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| POST | `/api/events/emit` | انتشار رویداد |
| POST | `/api/events/process` | پردازش pending |
| POST | `/api/events/seed` | مقداردهی اولیه |
| GET | `/api/events/stats` | آمار |
| POST | `/api/events/cleanup` | پاکسازی |

### 8.10 HR (15 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET/POST | `/api/departments` | دپارتمان‌ها |
| PATCH | `/api/departments/:id` | ویرایش دپارتمان |
| GET/POST | `/api/employees` | کارمندان |
| GET/PATCH | `/api/employees/:id` | جزئیات/ویرایش کارمند |
| GET/POST | `/api/attendance/:employeeId` | حضور و غیاب |
| PATCH | `/api/attendance/:id` | ویرایش حضور |
| GET/POST | `/api/payrolls` | حقوق و دستمزد |
| PATCH | `/api/payrolls/:id` | ویرایش حقوق |
| GET/POST | `/api/leaves` | مرخصی‌ها |
| PATCH | `/api/leaves/:id` | ویرایش مرخصی |

### 8.11 Invoices (5 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/invoices` | لیست فاکتورها |
| GET | `/api/invoices/:id` | جزئیات فاکتور |
| POST | `/api/invoices` | ایجاد فاکتور |
| PATCH | `/api/invoices/:id` | ویرایش فاکتور |
| DELETE | `/api/invoices/:id` | حذف فاکتور |
| GET | `/api/invoices/:id/pdf` | دانلود PDF |

### 8.12 Manufacturing (6 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET/POST | `/api/boms` | BOMها |
| PATCH | `/api/boms/:id` | ویرایش BOM |
| GET/POST | `/api/work-orders` | دستور کارها |
| PATCH | `/api/work-orders/:id` | ویرایش دستور کار |
| POST | `/api/work-orders/:id/complete` | تکمیل دستور کار |

### 8.13 Notifications (3 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/v1/notifications` | لیست نوتیفیکیشن‌ها |
| GET | `/api/v1/notifications/unread-count` | تعداد خوانده‌نشده |
| PATCH | `/api/v1/notifications/mark-read` | علامت‌گذاری خوانده‌شده |

### 8.14 Permissions (10 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/permissions` | لیست دسترسی‌ها |
| POST | `/api/permissions/seed` | مقداردهی اولیه |
| GET/POST | `/api/roles` | نقش‌ها |
| GET/PATCH/DELETE | `/api/roles/:id` | مدیریت نقش |
| GET/POST/DELETE | `/api/users/:userId/roles` | نقش‌های کاربر |
| GET | `/api/users/:userId/permissions` | دسترسی‌های کاربر |
| POST | `/api/permissions/check` | بررسی دسترسی |

### 8.15 Products (5 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/products` | لیست محصولات |
| GET | `/api/products/:id` | جزئیات محصول |
| POST | `/api/products` | ایجاد محصول |
| PATCH | `/api/products/:id` | ویرایش محصول |
| DELETE | `/api/products/:id` | حذف محصول |
| GET | `/api/products/low-stock` | محصولات کم‌موجود |

### 8.16 Projects (13 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET/POST | `/api/projects` | پروژه‌ها |
| GET/PATCH/DELETE | `/api/projects/:id` | مدیریت پروژه |
| GET/POST | `/api/projects/:id/tasks` | تسک‌ها |
| PATCH/DELETE | `/api/tasks/:id` | مدیریت تسک |
| GET/POST/DELETE | `/api/projects/:id/members` | اعضای پروژه |
| GET/POST | `/api/projects/:id/time-entries` | زمان‌سنجی |
| PATCH/DELETE | `/api/time-entries/:id` | مدیریت زمان |

### 8.17 Purchasing (3 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/purchase-orders` | سفارش‌های خرید |
| POST | `/api/purchase-orders` | ایجاد سفارش |
| PATCH | `/api/purchase-orders/:id` | ویرایش سفارش |
| POST | `/api/purchase-orders/:id/receive` | دریافت کالا |

### 8.18 Sync (2 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/sync/pull` | دریافت تغییرات سرور |
| POST | `/api/sync/push` | ارسال تغییرات کلاینت |

### 8.19 Transactions (4 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/transactions` | لیست تراکنش‌ها |
| POST | `/api/transactions` | ایجاد تراکنش |
| GET | `/api/transactions/balance/:customerId` | مانده مشتری |
| DELETE | `/api/transactions/:id` | حذف تراکنش |

### 8.20 Warehouse (7 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET | `/api/warehouses` | لیست انبارها |
| POST | `/api/warehouses` | ایجاد انبار |
| PATCH | `/api/warehouses/:id` | ویرایش انبار |
| DELETE | `/api/warehouses/:id` | حذف انبار |
| POST | `/api/stock-transfers` | انتقال موجودی |
| GET | `/api/warehouses/:id/stock` | موجودی انبار |

### 8.21 Workflow (9 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET/POST | `/api/v1/workflows` | قالب‌های گردش کار |
| GET/PATCH/DELETE | `/api/v1/workflows/:id` | مدیریت قالب |
| POST | `/api/v1/workflows/instances` | شروع گردش کار |
| GET | `/api/v1/workflows/instances` | لیست نمونه‌ها |
| GET | `/api/v1/workflows/instances/:id` | جزئیات نمونه |
| POST | `/api/v1/workflows/instances/:id/action` | اقدام (تأیید/رد) |

### 8.22 Workspace (10 endpoints)

| Method | Path | توضیح |
|--------|------|--------|
| GET/POST | `/api/workspaces` | فضاهای کاری |
| GET/PATCH | `/api/workspaces/:id` | مدیریت فضای کاری |
| GET | `/api/workspaces/:id/members` | اعضا |
| PATCH | `/api/workspaces/:id/members/role` | تغییر نقش |
| DELETE | `/api/workspaces/:id/members/:memberId` | حذف عضو |
| POST | `/api/workspaces/:id/leave` | خروج |
| GET/POST/DELETE | `/api/workspaces/:id/invites` | دعوت‌نامه‌ها |
| POST | `/api/workspaces/accept-invite` | پذیرش دعوت |

---

## 9. لایه سرویس — Services

### 9.1 فهرست کامل Serviceها (27 عدد)

| Service | فایل | توضیح |
|---------|------|--------|
| Accounting | `accounting.service.ts` | حسابداری دوبل (دفتر روزنامه، ترازنامه، سود و زیان) |
| AI | `ai.service.ts` | پردازش پرسش‌های طبیعی (فروش، موجودی، مشتریان) |
| Analytics | `analytics.service.ts` | KPIهای داشبورد، خلاصه فروش، موجودی، مالی |
| Audit | `audit.service.ts` | ثبت و خواندن لاگ‌های ممیزی |
| Auth | `auth.service.ts` | ثبت‌نام، ورود، بازیابی رمز |
| Billing | `billing.service.ts` | مدیریت اشتراک (Free, Pro, Enterprise) |
| Cache | `cache.service.ts` | Redis cache service (get/set/del/flush) |
| Checkout | `checkout.service.ts` | فرایند پرداخت (idempotent) |
| CRM | `crm.service.ts` | تعاملات مشتریان، فرصت‌های فروش |
| Customer | `customer.service.ts` | CRUD مشتریان + محاسبه مانده |
| Email | `email.service.ts` | ارسال ایمیل (Resend) + قالب‌های i18n |
| Entitlement | `entitlement.service.ts` | کنترل دسترسی بر اساس پلن |
| Event | `event.service.ts` | Event-driven architecture |
| HR | `human-resources.service.ts` | کارمندان، حضور، حقوق، مرخصی |
| Invoice | `invoice.service.ts` | ایجاد فاکتور + به‌روزرسانی موجودی |
| Job | `job.service.ts` | مدیریت background jobs |
| Manufacturing | `manufacturing.service.ts` | BOM، دستور کار تولید |
| Notification | `notification.service.ts` | نوتیفیکیشن‌های درون‌برنامه‌ای |
| Password Reset | `password-reset.service.ts` | توکن بازنشانی رمز |
| Permission | `permission.service.ts` | RBAC کامل (۳۳ permission پیش‌فرض) |
| Product | `product.service.ts` | CRUD محصولات + کم‌موجودی |
| Project | `project.service.ts` | پروژه، تسک، اعضا، زمان‌سنجی |
| Purchasing | `purchasing.service.ts` | سفارش خرید + دریافت کالا |
| Warehouse | `warehouse.service.ts` | انبارها + انتقال موجودی |
| Webhook | `webhook.service.ts` | پردازش Webhookهای پرداخت |
| Workflow | `workflow.service.ts` | موتور گردش کار تأیید |
| Workspace | `workspace.service.ts` | مدیریت فضاهای کاری |

### 9.2 الگوهای مشترک در Serviceها

```typescript
class SomeService {
  // 1. Cache Keys — کلیدهای کش استاندارد
  private getCacheKey(userId: string) { return `prefix:${userId}` }

  // 2. Column Selection — فقط ستون‌های مورد نیاز
  private readonly LIST_COLUMNS = 'id, name, status, created_at'

  // 3. Methods with cache + pagination
  async list(userId: string, filters: Filters) {
    const cached = await memoryCache.get(cacheKey)
    if (cached) return cached
    // ... query
    await memoryCache.set(cacheKey, result, ttl)
    return result
  }

  // 4. Invalidate cache after mutations
  private async invalidateCache(userId: string) {
    await memoryCache.invalidate(`prefix:${userId}:*`)
  }
}
```

---

## 10. Middlewareها

### 10.1 Arcjet (`arcjet.ts`)

- **Shield:** محافظت در برابر حملات عمومی
- **Bot Detection:** تشخیص و مسدودسازی بات‌ها (به‌جز موتورهای جستجو)
- **Token Bucket:** Rate limiting (10 req/s refill, 100 capacity)
- **Skipped:** `/api/health` از rate limit مستثنی است

### 10.2 Auth Middleware (`auth.middleware.ts`)

- `authenticate()` — preHandler برای همه routeهای محافظت‌شده
- کش ۳۰ ثانیه‌ای برای جلوگیری از کوئری تکراری
- `request.user`, `request.userId`, `request.workspaceId`, `request.userRole` را set می‌کند

### 10.3 Cache Middleware (`cache.middleware.ts`)

- فقط GET requests
- کلید: `{prefix}:{userId}:{url}`
- ذخیره خودکار پاسخ‌های 200
- Header: `X-Cache: HIT/MISS`

---

## 11. صف و پردازش غیرهمزمان — Queue

### 11.1 BullMQ PDF Queue (`queue/pdf-queue.ts`)

```
Client → POST /api/invoices → Invoice Service → pdfQueue.add()
                                              ↓
                                     BullMQ Worker (Redis)
                                              ↓
                              @react-pdf/renderer → Buffer
                                              ↓
                              Upload to Supabase Storage (pdf-cache bucket)
                                              ↓
                              Return signed URL (1 hour expiry)
```

- **Concurrency:** 3 worker
- **Retry:** 3 بار با exponential backoff (5s)
- **Cache:** MD5 hash از invoiceId + versionKey

### 11.2 In-Process Queue (`queue.ts`)

- صف ساده درون‌حافظه‌ای
- سه نوع job: `pdf`, `email`, `report`
- پردازش sequential با console logging

---

## 12. PDF Generation

### 12.1 InvoicePDFDocument.tsx

- **تکنولوژی:** `@react-pdf/renderer`
- **فونت:** Vazirmatn (Regular + Bold)
- **RTL:** `direction: 'rtl'`
- **بخش‌ها:**
  - Header (برند + شماره فاکتور + تاریخ + نام مشتری)
  - Status badge (تکمیل شده/در انتظار/لغو شده)
  - جدول اقلام (#, نام, تعداد, قیمت واحد, قیمت کل)
  - محاسبات (جمع، تخفیف، مالیات، مجموع، پرداختی، باقی‌مانده)
  - Footer

### 12.2 Invoice PDF Route

- `GET /api/invoices/:id/pdf`
- **Security:** ownership check (eq user_id)
- **Cache:** versioned path با updated_at
- **Response:** `Content-Type: application/pdf`, Cache-Control: private

---

## 13. کش و بهینه‌سازی

### 13.1 دو لایه کش

| لایه | پیاده‌سازی | TTL پیش‌فرض | کاربرد |
|------|-----------|------------|--------|
| Memory | `MemoryCache` (Map-based LRU) | 30s | Cache HTTP responses + query results |
| Redis | `CacheService` (ioredis) | 60s | Distributed cache, queue backend |

### 13.2 Redis Cache Service

```typescript
cacheService.get<T>(key)
cacheService.set<T>(key, value, ttl)
cacheService.del(key)
cacheService.delPattern(pattern)  // SCAN-based, not KEYS
cacheService.getOrSet(key, fn, ttl)
cacheService.healthCheck()
```

### 13.3 Cache Keys Convention

```
{domain}:{userId}:{resource}:{params}
// مثال:
dashboard:v2:{userId}
sales:{userId}:{startDate}:{endDate}
invoices:{userId}:page:{page}
products:{userId}:{filters}
```

### 13.4 Cache Invalidation Strategy

- **On Create/Update/Delete:** `memoryCache.invalidate('prefix:*')`
- **TTL-based expiry:** خودکار
- **User-specific:** هر کاربر کش جداگانه دارد

---

## 14. Job Scheduler و Cron Jobs

### 14.1 Job Scheduler Plugin

- **Interval:** هر ۶۰ ثانیه
- **Job Types:**
  - `CHECK_OVERDUE_INVOICES` — بررسی فاکتورهای سررسید شده + ارسال نوتیفیکیشن

### 14.2 Cron Scheduler

- **Trial Expiration Worker:** هر روز ساعت ۰۰:۰۰
  - دریافت trialهای منقضی‌شده
  - تغییر به plan free
  - ارسال ایمیل + نوتیفیکیشن

---

## 15. ایمیل و نوتیفیکیشن

### 15.1 Email Service

- **Provider:** Resend
- **i18n:** سه زبان (fa-IR, fa-AF, en)
- **Templates:**
  - Reset Password
  - Trial Started / Ending Soon / Expired
  - Payment Success / Failed
- **Queue:** ارسال sequential با فاصله ۲۰۰ms
- **Language Detection:** از `users.preferred_language`

### 15.2 Notification Service

- `POST /api/v1/notifications` — ایجاد نوتیفیکیشن
- `GET /api/v1/notifications` — لیست (با pagination)
- `GET /api/v1/notifications/unread-count` — تعداد خوانده‌نشده
- `PATCH /api/v1/notifications/mark-read` — علامت‌گذاری

---

## 16. Billing و اشتراک‌ها

### 16.1 Planها

| Plan | Invoices | Users | Workspaces | قیمت |
|------|----------|-------|------------|------|
| **Free** | 10 | 1 | 1 | رایگان |
| **Pro** | ∞ | 10 | 5 | $12/month |
| **Enterprise** | ∞ | ∞ | ∞ | سفارشی |

### 16.2 Trial

- **مدت:** ۷ روز (Pro features)
- **Grace Period:** ۷ روز اضافه
- **Auto-expire:** تبدیل به Free plan

### 16.3 Entitlement Service

```typescript
entitlements = {
  canUseAI, canExportPDF, canCreateTeam,
  canUseSSO, canManageUsers, canViewReports, canExportData,
  maxUsers, maxWorkspaces, maxInvoices
}
```

---

## 17. Workflow Engine

### 17.1 مفهوم

سیستم تأیید چندمرحله‌ای برای فرایندهای کسب‌وکار (مثلاً تأیید فاکتور > سقف مشخص)

### 17.2 مدل داده

```
Workflow (template)
  ├── Step 1: approver_role = "manager"
  ├── Step 2: approver_role = "owner", is_final = true
  └── ...

WorkflowInstance (اجرا)
  ├── status: in_progress | approved | rejected | cancelled
  ├── current_step: 2
  └── total_steps: 2

WorkflowAction (تاریخچه)
  ├── action: approved | rejected | forwarded | cancelled
  └── actor_user_id, comment
```

### 17.3 Events

- **pending:** درخواست تأیید جدید → نوتیفیکیشن به approver
- **approved:** تأیید شد → اگر final باشد workflow کامل می‌شود
- **rejected:** رد شد → workflow متوقف می‌شود

---

## 18. Observability و Monitoring

### 18.1 Health Checks

| Endpoint | کاربرد |
|----------|--------|
| `/api/health` | وضعیت کلی |
| `/live` | Liveness probe |
| `/ready` | Readiness probe (+ DB check) |
| `/api/slo` | SLO dashboard |

### 18.2 Performance Monitoring

- **Header:** `X-Response-Time-MS` در هر پاسخ
- **Slow Queries:** هشدار برای کوئری‌های > 500ms
- **DB Stats:** connectionCount, totalQueries, slowQueries

### 18.3 Error Handling

- **BaseError:** کلاس انتزاعی با `statusCode` و `isOperational`
- **AuthError (401):** خطاهای احراز هویت
- **ForbiddenError (403):** دسترسی غیرمجاز
- **NotFoundError (404):** منبع یافت نشد
- **ConflictError (409):** تداخل داده
- **DatabaseError (500):** خطاهای دیتابیس

---

## 19. امنیت

### 19.1 لایه‌های امنیتی

1. **Arcjet:** Anti-bot + Rate limiting
2. **CORS:** محدود به دامنه‌های hisabche.com
3. **Auth Middleware:** JWT verification روی همه routeها
4. **Row Level Security:** مالکیت داده‌ها (userId check)
5. **Input Validation:** Zod schema روی همه requestها
6. **Password Hashing:** bcrypt با 12 round
7. **Token Hashing:** SHA-256 برای password reset tokens
8. **Rate Limiting:** 100 req/min per user
9. **Security Headers:** X-Content-Type-Options, X-Frame-Options, X-XSS-Protection

### 19.2 Data Access Control

- هر کوئری شامل `eq('user_id', userId)` است
- workspace membership چک می‌شود
- permission-based access control (RBAC)

---

## 20. تنظیمات Production

### 20.1 Graceful Shutdown

```
SIGTERM/SIGINT → server.close() → exit(0)
```

### 20.2 Compression

- gzip + deflate
- Threshold: 1KB

### 20.3 CORS (Production)

```typescript
origin: [
  'https://hisabche.com',
  'https://www.hisabche.com',
  'https://app.hisabche.com',
]
```

---

## 21. Environment Variables

| متغیر | توضیح | پیش‌فرض |
|-------|--------|---------|
| `PORT` | پورت سرور | 10000 |
| `NODE_ENV` | محیط | development |
| `SUPABASE_URL` | آدرس Supabase | - |
| `SUPABASE_SERVICE_KEY` | Service Role Key | - |
| `SUPABASE_DATABASE_URL` | آدرس مستقیم PostgreSQL | - |
| `JWT_SECRET` | کلید JWT | - |
| `ARCJET_KEY` | کلید Arcjet | - |
| `RESEND_API_KEY` | کلید Resend | - |
| `REDIS_URL` | آدرس Redis | redis://localhost:6379 |
| `FRONTEND_URL` | آدرس فرانت‌اند | https://hisabche.com |
| `FROM_EMAIL` | ایمیل فرستنده | noreply@hisabche.com |

---

## 22. نقشه راه توسعه

### انجام شده ✅

- [x] Fastify server با ۲۳ route
- [x] ۲۷ سرویس کامل
- [x] PostgreSQL via Supabase
- [x] Redis caching
- [x] BullMQ PDF generation
- [x] Resend email service
- [x] Workflow engine
- [x] RBAC permissions
- [x] Offline sync endpoints
- [x] Rate limiting + anti-bot
- [x] Health checks

### در حال انجام ⏳

- [ ] تست E2E کامل
- [ ] CI/CD pipeline
- [ ] افزایش coverage تست‌ها
- [ ] مانیتورینگ با Sentry/DataDog

### آینده 📋

- [ ] GraphQL API
- [ ] Real-time subscriptions (Supabase Realtime)
- [ ] Multi-tenant isolation بهبودیافته
- [ ] Backup & Disaster Recovery خودکار
- [ ] Advanced Analytics Pipeline

---

> **نکته:** این مستندات بر اساس کد موجود در تاریخ ۲۰ ژوئیه ۲۰۲۶ تهیه شده است.  
> برای دریافت آخرین تغییرات به فایل‌های `CHANGELOG.md` و کامنت‌های `FIXED/OPTIMIZED` در سورس کد مراجعه کنید.