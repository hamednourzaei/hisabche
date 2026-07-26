# مستند معماری حسابچه (Hisabche)

> این سند به‌صورت خودکار و بر اساس خواندن مستقیم کدبیس (نه حدس) تهیه شده است. هر ادعا در این سند به یک مسیر فایل واقعی در ریپازیتوری ارجاع دارد. مسیرها، نام‌ها، جدول‌ها و شناسه‌های فنی به‌عمد به انگلیسی نگه داشته شده‌اند تا مستقیماً قابل جست‌وجو در کد باشند.

---

## فهرست مطالب

1. نمای کلی پروژه
2. درخت کامل ریپازیتوری
3. معماری فرانت‌اند
4. معماری بک‌اند
5. معماری دیتابیس
6. مستندات API
7. مستندات کامل صفحات
8. درخت کامپوننت‌ها
9. مستندات ماژول‌های کسب‌وکاری
10. جریان احراز هویت (Authentication Flow)
11. معماری Realtime
12. معماری Offline
13. لایه‌های کش (Caching)
14. جریان کامل داده (Data Flow)
15. گراف وابستگی‌ها (Dependency Graph)
16. درخت کل سیستم (System Tree)
17. تحلیل کارایی (Performance Analysis)
18. بررسی امنیتی (Security Review)
19. پیشنهادات بهبود
20. خلاصه مدیریتی (Executive Summary)

---

## ۱. نمای کلی پروژه (Project Overview)

### هدف

Hisabche یک نرم‌افزار ERP فارسی/دری برای کسب‌وکارهای کوچک و متوسط است — شامل صورت‌حساب (invoicing)، انبارداری، حسابداری، CRM، تولید (manufacturing)، خرید (purchasing)، منابع انسانی، مدیریت پروژه، صورت‌حساب اشتراک (billing/SaaS) و یک لایه‌ی هوش مصنوعی سبک برای پرسش‌های کسب‌وکاری. هدف اصلی محصول، پوشش کامل چرخه‌ی مالی و عملیاتی یک فروشگاه/شرکت کوچک با پشتیبانی از زبان‌های فارسی (fa)، دری (af) و انگلیسی (en) و تقویم شمسی (Jalali) است.

### سبک معماری

- **Monorepo** با npm workspaces، مدیریت‌شده با **Turborepo** (`turbo.json`, پایپ‌لاین‌های `build/dev/lint/test/type-check`).
- **Backend**: یک سرویس Fastify واحد و متمرکز (نه میکروسرویس) در `backend/`، که مستقیماً روی Supabase (Postgres + Auth + Storage) و Redis کار می‌کند.
- **Frontend web**: اپ Next.js 16 (App Router) با رندر ترکیبی (SSR برای صفحات عمومی/لندینگ، Client Components برای dashboard).
- **Frontend mobile**: اپ Expo/React Native جدا که همان پکیج‌های `store`/`api`/`ui`/`i18n` را با وب به اشتراک می‌گذارد.
- **لایه‌ی داده مشترک**: پکیج‌های `packages/*` که منطق دسترسی به API (TanStack Query hooks)، state سراسری (Zustand)، کامپوننت‌های UI، اعتبارسنجی (Zod) و ترجمه (i18next) را بین وب و موبایل به اشتراک می‌گذارند.
- الگوی غالب در بک‌اند **Route → Service → Supabase-js** است (نه یک معماری لایه‌ای کلاسیک با Repository/UseCase جدا)؛ هر route فایل مستقیماً یک کلاس Service را صدا می‌زند و آن Service مستقیماً با `supabase.from(...)` کار می‌کند.
- الگوی غالب در فرانت‌اند **Container/View** است: یک `*-container.tsx` که hookهای TanStack Query و state را نگه می‌دارد و یک `*-view.tsx` خالص presentational که فقط props می‌گیرد (نمونه‌ی مرجع: `packages/ui/src/components/ui/audit/`، `packages/ui/src/components/ui/activity/`).

### پشته‌ی فناوری (Technology Stack)

| لایه | فناوری |
|---|---|
| Backend framework | Fastify 5 |
| Database | Supabase (Postgres) — دسترسی منحصراً از طریق supabase-js با service-role key |
| ORM | Drizzle ORM (نصب‌شده و پیکربندی‌شده، ولی در عمل هیچ سرویسی از آن استفاده نمی‌کند — نگاه کنید به بخش ۵) |
| Cache/Queue | Redis از طریق ioredis؛ صف پس‌زمینه با BullMQ؛ زمان‌بندی با node-cron |
| Auth | Supabase Auth (GoTrue) + یک لایه‌ی JWT کش‌شده در بک‌اند |
| Frontend web | Next.js 16.2.6 (Turbopack)، React 19.2.6 |
| بین‌المللی‌سازی | next-intl (روتینگ) + i18next/react-i18next (متن UI) — **دو سیستم موازی و ناهم‌خوان، نگاه کنید به بخش ۱۷** |
| Data fetching | TanStack Query 5 + axios |
| State مدیریت | Zustand (با persist روی localStorage، برخی slice ها رمزنگاری‌شده با crypto-js) |
| UI | کتابخانه‌ی داخلی `@hisabche/ui` روی Radix UI، Tailwind CSS، Recharts، تقویم جلالی (`date-fns-jalali`, `jalaali-js`, `moment-jalaali`) |
| اعتبارسنجی | Zod (پکیج مشترک `@hisabche/validation`) |
| Mobile | Expo / React Native 0.74.2 |
| Email | Resend |
| PDF | `@react-pdf/renderer` + jsPDF/html2canvas |
| Analytics/Monitoring | PostHog، Sentry (`@sentry/nextjs`) |
| Rate limiting / امنیت | `@fastify/rate-limit`، Arcjet (`@arcjet/node` — کد آماده ولی ثبت‌نشده، بخش ۴) |

### ساختار Monorepo

```
hisabche/
├── apps/
│   ├── web/       ← Next.js 16، اپ اصلی وب
│   └── mobile/    ← Expo/React Native
├── backend/       ← سرویس Fastify واحد
├── packages/
│   ├── api/         ← TanStack Query hooks + axios client
│   ├── ui/          ← کتابخانه‌ی کامپوننت مشترک
│   ├── store/       ← Zustand slices مشترک
│   ├── i18n/        ← تنظیمات i18next + فایل‌های ترجمه
│   ├── validation/  ← اسکیمای Zod مشترک
│   ├── auth/        ← wrapper سبک روی Supabase Auth client-side
│   ├── db/          ← کلاینت Drizzle + Supabase + WatermelonDB (مصرف محدود)
│   ├── db-schema/   ← اسکیمای Drizzle (نسخه‌ی موازی db)
│   ├── offline/     ← زیرساخت آفلاین (Dexie/WatermelonDB — ناتمام)
│   ├── analytics/   ← wrapper PostHog/Sentry
│   └── config/      ← ماژول env مشترک
├── scripts/        ← اسکریپت‌های تحلیل/ابزار (نه بخشی از اپ زنده)
└── .github/workflows/check.yml   ← تنها پایپ‌لاین CI
```

---

## ۲. درخت کامل ریپازیتوری

```
hisabche/
├── apps/
│   ├── mobile/
│   │   ├── App.tsx                 ← shell دستی، بدون React Navigation
│   │   └── screens/                ← LoginScreen, OnboardingScreen, CustomersScreen,
│   │                                  InvoicesScreen, InvoiceDetailScreen, QuickInvoiceScreen,
│   │                                  ProductDetailScreen, SettingsScreen, SyncCenterScreen,
│   │                                  WarehouseScreen
│   └── web/
│       ├── proxy.ts                ← next-intl middleware (Next.js 16 "Proxy")
│       ├── next.config.js
│       ├── app/[lang]/
│       │   ├── i18n-config.ts      ← locales: fa, af, en — defaultLocale: fa
│       │   ├── layout.tsx          ← root layout
│       │   ├── providers.tsx       ← QueryClientProvider + I18nextProvider + ToastProvider
│       │   ├── heavy-providers.tsx ← Theme/Auth/Language/Analytics initializers (lazy)
│       │   ├── page.tsx            ← لندینگ عمومی (marketing)
│       │   ├── login/, signup/, forgot-password/, reset-password/, accept-invite/
│       │   └── (dashboard)/
│       │       ├── dashboard-layout.tsx
│       │       ├── layout.tsx
│       │       ├── constants/nav-items.ts
│       │       ├── page.tsx                 → /  (dashboard root)
│       │       ├── dashboard/page.tsx       → /dashboard
│       │       ├── accounting/page.tsx      → /accounting
│       │       ├── crm/page.tsx             → /crm
│       │       ├── manufacturing/page.tsx   → /manufacturing
│       │       ├── purchasing/page.tsx      → /purchasing
│       │       ├── invoices/, invoices/[id]/
│       │       ├── customers/
│       │       ├── warehouse/, warehouse/[id]/
│       │       ├── human-resources/, human-resources/[id]/
│       │       ├── projects/, projects/[id]/
│       │       ├── permissions/, audit/, activities/
│       │       ├── settings/, workspace/, sync-center/
│       │       ├── quick-invoice/, onboarding/
│       │       └── constants/
│       ├── e2e/                    ← Playwright
│       └── messages/{af,en,fa}/common.json  ← فایل‌های ترجمه‌ی جایگزین next-intl
├── backend/
│   ├── src/
│   │   ├── index.ts                ← bootstrap کامل Fastify
│   │   ├── db.ts                   ← Supabase admin client
│   │   ├── drizzle-schema.ts       ← اسکیمای Drizzle (بدون مصرف واقعی)
│   │   ├── routes/                 ← ۲۴ فایل route
│   │   ├── services/               ← ۲۹ فایل service
│   │   ├── middleware/             ← auth.middleware.ts, cache.middleware.ts, arcjet.ts
│   │   ├── errors/                 ← base.error.ts, database.error.ts, auth.error.ts
│   │   ├── utils/                  ← pagination.ts (memoryCache), cache.ts
│   │   ├── queue/                  ← pdf-queue.ts (BullMQ)، queue.ts (InProcessQueue)
│   │   ├── workers/                ← trial-expiration.worker.ts
│   │   ├── scheduler/              ← index.ts (node-cron wiring)
│   │   ├── plugins/                ← job-scheduler.plugin.ts
│   │   ├── websocket/              ← activity.ws.ts (ثبت‌نشده، مرده)
│   │   └── __tests__/
│   └── drizzle/migrations/         ← 0000_loose_bishop.sql، 0001_dry_avengers.sql
├── packages/
│   ├── api/src/
│   │   ├── lib/client.ts, tokenProvider.ts
│   │   ├── supabase/realtime.ts
│   │   └── hooks/                  ← ۳۰+ فایل hook (به تفکیک ماژول)
│   ├── ui/src/
│   │   ├── components/ui/          ← ~۴۰ زیرپوشه‌ی ماژول/کامپوننت
│   │   ├── hooks/, lib/, styles/
│   │   └── index.ts                ← barrel با ۱۰۵ export
│   ├── store/src/slices/           ← ۱۱ اسلایس Zustand
│   ├── i18n/src/locales/           ← fa-IR.json, fa-AF.json, en.json
│   ├── validation/src/schemas/     ← اسکیمای Zod به تفکیک دامنه
│   ├── auth/src/                   ← auth.ts, supabase.ts
│   ├── db/src/                     ← drizzle.schema.ts, client.ts, supabase/
│   ├── db-schema/src/              ← نسخه‌ی موازی drizzle.schema.ts
│   ├── offline/src/                ← database.web.ts, database.native.ts, sync/sync-queue.ts
│   ├── analytics/src/              ← posthog.ts, sentry.ts, index.ts
│   └── config/src/env.ts
├── scripts/                        ← analyze-database-dependencies.js/.ps1، generate-icons.js
├── drizzle.config.ts                ← پیکربندی Drizzle Kit (خروجی ناسازگار با مسیر واقعی migrations)
└── .github/workflows/check.yml      ← lint → build → api-test → e2e-test
```

> **توجه مهم:** پوشه‌ی `supabase/` در ریشه‌ی ریپازیتوری وجود ندارد. یعنی مدیریت اسکیمای دیتابیس از طریق CLI رسمی Supabase انجام نمی‌شود؛ تنها دو migration واقعی در `backend/drizzle/migrations/` وجود دارد که فقط ۱۱ جدول از حدود ۴۹ جدول واقعاً استفاده‌شده در بک‌اند را پوشش می‌دهد (جزئیات کامل در بخش ۵).

---

## ۳. معماری فرانت‌اند (Frontend Architecture)

### Layouts

- **Root layout** (`apps/web/app/[lang]/layout.tsx`): تنظیم `<html lang dir>` (RTL برای `fa`)، بارگذاری فونت Vazirmatn محلی، اسکریپت init تم (خواندن `localStorage.hisab-theme` پیش از hydration برای جلوگیری از FOUC)، Google Analytics، JSON-LD SEO، و پوشاندن children در `ClientErrorBoundary → Providers`.
- **Dashboard layout** (`apps/web/app/[lang]/(dashboard)/dashboard-layout.tsx`، از طریق `(dashboard)/layout.tsx`): ترکیب `CommandPalette` + `DashboardSidebar` (دسکتاپ) + `DashboardHeader` + `<main><Breadcrumb/>{children}</main>` + `BottomNav` (موبایل).

### Providers

سلسله‌مراتب providerها (`apps/web/app/[lang]/providers.tsx` → `heavy-providers.tsx`):

```
QueryClientProvider (staleTime=5min, retry=1, refetchOnWindowFocus=false)
 └─ I18nextProvider (instance از @hisabche/i18n)
     └─ ToastProvider (@hisabche/ui)
         └─ Suspense (fallback = children فوری)
             └─ HeavyProviders (lazy import, ssr:false)
                 ├─ AdaptiveUIInitializer   (تشخیص سخت‌افزار → CSS vars عملکردی)
                 ├─ AnalyticsBootstrap      (idle-load PostHog/Sentry)
                 └─ ThemeInitializer
                     └─ AuthInitializer     (شناسایی کاربر برای Analytics بعد از ۲ ثانیه)
                         └─ LanguageInitializer (sync زبان از localStorage بعد از ۱۰۰ms)
```

`QueryClient` به‌صورت **module-level singleton** ساخته می‌شود (نه با `useState`/`useMemo` per-mount)، پس در ناوبری کلاینت-ساید بین صفحات، مجدداً ساخته نمی‌شود — کش TanStack Query بین صفحات حفظ می‌شود.

### Hooks و Stores

- تمام دسترسی به API از طریق hookهای TanStack Query در `packages/api/src/hooks/*.ts` انجام می‌شود (فهرست کامل در بخش ۶).
- تمام state سراسری کلاینت (auth، تم، زبان، ارز، سبد خرید، ترجیحات، انبار انتخاب‌شده، وضعیت سینک) از طریق ۱۱ اسلایس Zustand در `packages/store/src/slices/` مدیریت می‌شود (فهرست کامل در بخش ۱۰ و ۱۲).
- کوپلینگ بین `api` و `store` **یک‌طرفه** طراحی شده: `packages/api` هیچ importی از `store` ندارد؛ در عوض `packages/api/src/lib/tokenProvider.ts` یک الگوی registration ارائه می‌دهد (`registerTokenGetter`) که `auth.slice.ts` در زمان بارگذاری ماژول آن را صدا می‌زند. این تصمیم معماری آگاهانه و درست است.

### TanStack Query

- تنظیمات پیش‌فرض: `staleTime: 5 دقیقه`, `retry: 1`, `refetchOnWindowFocus: false`, `mutations.retry: 0`.
- الگوی query-key factory در همه‌ی ماژول‌ها رعایت شده (`accountingKeys`, `crmKeys`, `invoiceKeys`, ...).
- **به‌روزرسانی داده بر پایه‌ی Supabase Realtime است، نه polling/refetchInterval ثابت** — این یک تصمیم معماری صریح در پروژه است (نگاه کنید به بخش ۱۱).

### Zustand

- بیشتر اسلایس‌ها `persist` می‌شوند روی `localStorage`؛ `auth.slice.ts` با AES (`crypto-js`) رمزنگاری می‌شود.
- برخی اسلایس‌ها (`cart`, `sync`, `warehouse`) عمداً persist نمی‌شوند چون state موقتی/session-محور هستند.

### سلسله‌مراتب کامپوننت

الگوی **Container/View** به‌صورت پایدار در ماژول‌های جدیدتر (audit، activity، crm، manufacturing، purchasing) رعایت شده: `<module>-view.tsx` (presentational، `memo`شده، بدون hook داده‌ای مستقیم) + `containers/<module>-container.tsx` (hookهای query/mutation + state + منطق). ماژول‌های قدیمی‌تر مثل accounting از یک الگوی متفاوت (`AccountingPage.tsx` + `tabs/` + `components/`) استفاده می‌کنند — یعنی **دو الگوی معماری کامپوننت به‌صورت موازی در پروژه وجود دارد**.

### استراتژی رندر

- صفحه‌ی لندینگ (`app/[lang]/page.tsx`): ISR با `revalidate = 3600` (۱ ساعت).
- صفحات dashboard: تماماً Client Component (`"use client"`), بدون SSR واقعی برای داده — بارگذاری داده کاملاً سمت کلاینت از طریق TanStack Query انجام می‌شود.
- صفحات auth (`login`, `signup`): با `next/dynamic` و `ssr:false` بارگذاری می‌شوند.

### کش

نگاه کنید به بخش ۱۳ برای جزئیات کامل لایه‌های کش (TanStack Query سمت کلاینت + Redis/in-memory سمت سرور).

### جریان ناوبری

`DashboardSidebar`/`BottomNav` از `NAV_ITEMS` در `apps/web/app/[lang]/(dashboard)/constants/nav-items.ts` تغذیه می‌شوند. آیتم‌های گروه `main`/`sales` همیشه نمایش داده می‌شوند (`PRIMARY_ITEMS`)؛ گروه‌های `business`/`team`/`system` داخل پنل «بیشتر» (`MORE_GROUPS`) پنهان می‌شوند. ناوبری با `router.push` + یک `optimisticPath` state (برای فعال‌شدن فوری لینک قبل از اتمام ناوبری واقعی) انجام می‌شود، و تا ۳ مسیر مرتبط با مسیر فعلی از پیش `prefetch` می‌شوند (`usePrefetchRoutes`).

---

## ۴. معماری بک‌اند (Backend Architecture)

### Fastify

نقطه‌ی ورود `backend/src/index.ts`. ترتیب bootstrap:

1. ساخت instance با logger پینو (pretty در dev).
2. Hookهای سراسری: `onRequest` (ثبت `startTime`)، `onSend` (هدر `X-Response-Time-MS` + هدرهای امنیتی + لاگ هشدار برای پاسخ‌های کندتر از ۵۰۰ms)، `preHandler` (**گیت سراسری احراز هویت** — صدا زدن `authenticate` برای همه‌ی درخواست‌ها به‌جز یک allowlist مسیرهای عمومی).
3. ثبت پلاگین‌ها به ترتیب: `@fastify/compress` → `@fastify/cors` → `@fastify/swagger` + `swagger-ui` (روی `/docs`) → `@fastify/rate-limit` (۱۰۰ درخواست/دقیقه، کلید = userId یا IP).
4. ثبت ۲۴ ماژول route (فهرست کامل در بخش ۶).
5. `listen` روی `0.0.0.0:PORT` و سپس راه‌اندازی `startScheduler()` (کرون‌جاب‌ها).
6. Graceful shutdown روی `SIGTERM`/`SIGINT`.

**نکته:** دو ماژول کاملاً پیاده‌سازی‌شده ولی هرگز ثبت‌نشده در `index.ts` وجود دارند: `middleware/arcjet.ts` (محافظت در برابر بات/rate-limit پیشرفته) و `websocket/activity.ws.ts` (اندپوینت `/ws/activities` روی `@fastify/websocket`) — کد مرده از منظر runtime.

### Plugins

- `@fastify/compress`, `@fastify/cors`, `@fastify/swagger` + `@fastify/swagger-ui`, `@fastify/rate-limit` — همگی در `index.ts` ثبت می‌شوند.
- `backend/src/plugins/job-scheduler.plugin.ts` — یک `setInterval` هر ۱۰ دقیقه که جدول عمومی `background_jobs` را برای job های در انتظار (فقط handler فعلی: `CHECK_OVERDUE_INVOICES`) پول می‌کند؛ طبق کامنت خود کد، در حال حاضر هیچ مسیر کدی job واقعی در این جدول insert نمی‌کند — یعنی یک شبکه‌ی ایمنی بدون مصرف عملی است.

### Routes → Controllers → Services

هیچ لایه‌ی «Controller» جدا وجود ندارد؛ هر فایل `routes/*.ts` مستقیماً handlerهای Fastify را با یک نمونه از کلاس Service مرتبط پر می‌کند. جدول کامل route↔service↔endpoints در بخش ۶ آمده.

### Middlewares

| فایل | نقش |
|---|---|
| `auth.middleware.ts` | تأیید JWT از طریق `supabase.auth.getUser(token)`، کش ۳۰ ثانیه‌ای نتیجه (کلید `auth:{token}`)، استخراج `workspace_id`/`role` از جدول `workspace_members` (پیش‌فرض role=`admin` اگر عضویتی یافت نشود) |
| `cache.middleware.ts` | کش کردن پاسخ کامل GETها بر اساس `{keyPrefix}:{userId}:{url}`، با هدر `X-Cache: HIT/MISS`؛ `clearCache(pattern)` برای invalidation |
| `arcjet.ts` | shield + bot detection + token-bucket rate limiting (**ثبت‌نشده در index.ts**) |

### Validation

اسکیمای Zod از `@hisabche/validation` در بیشتر route ها به‌صورت دوگانه استفاده می‌شود: هم برای تولید JSON-Schema جهت اعتبارسنجی خودکار Fastify/AJV و مستندسازی Swagger، و هم با فراخوانی دستی `schema.parse(request.body)` داخل handler. **استثنا**: `customer.routes.ts` و `product.routes.ts` اسکیمای مربوطه را import می‌کنند ولی هرگز `.parse()` صدا نمی‌زنند و آن را به `schema` روت هم متصل نمی‌کنند — این دو route عملاً بدون اعتبارسنجی Zod واقعی کار می‌کنند (فقط `request.body as any`).

### Error Handling

سلسله‌مراتب خطای سفارشی در `backend/src/errors/`:

```
BaseError (abstract, statusCode, isOperational)
 ├─ DatabaseError (500)
 ├─ NotFoundError (404)
 ├─ ConflictError (409)
 ├─ AuthError (401)
 ├─ ForbiddenError (403)
 └─ TokenExpiredError (401)
```

`server.setErrorHandler` سراسری این خطاها را می‌گیرد و `{statusCode, error, message, path, method}` برمی‌گرداند؛ `server.setNotFoundHandler` پاسخ ۴۰۴ ساختاریافته می‌دهد.

### Authentication / Authorization

نگاه کنید به بخش ۱۰ برای جریان کامل.

### Background Jobs

| مکانیزم | فایل | کار |
|---|---|---|
| BullMQ Queue+Worker (Redis) | `queue/pdf-queue.ts` | صف `pdf-generation` — رندر PDF فاکتور، آپلود روی باکت خصوصی Supabase Storage `pdf-cache`، URL امضاشده (TTL ۳۶۰۰ثانیه)، ۳ تلاش با backoff نمایی |
| صف درون‌پردازه‌ای ساده | `queue.ts` (`InProcessQueue`) | `queuePDFGeneration`, `queueEmail`, `queueReport` — fire-and-forget، بدون persistence |
| Cron (node-cron) | `scheduler/index.ts` | `0 0 * * *` → `TrialExpirationWorker.run()`؛ `*/3 * * * *` → `eventService.processPending()` (بازیابی رخدادهای ناتمام) |
| Interval پلاگین | `plugins/job-scheduler.plugin.ts` | هر ۱۰ دقیقه، جدول `background_jobs` (در حال حاضر بدون تولیدکننده‌ی واقعی) |

---

## ۵. معماری دیتابیس (Database Architecture)

### وضعیت واقعی Migration ها

تنها منبع migration واقعی در ریپازیتوری:

```
backend/drizzle/migrations/
├── 0000_loose_bishop.sql   ← اسکیمای اولیه: ۱۱ جدول + enum های workflow
└── 0001_dry_avengers.sql   ← افزودن ستون user_id به customers/invoices/products/transactions
```

هیچ پوشه‌ی `supabase/migrations` در ریپازیتوری وجود ندارد. `drizzle.config.ts` ریشه به `schema: './backend/src/drizzle-schema.ts'` و `out: './drizzle'` اشاره می‌کند که با مسیر واقعی خروجی (`backend/drizzle/migrations`) هم‌خوانی ندارد — نشانه‌ی پیکربندی ناقص/قدیمی.

### جدول‌های تعریف‌شده در Drizzle (منبع رسمی، ولی جزئی)

| جدول | ستون‌های کلیدی | ایندکس‌ها |
|---|---|---|
| `workspaces` | id, name, slug (unique), logo | — |
| `products` | id, workspace_id (FK), name, barcode, sku, category, quantity, unit, buy_price, sell_price, wholesale_price, min_stock_level, is_active, user_id | workspace, user_id, created_at, category, sku, barcode |
| `customers` | id, workspace_id (FK), full_name, phone, email, address, opening_balance, is_active, user_id | workspace, user_id, created_at, phone |
| `invoices` | id, workspace_id (FK), invoice_number, type, customer_id, supplier_id, date, due_date, subtotal/discount_total/tax_total/total/paid_amount, currency, payment_method, status, user_id | workspace, user_id, customer, status, invoice_number, date, (user_id+status)، (user_id+created_at) |
| `invoice_items` | id, invoice_id, product_id, product_name, quantity, unit_price, discount, total_price | invoice_id, product_id |
| `transactions` | id, workspace_id (FK), customer_id, supplier_id, type, amount, currency, description, reference, date, user_id | workspace, user_id, customer, date, type |
| `exchange_rates` | id, currency_code, rate, updated_at | currency_code, updated_at |
| `workflows` | id, workspace_id (FK), name, entity_type, is_active, deleted_at | workspace, entity_type, is_active |
| `workflow_steps` | id, workflow_id, step_order, approver_role, approver_user_id, is_final | workflow_id, approver_user_id |
| `workflow_instances` | id, workflow_id, workspace_id (FK), entity_type, entity_id, status(enum), current_step, total_steps | workflow, workspace, status, entity_id |
| `workflow_actions` | id, instance_id, step_order, action(enum), actor_user_id, actor_role | instance_id, actor_user_id |

Enum ها: `workflow_action` (approved/rejected/forwarded/cancelled)، `workflow_status` (pending/in_progress/approved/rejected/cancelled).

### جدول‌هایی که فقط در runtime وجود دارند (بدون تعریف Drizzle/Migration)

با grep روی تمام `backend/src/services/*.ts` به دنبال `.from('...')`، **۴۹ نام جدول متمایز** پیدا شد که فقط **۶ مورد** (`customers`, `invoices`, `invoice_items`, `products`, `transactions`, `workspaces`) در Drizzle تعریف شده‌اند. ۴۳ جدول باقی‌مانده (`accounts`, `journal_entries`, `journal_lines`, `interactions`, `opportunities`, `boms`, `bom_items`, `work_orders`, `purchase_orders`, `purchase_order_items`, `warehouses`, `warehouse_stock`, `stock_movements`, `departments`, `employees`, `attendance`, `payrolls`, `leaves`, `projects`, `project_tasks`, `project_members`, `project_time_entries`, `permissions`, `roles`, `role_permissions`, `user_roles`, `audit_logs`, `event_log`, `event_types`, `notifications`, `subscriptions`, `billing_events`, `checkout_sessions`, `webhook_events`, `password_reset_tokens`, `profiles`, `users`, `workspace_members`, `workspace_invites`, `ledger_entries`, و دو view: `ledger_entries_view`, `transactions_view`) **فقط از طریق رشته‌های `.from()` و `.select('col1, col2, ...')` در کد سرویس قابل استنتاج‌اند** — یعنی ساختار واقعی این جداول در هیچ فایل نسخه‌کنترل‌شده‌ای در ریپازیتوری موجود نیست و احتمالاً مستقیماً در Supabase Studio ساخته شده‌اند.

### RLS (Row Level Security)

**هیچ دستور `ENABLE ROW LEVEL SECURITY` یا `CREATE POLICY` در migration های واقعی وجود ندارد.** تمام ارجاعات به RLS در ریپازیتوری، در فایل‌های برنامه‌ریزی/manifest داخل پوشه‌ی `util/` (اسناد Markdown طراحی، نه اسکیمای اجراشده) یافت می‌شوند — مثلاً یک نمونه‌ی فرضی برای جدول `client_mutations` که در هیچ‌جای دیگر کد وجود ندارد.

از آنجا که `backend/src/db.ts` منحصراً از **service-role key** استفاده می‌کند (کلیدی که RLS را دور می‌زند)، حتی اگر RLS روی دیتابیس واقعی فعال باشد، مسیر کد بک‌اند از آن عبور می‌کند و اجرای مجوزها را **در لایه‌ی اپلیکیشن** (سرویس‌ها + `permission.service.ts` + بررسی `workspace_id`) انجام می‌دهد، نه در لایه‌ی دیتابیس.

### Functions / Triggers / Views

هیچ `CREATE FUNCTION`/`CREATE TRIGGER`/`CREATE VIEW` در migration های واقعی وجود ندارد. دو نام شبیه View (`ledger_entries_view`, `transactions_view`) در کد سرویس کوئری می‌شوند بدون تعریف در ریپازیتوری — شاهد دیگری بر مدیریت خارج از نسخه‌کنترل.

### الگوی دسترسی به داده

سه ماژول کلاینت DB به‌صورت موازی وجود دارند (`backend/src/db.ts`, `packages/db/src/client.ts`, `packages/db-schema/src/client.ts`)، هرکدام هم Drizzle و هم Supabase-js Export می‌کنند. اما grep کامل نشان می‌دهد **صفر** فراخوانی واقعی `db.select/insert/update/delete` (Drizzle) در کل `backend/src` وجود دارد، و **۳۰ فایل سرویس** از الگوی `supabase.from('table').select/insert/update/delete` استفاده می‌کنند. نتیجه: **Drizzle یک زیرساخت کامل ولی کاملاً مرده است**؛ منبع حقیقت واقعی، پروژه‌ی زنده‌ی Supabase است.

> **یافته‌ی امنیتی جانبی**: `packages/db/src/client.ts` و `drizzle.config.ts` (ریشه) هرکدام یک connection string/کلید anon واقعی و hardcoded دارند (شامل پسورد دیتابیس Postgres). نگاه کنید به بخش ۱۸.

---

## ۶. مستندات API

> Base path پیش‌فرض بک‌اند: `NEXT_PUBLIC_API_URL` (در فرانت) → معمولاً `.../api`. همه‌ی مسیرهای زیر به‌جز allowlist عمومی (`/api/auth/login`, `/api/auth/signup`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, `/api/health`, `/live`, `/ready`, `/docs`) از پیش‌هندلر سراسری `authenticate` عبور می‌کنند.

### Auth (`auth.routes.ts`)

| Method | Path | هدف | ورودی | خروجی | مجوز |
|---|---|---|---|---|---|
| POST | `/api/auth/signup` | ثبت‌نام | email, password, ... | `{user, token}` | عمومی |
| POST | `/api/auth/login` | ورود | email, password | `{user, token}` | عمومی |
| POST | `/api/auth/logout` | خروج | — | — | نیاز به توکن |
| GET | `/api/auth/me` | کاربر فعلی (کش ۶۰ ثانیه) | — | `user` | نیاز به توکن |
| POST | `/api/auth/forgot-password` | درخواست ریست پسورد | email | — | عمومی |
| POST | `/api/auth/reset-password` | تنظیم پسورد جدید | token, password | — | عمومی |
| PATCH | `/api/auth/profile` | ویرایش پروفایل | fullName, ... | user | نیاز به توکن |

### Accounting (`accounting.routes.ts`, prefix `/api/accounting`)

| Method | Path | جدول(های) دیتابیس |
|---|---|---|
| GET/POST | `/accounts` | `accounts` |
| GET/POST | `/journal` | `journal_entries`, `journal_lines` |
| GET | `/trial-balance` | `journal_lines` (تجمیع) |
| GET | `/balance-sheet` | `accounts`, `journal_lines` |
| GET | `/income-statement` | `accounts`, `journal_lines` |
| GET | `/cash-flow` | `transactions`/`journal_lines` |
| GET | `/customer-debt` | `customers`, `invoices` |

### CRM (`crm.routes.ts`)

| Method | Path | جدول |
|---|---|---|
| GET/POST | `/api/interactions` | `interactions` |
| GET/POST | `/api/opportunities` | `opportunities` |
| PATCH | `/api/opportunities/:id` | `opportunities` |

### Manufacturing (`manufacturing.routes.ts`)

| Method | Path | جدول |
|---|---|---|
| GET/POST | `/api/boms` | `boms`, `bom_items` |
| PATCH | `/api/boms/:id` | `boms` |
| GET/POST | `/api/work-orders` | `work_orders` |
| PATCH | `/api/work-orders/:id` | `work_orders` |
| POST | `/api/work-orders/:id/complete` | `work_orders` |

### Purchasing (`purchasing.routes.ts`)

| Method | Path | جدول |
|---|---|---|
| GET/POST | `/api/purchase-orders` | `purchase_orders`, `purchase_order_items` |
| PATCH | `/api/purchase-orders/:id` | `purchase_orders` |
| POST | `/api/purchase-orders/:id/receive` | `purchase_orders` |

### سایر ماژول‌ها (خلاصه)

| ماژول | فایل route | تعداد endpoint | جدول اصلی |
|---|---|---|---|
| Activity | activity.routes.ts | ۵ | (activities — از طریق ActivityService) |
| AI | ai.routes.ts | ۲ | `ledger_entries`, `invoices`, `products` (تجمیعی) |
| Analytics | analytics.routes.ts | ۴ | چندجدولی (تجمیعی) |
| Audit | audit.routes.ts | ۷ | `audit_logs` |
| Billing | billing.routes.ts | ۶ | `subscriptions`, `billing_events` |
| Customers | customer.routes.ts | ۶ | `customers` |
| Debug | debug.routes.ts | ۳ | — |
| Events | event.routes.ts | ۵ | `event_log`, `event_types` |
| Human Resources | human-resources.routes.ts | ۱۴ | `departments`, `employees`, `attendance`, `payrolls`, `leaves` |
| Invoices | invoice.routes.ts | ۵ | `invoices`, `invoice_items` |
| Invoice PDF | invoice-pdf.routes.ts | ۱ (با rate-limit اختصاصی ۱۰/دقیقه) | Supabase Storage `pdf-cache` |
| Notifications | notification.routes.ts | ۴ | `notifications` |
| Permissions | permission.routes.ts | ۹ | `permissions`, `roles`, `role_permissions`, `user_roles` |
| Products | product.routes.ts | ۶ | `products` |
| Projects | project.routes.ts | ۱۴ | `projects`, `project_tasks`, `project_members`, `project_time_entries` |
| Sync | sync.routes.ts | ۲ | متغیر (بسته به entity) |
| Transactions | transaction.routes.ts | ۴ | `transactions` |
| Warehouse | warehouse.routes.ts | ۶ | `warehouses`, `warehouse_stock`, `stock_movements` |
| Workflow | workflow.routes.ts | ۷ | `workflows`, `workflow_instances`, `workflow_actions` |
| Workspace | workspace.routes.ts | ۹ | `workspaces`, `workspace_members`, `workspace_invites` |

اعتبارسنجی همه‌ی این route ها (به‌جز استثنای customer/product ذکرشده در بخش ۴) با اسکیمای Zod از `@hisabche/validation` انجام می‌شود؛ مجوز عمدتاً از طریق حضور `authenticate` در preHandler تضمین می‌شود (نه بررسی صریح permission در بیشتر handlerها — نگاه کنید به بخش ۱۰).

---

## ۷. مستندات کامل صفحات (Complete Pages Documentation)

جدول زیر همه‌ی صفحات داخل `apps/web/app/[lang]/(dashboard)/` را با مسیر واقعی، کانتینر مصرفی، و hookهای اصلی نشان می‌دهد:

| Route | فایل | Container (@hisabche/ui) | Hookهای اصلی | Realtime |
|---|---|---|---|---|
| `/` | `(dashboard)/page.tsx` | `DashboardContainer` | `useDashboardKPIs`, `useDashboardSales`, `useAIInsights` | ✅ (invoices) |
| `/dashboard` | `dashboard/page.tsx` | همان `DashboardContainer` (re-export) | همان بالا | ✅ |
| `/accounting` | `accounting/page.tsx` | `AccountingPage` | `useAccounts`, `useJournalEntries`, `useTrialBalance`, `useBalanceSheet`, `useIncomeStatement`, `useCreateAccount` | ✅ (accounts, journal_entries, journal_lines) |
| `/crm` | `crm/page.tsx` | `CrmContainer` | `useInteractions`, `useOpportunities` | ✅ (interactions, opportunities) |
| `/manufacturing` | `manufacturing/page.tsx` | `ManufacturingContainer` | `useBOMs`, `useWorkOrders`, `useCompleteWorkOrder` | ✅ (boms, work_orders) |
| `/purchasing` | `purchasing/page.tsx` | `PurchasingContainer` | `usePurchaseOrders`, `useReceiveGoods` | خیر (فقط useQuery معمولی — بدون useRealtime) |
| `/invoices` | `invoices/page.tsx` | `InvoicesContainer` | `useInvoices`, `useCreateInvoice` | ✅ |
| `/invoices/[id]` | `invoices/[id]/page.tsx` | `InvoiceDetailContainer` | `useInvoice`, PDF export | — |
| `/customers` | `customers/page.tsx` | `CustomersClient` (محلی) | `useCustomers`, `useCreateCustomer` | ✅ |
| `/warehouse` | `warehouse/page.tsx` | `WarehouseClient` (محلی) | `useProducts` | ✅ |
| `/warehouse/[id]` | `warehouse/[id]/page.tsx` | `ProductDetailContainer` | `useProduct` | — |
| `/human-resources` | `human-resources/page.tsx` | `HumanResourcesContainer` | `useEmployees` | — |
| `/human-resources/[id]` | `human-resources/[id]/page.tsx` | `EmployeeDetailContainer` | `useEmployee` | — |
| `/projects` | `projects/page.tsx` | `ProjectsContainer` | `useProjects` | — |
| `/projects/[id]` | `projects/[id]/page.tsx` | `ProjectDetailContainer` | `useProject`, `useProjectTasks` | — |
| `/permissions` | `permissions/page.tsx` | `PermissionsContainer` | `useRoles`, `usePermissions` | — |
| `/audit` | `audit/page.tsx` | `AuditContainer` | `useAuditLogs` | — |
| `/activities` | `activities/page.tsx` | `ActivitiesPage` | `useActivities`, `useInfiniteActivities` | ✅ (فقط INSERT) |
| `/settings` | `settings/page.tsx` | `SettingsPage` | چندگانه | — |
| `/workspace` | `workspace/page.tsx` | `WorkspaceContainer` | `useWorkspaces`, `useWorkspaceMembers` | ✅ |
| `/sync-center` | `sync-center/page.tsx` | `SyncCenterContainer` | `useSyncStore`, `useBackupStore` (بدون API واقعی) | — |
| `/quick-invoice` | `quick-invoice/page.tsx` | `QuickInvoiceContainer` | `useCreateInvoice` | — |
| `/onboarding` | `onboarding/page.tsx` | `OnboardingContainer` | `useOnboardingStore` | — |

### صفحات خارج از dashboard

| Route | فایل | هدف |
|---|---|---|
| `/` (بدون dashboard) | `app/[lang]/page.tsx` | لندینگ عمومی (`LandingPage`)، ISR ۱ ساعته، پشت `AuthGate` |
| `/login` | `login/page.tsx` | ورود |
| `/signup` | `signup/page.tsx` | ثبت‌نام |
| `/forgot-password` | `forgot-password/page.tsx` | درخواست ریست پسورد |
| `/reset-password` | `reset-password/page.tsx` | تنظیم پسورد جدید |
| `/accept-invite` | `accept-invite/page.tsx` | پذیرش دعوت workspace |

### مجوز و Cache Strategy مشترک برای همه‌ی صفحات dashboard

- همه پشت `useRedirectGuard` هستند: بدون احراز هویت → `/login`؛ احراز هویت‌شده ولی onboarding ناتمام → `/onboarding`.
- کش داده در سطح صفحه از طریق `staleTime` پیش‌فرض TanStack Query (۵ دقیقه) است؛ به‌روزرسانی زودتر از طریق Supabase Realtime (بخش ۱۱) رخ می‌دهد، نه refetch دوره‌ای.
- Offline support واقعی وجود ندارد (بخش ۱۲)؛ فقط `sync-center` و `offline-banner` رابط بصری نمایش می‌دهند.

---

## ۸. درخت کامپوننت‌ها (Component Tree)

`packages/ui/src/index.ts` یک barrel با **۱۰۵ export** است که از حدود ۹۷ زیرماژول در `packages/ui/src/components/ui/` بازصادر می‌کند:

```
@hisabche/ui
├── primitives/  (button, card, input, dialog, dropdown-menu, select, sheet,
│                 table, badge, toast, skeleton, switch, progress, accordion, breadcrumb)
├── accounting/       → AccountingPage, AccountingTabs, tabs/*, components/*
├── activity/         → ActivityCenter, ActivityTimeline, ActivityItem,
│                       VirtualizedActivityList, CommandPalette, RealtimeStatus, SyncStatus
├── audit/            → audit-view.tsx + containers/audit-container.tsx
├── auth/             → AuthShell + containers/
├── billing/          → BillingStatus, PricingPage, UsageWidget
├── crm/               → crm-view.tsx + containers/crm-container.tsx
├── customers/        → customer-360-header, customer-detail-view, customer-list,
│                       customer-stats, customer-workspace, AddCustomerModal, datagrid/
├── dashboard/        → dashboard-view, dashboard-stats, ai-insights,
│                       business-health-panel, sales-chart, dashboard-invoices
├── human-resources/  → hr-view.tsx, employee-detail-view.tsx
├── invoice-detail/   → invoice-detail-page.tsx, InvoicePDFDownload.tsx
├── invoices/         → invoices-view, invoices-card, invoices-skeleton
├── landing/          → cinematic-hero, pain-scene, features-scene, pricing-scene,
│                       faq-scene, security-scene, social-scene, ...
├── manufacturing/    → manufacturing-view.tsx + containers/manufacturing-container.tsx
├── navigation/       → side-nav, top-nav, navigation-registry
├── notification-bell/→ EntityActivityCard.tsx
├── onboarding/       → onboarding-page.tsx + containers/
├── permissions/      → permissions-view.tsx + containers/
├── projects/         → projects-view.tsx, project-detail-view.tsx
├── purchasing/       → purchasing-view.tsx + containers/purchasing-container.tsx
├── quick-invoice/    → quick-invoice-page.tsx + containers/
├── settings/         → settings-page.tsx
├── sync-center/      → sync-center-page.tsx + containers/
├── warehouse/        → warehouse-view, warehouse-product-list, warehouse-stats
├── workflow/         → approval-actions.tsx, approval-timeline.tsx
└── workspace/        → workspace-page.tsx + containers/
```

الگوی طراحی رنگ: توکن‌های خام HSL در `packages/ui/src/styles/globals.css` (`--color-primary`, `--color-success`, `--surface-base/muted/elevated`, `--fg-primary/secondary/tertiary`, `--border-default`) که همه‌جا با `hsl(var(--token-name))` مصرف می‌شوند (نه رنگ hardcoded). ابزارهای کمکی مشترک: `cn()`, `formatCurrency()`, `formatDate()` در `packages/ui/src/lib/utils.ts`.

---

## ۹. مستندات ماژول‌های کسب‌وکاری (Module Documentation)

| ماژول | Backend Service | Backend Routes | Frontend Hooks | Frontend UI |
|---|---|---|---|---|
| **Accounting** | `accounting.service.ts` | `/api/accounting/*` | `packages/api/src/hooks/accounting.ts` | `packages/ui/.../accounting/` |
| **CRM** | `crm.service.ts` | `/api/interactions`, `/api/opportunities` | `hooks/crm.ts` | `packages/ui/.../crm/` |
| **Inventory/Warehouse** | `warehouse.service.ts`, `product.service.ts` | `/api/warehouses`, `/api/products` | `hooks/products.ts` | `packages/ui/.../warehouse/` |
| **Manufacturing** | `manufacturing.service.ts` | `/api/boms`, `/api/work-orders` | `hooks/manufacturing.ts` | `packages/ui/.../manufacturing/` |
| **Purchasing** | `purchasing.service.ts` | `/api/purchase-orders` | `hooks/purchasing.ts` | `packages/ui/.../purchasing/` |
| **Projects** | `project.service.ts` | `/api/projects/*`, `/api/tasks/*` | `hooks/projects.ts` | `packages/ui/.../projects/` |
| **HR** | `human-resources.service.ts` | `/api/departments`, `/api/employees`, `/api/attendance`, `/api/payrolls`, `/api/leaves` | `hooks/employees.ts` | `packages/ui/.../human-resources/` |
| **Billing** | `billing.service.ts`, `checkout.service.ts`, `entitlement.service.ts`, `webhook.service.ts` | `/api/billing/*` | `hooks/billing.ts` | `packages/ui/.../billing/` |
| **Notifications** | `notification.service.ts` | `/api/v1/notifications*` | `hooks/notifications.ts` | `notification-bell/` |
| **Workspaces** | `workspace.service.ts` | `/api/workspaces/*` | `hooks/workspace.ts` | `packages/ui/.../workspace/` |
| **Permissions** | `permission.service.ts` | `/api/permissions`, `/api/roles*` | `hooks/permissions.ts` | `packages/ui/.../permissions/` |
| **AI** | `ai.service.ts` | `/api/ai/query`, `/api/ai/insights` | (مصرف در dashboard `ai-insights`) | `dashboard/ai-insights.tsx` |
| **Sync** | `sync.routes.ts` (بدون service مستقل مشاهده‌شده) | `/api/sync/pull`, `/api/sync/push` | `useSyncStore` | `sync-center/` |
| **Workflow** | `workflow.service.ts` | `/api/v1/workflows*` | `hooks/use-workflow.ts` | `workflow/` |
| **Invoices** | `invoice.service.ts`, صف PDF | `/api/invoices*` | `hooks/invoices.ts` | `invoices/`, `invoice-detail/` |
| **Customers** | `customer.service.ts` | `/api/customers*` | `hooks/customers.ts` | `customers/` |
| **Audit** | `audit.service.ts` | `/api/audit/*` | `hooks/audit.ts` | `audit/` |
| **Activity** | `activity.service.ts` | `/api/v1/activities*` | `hooks/activity.ts`, `useRealtimeActivities.ts` | `activity/` |

### توضیح ماژول AI (تفصیلی)

`ai.service.ts` یک موتور LLM واقعی **نیست** — یک موتور تطبیق کلیدواژه (فارسی/دری/انگلیسی: فروش/sale، موجودی/stock، مشتری/customer، سود/profit، هزینه/cost) است که پرس‌وجو را به یکی از handlerهای `handleSalesQuery`, `handleInventoryQuery`, `handleCustomerQuery`, `handleFinancialQuery`, `handleExpenseQuery`, یا یک fallback `handleGeneralQuery` هدایت می‌کند. `getInsights` هم یک کارت خلاصه‌ی روزانه‌ی کش‌شده (۱۲۰ ثانیه) از موجودی کم، فاکتورهای پرداخت‌نشده و فروش ۷ روز اخیر تولید می‌کند.

---

## ۱۰. جریان احراز هویت (Authentication Flow)

### نکته‌ی مهم معماری: سه مسیر auth موازی

تحقیق کامل کد نشان می‌دهد **سه پیاده‌سازی auth مستقل** در پروژه وجود دارد که کاملاً هم‌پوشانی ندارند:

1. **`packages/auth`** — یک wrapper نازک روی Supabase Auth SDK (`signIn/signUp/signOut/getSession/onAuthChange` در `packages/auth/src/auth.ts`). این پکیج در فرانت وب **عملاً برای فرایند ورود واقعی استفاده نمی‌شود**.
2. **`packages/api/src/hooks/auth.ts`** — hookهای TanStack Query (`useLogin`, `useSignUp`) که از طریق `apiClient.post('/auth/login')` به بک‌اند وصل می‌شوند و توکن را در `localStorage['hisabche-token']` ذخیره می‌کنند.
3. **`packages/store/src/slices/auth.slice.ts`** — اسلایس Zustand که پیاده‌سازی **مستقل خودش** از `login/signup/logout` را دارد، مستقیماً با `fetch()` خام به `${NEXT_PUBLIC_API_URL}/auth/login|signup|logout` (بدون عبور از `apiClient` یا hookهای بالا)، و state را با AES رمزنگاری‌شده در `localStorage['hisabche-auth']` نگه می‌دارد. این اسلایس شامل یک **ورود دمو hardcoded** (`demo@hisabche.com` / `Demo1234`) هم هست.

**فقط مسیر شماره‌ی ۳ (Zustand store) واقعاً کنترل apiClient را در دست دارد**: در زمان بارگذاری ماژول (سمت مرورگر)، `auth.slice.ts` تابع `registerTokenGetter(() => useAuthStore.getState().token)` را از `@hisabche/api` صدا می‌زند — این دقیقاً همان مکانیزمی است که به `apiClient` اجازه می‌دهد بدون وابستگی مستقیم به Zustand، توکن جاری را بخواند.

### جریان کامل: از ورود تا فراخوانی API محافظت‌شده

```
کاربر فرم لاگین را submit می‌کند
  ↓
useAuthStore.login(email, password)         [packages/store/auth.slice.ts]
  ↓
fetch(`${NEXT_PUBLIC_API_URL}/auth/login`)   ← نه از طریق apiClient
  ↓
POST /api/auth/login  [backend/src/routes/auth.routes.ts]
  ↓
supabase.auth.signInWithPassword(...)
  ↓
پاسخ { user, token } → ست‌شدن در Zustand state → persist رمزنگاری‌شده در localStorage['hisabche-auth']
  ↓
(در سمت کلاینت، از قبل ثبت شده بود): tokenProvider.registerTokenGetter(...)
  ↓
از این پس، هر فراخوانی apiClient:
  apiClient.interceptors.request → waitForTokenReady() → getToken() → Authorization: Bearer <token>
  ↓
درخواست به بک‌اند می‌رسد
  ↓
authenticate middleware [backend/src/middleware/auth.middleware.ts]
  → memoryCache.get(`auth:${token}`)  (کش ۳۰ ثانیه‌ای، بخش ۱۳)
  → در صورت miss: supabase.auth.getUser(token)  (تماس واقعی با سرور Auth سوپابیس)
  → کوئری workspace_members برای role/workspace_id
  → request.user/userId/workspaceId/userRole ست می‌شود
  ↓
handler مربوطه اجرا می‌شود
```

### مدیریت ۴۰۱

پاسخ‌دهنده‌ی axios (`packages/api/src/lib/client.ts`) روی `status===401` فقط `onUnauthorized?.()` را صدا می‌زند (بدون logout خودکار یا حلقه‌ی redirect). این callback از طریق `setOnUnauthorized` توسط `auth.slice.ts` ثبت می‌شود.

### Permissions/RBAC

دو مدل موازی مجوز وجود دارد:
- **مدل ساده** در `auth.middleware.ts`: فقط یک رشته‌ی `role` (`owner`/`admin`/`member`/`viewer`) از `workspace_members` استخراج می‌شود.
- **مدل کامل RBAC** در `permission.service.ts`: جداول `permissions`, `roles`, `role_permissions`, `user_roles`، با متد `hasPermission(userId, code)`.

بر اساس بررسی کد route ها، متد `hasPermission` **در هیچ route محافظت‌شده‌ای صراحتاً enforce نمی‌شود** — یعنی مدل کامل RBAC عمدتاً برای مدیریت UI نقش‌ها (`/permissions`) استفاده می‌شود، نه به‌عنوان gate واقعی روی endpoint های حساس. این یک شکاف امنیتی بالقوه است (بخش ۱۸).

---

## ۱۱. معماری Realtime

جایگزین صریح polling/`refetchInterval` در این پروژه، **Supabase Realtime روی `postgres_changes`** است:

- `packages/api/src/supabase/realtime.ts` → `subscribeToChannel(table, callback)`: کانال با نام `hisabche-{table}` می‌سازد، روی `{event:'*', schema:'public', table}` subscribe می‌کند، و روی هر تغییر callback را صدا می‌زند. از یک **کلاینت Supabase تک‌نمونه‌ای مشترک** (`packages/auth/src/supabase.ts`، با `globalThis.__hisabche_supabase_client__` برای بقا در برابر Fast Refresh) استفاده می‌کند — این عمداً برای رفع باگ قبلی «Multiple GoTrueClient instances» انجام شده.
- `packages/api/src/hooks/useRealtime.ts` → هوک عمومی، پشت `useAuthReady()`، که روی هر تغییر فقط `queryClient.invalidateQueries({queryKey})` را صدا می‌زند (بدون merge دستی داده).
- `useRealtimeActivities.ts` یک استثناست: به‌جای invalidate ساده، یک **merge خوش‌بینانه** (`setQueryData`) روی کش فعالیت‌ها انجام می‌دهد و فقط رویداد `INSERT` را گوش می‌دهد.

### جدول‌های مشترک‌شده از طریق Realtime (بر اساس استفاده‌ی واقعی در hookها)

`workspaces`, `workspace_members`, `invoices`, `customers`, `products`, `accounts`, `journal_entries`, `journal_lines`, `purchase_orders`, `interactions`, `opportunities`, `notifications`, `projects`, `project_tasks`, `boms`, `work_orders`.

> **یافته:** ماژول Purchasing UI (`usePurchaseOrders`/`usePurchaseOrder`) با `useQuery` ساده پیاده‌سازی شده و **useRealtime ندارد** — یعنی صفحه‌ی `/purchasing` تازه‌سازی زنده نمی‌گیرد و فقط بر `staleTime` پنج‌دقیقه‌ای تکیه دارد؛ ناسازگار با بقیه‌ی ماژول‌های تجاری (accounting/crm/manufacturing) که همگی realtime دارند.

---

## ۱۲. معماری Offline

**نتیجه‌ی کلیدی: زیرساخت آفلاین در این پروژه پیاده‌سازی‌شده نیست — فقط داربست (scaffolding) و رابط بصری وجود دارد.**

- `packages/offline` بر پایه‌ی WatermelonDB (موبایل) و Dexie/IndexedDB (وب) طراحی شده، اما:
  - `database.native.ts`، `database.web.ts` و `sync/sync-queue.ts` هرکدام یک تابع `performSync()`/`process()` دارند که **صراحتاً TODO و stub** هستند (فقط `{success:true}` برمی‌گردانند یا کامنت `// TODO` دارند).
  - **`apps/mobile/package.json` اصلاً وابستگی `@nozbe/watermelondb` را ندارد** — یعنی حتی اگر کد WatermelonDB کامل بود، در اپ موبایل واقعی build/اجرا نمی‌شود.
- `packages/store/src/slices/sync.slice.ts` (`useSyncStore`) فقط `navigator.onLine` و شمارنده‌های دستی `pendingCount` را نگه می‌دارد؛ منطق صف/شبکه‌ی واقعی ندارد.
- `packages/store/src/slices/backup.slice.ts` (`useBackupStore`) یک «بکاپ» می‌سازد که صرفاً تمام کلیدهای `localStorage` با پیشوند `hisabche-` را serialize کرده و دوباره در خود `localStorage` ذخیره می‌کند — **هیچ آپلود سروری وجود ندارد**.
- صفحه‌ی `/sync-center` (`sync-center-page.tsx`) کاملاً presentational است: «Sync Now» فقط `setLastSynced(Date.now())` صدا می‌زند (بدون تماس شبکه)، «Manual Backup» یک حجم فایل **جعلی با `Math.random()`** تولید می‌کند، و اندازه‌ی حافظه‌ی نمایش‌داده‌شده یک رشته‌ی **hardcoded «۲۴ مگابایت»** است.
- `useOfflineActivities.ts` یک کش «آفلاین» با یک `Map` **در حافظه** (نه IndexedDB/WatermelonDB) پیاده می‌کند که با هر رفرش صفحه از بین می‌رود.

**جمع‌بندی**: مکانیزم واقعی تفکیک تعارض (conflict resolution)، Push/Pull واقعی، یا صف پایدار در کد وجود ندارد. این یکی از بزرگ‌ترین شکاف‌های بین ادعای معماری (که در برخی اسناد داخل `util/` به‌عنوان «آفلاین-اول» توصیف شده) و پیاده‌سازی واقعی است.

---

## ۱۳. لایه‌های کش (Caching)

### سمت سرور

```
CacheService (backend/src/services/cache.service.ts)
  └─ ioredis روی REDIS_URL (پیش‌فرض redis://localhost:6379)
       TTLها: SHORT=30s, DEFAULT=60s, LONG=300s, VERY_LONG=600s, HOUR=3600s, DAY=86400s
       متدها: get/set/setShort/setLong/del/delPattern(SCAN)/exists/getTTL/incr/getOrSet/flush
       ✅ Fallback درون‌حافظه‌ای (Map، سقف ۵۰۰۰ ورودی) وقتی isConnected=false —
          این fallback اخیراً اضافه شده تا وقتی Redis در دسترس نیست،
          auth.middleware.ts هر درخواست را uncached به supabase.auth.getUser()
          نفرستد (نگاه کنید به بخش ۱۷ برای جزئیات این باگ و رفع آن).

memoryCache (backend/src/utils/pagination.ts)
  └─ wrapper نازک روی CacheService (با وجود نامش، در واقع Redis-backed است،
     نه یک Map درون‌پردازه‌ای — این تغییر عمداً انجام شده چون در استقرار
     چند-نمونه‌ای، کش Map محلی باعث می‌شد invalidation روی یک نمونه
     برای نمونه‌های دیگر دیده نشود)
```

مصرف‌کنندگان اصلی: `auth.middleware.ts` (کش ۳۰ ثانیه‌ای نتیجه‌ی تأیید توکن)، `cache.middleware.ts` (کش کامل پاسخ GET با هدر `X-Cache`)، و اکثر کلاس‌های Service (الگوی `getOrSet`/`invalidateCache` برای cache نتایج کوئری‌های سنگین مثل analytics، billing، audit).

### سمت کلاینت

TanStack Query با `staleTime: 5 دقیقه`, `retry: 1`, `refetchOnWindowFocus: false` (`apps/web/app/[lang]/providers.tsx`). به‌روزرسانی زودتر از این پنجره فقط از طریق invalidate شدن با Supabase Realtime رخ می‌دهد (بخش ۱۱)، نه polling.

### مرورگر

هدرهای کش استاتیک برای `/fonts/*` و `/_next/static/*` (immutable, یک‌ساله) و SWR (`stale-while-revalidate`) برای `/images/*`، `/` و `/en` در `apps/web/next.config.js`.

---

## ۱۴. جریان کامل داده (Complete Data Flow)

نمونه‌ی نوعی برای یک صفحه‌ی dashboard (مثلاً `/crm`):

```
کاربر
  ↓ ناوبری (router.push)
apps/web/app/[lang]/(dashboard)/crm/page.tsx
  ↓ رندر
CrmContainer  (packages/ui/.../crm/containers/crm-container.tsx)
  ↓ فراخوانی هوک
useInteractions() / useOpportunities()   (packages/api/src/hooks/crm.ts)
  ↓ TanStack Query
apiClient.get('/interactions')           (packages/api/src/lib/client.ts)
  ↓ HTTP (axios) + Authorization: Bearer <token>
Fastify  →  preHandler سراسری: authenticate  (بخش ۱۰، با کش ۳۰ ثانیه‌ای Redis)
  ↓
crm.routes.ts → GET /api/interactions
  ↓
CrmService.listInteractions(userId, customerId)  (backend/src/services/crm.service.ts)
  ↓
supabase.from('interactions').select(...).eq('user_id', userId)
  ↓
Postgres (پروژه‌ی Supabase)
  ↓ پاسخ
CrmService برمی‌گرداند { interactions, total, page, limit, totalPages }
  ↓
route فقط result.interactions را reply.send می‌کند (فرمت آرایه‌ی خام، مطابق نوع Interaction[] در هوک)
  ↓
apiClient response interceptor → response.data
  ↓
useInteractions() → data برمی‌گردد به CrmContainer
  ↓
CrmView (پیور presentational) با props نمایش داده می‌شود

به‌موازات این مسیر:
useRealtime({table:'interactions', queryKey: crmKeys.all})
  ↓
supabaseClient.channel('hisabche-interactions').on('postgres_changes', {event:'*'}, ...)
  ↓ هر INSERT/UPDATE/DELETE در جدول interactions
queryClient.invalidateQueries({queryKey: crmKeys.all})
  ↓
useInteractions به‌صورت خودکار رفچ می‌شود — بدون نیاز به رفرش دستی کاربر
```

---

## ۱۵. گراف وابستگی‌ها (Dependency Graph)

```
apps/web  ──depends on──▶ @hisabche/ui, @hisabche/api, @hisabche/store,
                           @hisabche/i18n, @hisabche/validation, @hisabche/auth, @hisabche/db

apps/mobile ──depends on──▶ @hisabche/api, @hisabche/db, @hisabche/i18n,
                             @hisabche/store, @hisabche/ui, @hisabche/validation

@hisabche/ui ──depends on──▶ @hisabche/api, @hisabche/store

@hisabche/api ──depends on──▶ (هیچ پکیج داخلی دیگری — عمداً مستقل نگه داشته شده)
    └─ فقط از طریق tokenProvider.ts (الگوی registration) با store یکپارچه می‌شود

@hisabche/store ──depends on──▶ @hisabche/api (برای registerTokenGetter/setOnUnauthorized)
                                @hisabche/auth (برای supabaseClient در برخی slice ها مثل workspace.slice.ts)

@hisabche/auth ──مستقل، فقط روی @supabase/supabase-js

@hisabche/validation ──مستقل، فقط Zod

backend ──depends on──▶ @hisabche/validation (اسکیمای اعتبارسنجی مشترک با فرانت)
                         (Drizzle schema های backend/src/drizzle-schema.ts مستقل و بلااستفاده)
```

نکته‌ی کلیدی معماری: **جهت وابستگی بین `api` و `store` عمداً یک‌طرفه نگه داشته شده** (`api` هیچ importی از `store` ندارد) تا `packages/api` بدون وابستگی به یک پیاده‌سازی خاص state، در وب و موبایل قابل استفاده مجدد باشد. اما `store` خودش هم به `api` (برای tokenProvider) و هم به‌طور جداگانه به `auth` (برای `supabaseClient` در `workspace.slice.ts`) وابسته است — یعنی دو مسیر مستقل برای گرفتن یک Supabase client در پروژه وجود دارد.

---

## ۱۶. درخت کل سیستم (System Tree)

```
Hisabche
├── Dashboard  [/dashboard]
│   ├── Summary            → useDashboardKPIs        → جدول‌های invoices/products/customers (تجمیعی)
│   ├── Charts             → useDashboardSales        → invoices
│   ├── AI Insights        → useAIInsights            → ai.service.ts (keyword-engine)
│   └── Business Health     → business-health-panel    → تجمیع KPI
│   Permissions: نیاز به auth   |  Realtime: ✅ (invoices)  |  Offline: خیر
│
├── Accounting  [/accounting]
│   ├── Accounts            → accounts
│   ├── Journal              → journal_entries, journal_lines
│   ├── Trial Balance        → محاسبه از journal_lines
│   ├── Balance Sheet        → accounts + journal_lines
│   └── Income Statement     → accounts + journal_lines
│   Realtime: ✅  |  Offline: خیر
│
├── CRM  [/crm]
│   ├── Interactions         → interactions
│   └── Opportunities        → opportunities
│   Realtime: ✅  |  Offline: خیر
│
├── Inventory / Warehouse  [/warehouse]
│   ├── Products              → products
│   ├── Stock Movements        → stock_movements
│   └── Warehouses             → warehouses, warehouse_stock
│   Realtime: ✅ (products)  |  Offline: خیر
│
├── Manufacturing  [/manufacturing]
│   ├── BOMs                  → boms, bom_items
│   └── Work Orders            → work_orders
│   Realtime: ✅  |  Offline: خیر
│
├── Purchasing  [/purchasing]
│   └── Purchase Orders        → purchase_orders, purchase_order_items
│   Realtime: ❌ (تنها ماژول تجاری بدون useRealtime)  |  Offline: خیر
│
├── Projects  [/projects]
│   ├── Tasks                 → project_tasks
│   ├── Members                → project_members
│   └── Time Entries           → project_time_entries
│   Realtime: ✅ (projects, project_tasks)  |  Offline: خیر
│
├── HR  [/human-resources]
│   ├── Departments            → departments
│   ├── Employees               → employees
│   ├── Attendance              → attendance
│   ├── Payroll                 → payrolls
│   └── Leaves                  → leaves
│   Realtime: خیر  |  Offline: خیر
│
├── Billing  [/settings → billing]
│   ├── Plans/Subscription      → subscriptions, billing_events
│   ├── Checkout                → checkout_sessions
│   └── Webhooks                → webhook_events
│   Realtime: خیر  |  Offline: خیر
│
├── Notifications  [notification-bell]
│   └── notifications جدول، تحویل از طریق Realtime (نه polling)
│
├── Workspaces  [/workspace]
│   ├── Members                → workspace_members
│   └── Invites                 → workspace_invites
│   Realtime: ✅
│
├── Permissions  [/permissions]
│   └── permissions, roles, role_permissions, user_roles
│
├── Audit  [/audit]
│   └── audit_logs
│
├── Activity  [/activities]
│   └── فید فعالیت کاربر، Realtime فقط روی رویداد INSERT
│
└── Sync Center  [/sync-center]
    └── رابط بصری بدون منطق واقعی سینک (بخش ۱۲)
```

---

## ۱۷. تحلیل کارایی (Performance Analysis)

### درخواست‌های تکراری / مشکل شناسایی‌شده و رفع‌شده

**باگ Auth caching (رفع‌شده در همین دور بررسی)**: `REDIS_URL` در `.env` بک‌اند به یک هاست داخلی Render.com اشاره داشت که از محیط توسعه‌ی محلی قابل resolve نبود. چون `cache.service.ts` روی خطای Redis فقط لاگ می‌زد و `null`/`false` برمی‌گرداند، کش ۳۰ ثانیه‌ای `auth.middleware.ts` **هرگز واقعاً hit نمی‌خورد** — یعنی `supabase.auth.getUser(token)` (یک تماس واقعی HTTP به سرور Auth سوپابیس) روی **هر تک درخواست بک‌اند** اجرا می‌شد، نه فقط هر ۳۰ ثانیه یک‌بار. چون هر ناوبری صفحه چند hook TanStack Query را همزمان فعال می‌کند، این باعث افزایش چند برابری تماس با Supabase Auth، تأخیر بالاتر (به‌خاطر retry های ioredis روی اتصال ناموفق) و مصرف بیشتر می‌شد. **رفع شده**: یک fallback درون‌حافظه‌ای در `cache.service.ts` اضافه شد که وقتی Redis در دسترس نیست، بدون تغییر معماری کش، همان رفتار کش ۳۰ ثانیه‌ای را با یک `Map` محلی تضمین می‌کند.

### رندرهای پرهزینه / بارگذاری سنگین

- `providers.tsx` با موفقیت `HeavyProviders` را lazy می‌کند (`dynamic import` + `Suspense` با fallback فوری) تا اولین رندر صفحه معطل initializerهای غیرضروری (آنالیتیکس، تشخیص سخت‌افزار) نشود — یک الگوی خوب.
- `AdaptiveUIInitializer` بر اساس `navigator.hardwareConcurrency` حالت کم‌مصرف (`lite-mode`) را فعال می‌کند — سازوکار خوبی برای دستگاه‌های ضعیف.

### کش گمشده / ناسازگار

- ماژول **Purchasing** تنها ماژول تجاری بدون `useRealtime` است (بخش ۱۱) — کاربران باید صفحه را دستی رفرش کنند یا منتظر `staleTime` پنج‌دقیقه‌ای بمانند تا سفارش خرید جدید یک همکار دیگر را ببینند.
- **دو الگوی نام‌گذاری locale موازی و ناهم‌خوان** در فرانت‌اند وجود دارد:
  - `next-intl` (مسیر واقعی URL) از `fa`, `af`, `en` استفاده می‌کند (`apps/web/app/i18n-config.ts`).
  - بقیه‌ی کد (`dashboard-layout.tsx`'s `getLocaleFromPathname`، تمام `generateMetadata` بلوک‌های صفحات dashboard، `localStorage['hisabche-lang']`، تایپ `Language` در `onboarding.slice.ts`) از `fa-IR`, `fa-AF`, `en` استفاده می‌کند.
  - نتیجه‌ی عملی: مسیرهایی مثل `/fa-AF/...` هیچ‌وقت با میدلور next-intl تطبیق نمی‌یابند و ۴۰۴ می‌دهند (این را مستقیماً در dev تست کردم)؛ فقط مسیرهای بدون پیشوند (پیش‌فرض `fa`) یا با پیشوند `/en`/`/af` کار می‌کنند. تمام کلیدهای metadata با `"fa-IR"`/`"fa-AF"` در page.tsx های dashboard (audit, accounting, crm, manufacturing, purchasing, ...) هرگز با مقدار واقعی پارامتر `lang` (`fa`/`af`/`en`) تطبیق نمی‌یابند و همیشه به fallback پیش‌فرض سقوط می‌کنند — یعنی این متادیتاها عملاً بلااستفاده‌اند.
- **کد مرده تأییدشده**: `middleware/arcjet.ts` و `websocket/activity.ws.ts` در بک‌اند کامل پیاده‌سازی شده‌اند ولی هرگز در `index.ts` ثبت نمی‌شوند. کل زیرساخت Drizzle (schema، سه client موازی، migrations) در عمل هیچ query واقعی اجرا نمی‌کند. `packages/auth` برای فرایند لاگین واقعی مصرف نمی‌شود.
- **اسکیمای بدون اعتبارسنجی**: `customer.routes.ts` و `product.routes.ts` اسکیمای Zod را import می‌کنند ولی هرگز اعمال نمی‌کنند (بخش ۴).
- **کوئری‌های احتمالاً کند**: `authenticate` middleware روی هر cache-miss دو کوئری سریالی می‌زند (`supabase.auth.getUser` سپس `workspace_members`)؛ با کش سالم این فقط هر ۳۰ ثانیه رخ می‌دهد، اما اگر Redis دوباره در دسترس نباشد (یا در چند نمونه‌ی بک‌اند به‌طور مستقل fallback درون‌حافظه‌ای داشته باشند)، این هزینه بازمی‌گردد.

---

## ۱۸. بررسی امنیتی (Security Review)

### یافته‌های مثبت

- هدرهای امنیتی سراسری (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`) هم در بک‌اند (`onSend` hook) و هم در `next.config.js` تنظیم شده‌اند.
- `db.ts` بک‌اند قبلاً یک service-role key واقعی hardcoded داشته که طبق کامنت خود کد **حذف شده** و اکنون بدون env var throw می‌کند — یک اصلاح امنیتی مستند در تاریخچه‌ی پروژه.
- Rate limiting در سطح Fastify (۱۰۰ درخواست/دقیقه) فعال است؛ زیرساخت Arcjet (شیلد + تشخیص بات + token-bucket) کامل نوشته شده (هرچند ثبت‌نشده — بخش ۱۷).
- کش auth با TTL کوتاه (۳۰ ثانیه) طراحی شده تا تعادل بین کارایی و سرعت لغو دسترسی حفظ شود.

### یافته‌های نگران‌کننده

1. **Secretهای hardcoded در ریپازیتوری**: `drizzle.config.ts` (ریشه) و `packages/db/src/client.ts` هرکدام یک connection string واقعی Postgres (شامل پسورد) و/یا کلید anon Supabase را به‌صورت plaintext در کد دارند. حتی اگر این‌ها کلید anon (نه service-role) باشند، وجود پسورد دیتابیس در کد نسخه‌کنترل‌شده باید فوراً چرخانده (rotate) و حذف شود.
2. **RLS غیرقابل تأیید + بای‌پس کامل از بک‌اند**: چون تمام دسترسی بک‌اند با service-role key انجام می‌شود، حتی اگر RLS روی دیتابیس فعال باشد، backend همیشه از آن عبور می‌کند. تنها لایه‌ی دفاعی واقعی، فیلترهای دستی `user_id`/`workspace_id` در هر سرویس است — هر فراموشی یک `.eq('workspace_id', ...)` در یک سرویس، مستقیماً به نشت داده بین workspaceها منجر می‌شود (این احتمال به‌صورت مستقیم بررسی نشد و نیاز به audit سطر‌به‌سطر سرویس‌ها دارد).
3. **RBAC تعریف‌شده ولی enforce نشده**: `permission.service.ts` یک مدل کامل roles/permissions دارد، اما `hasPermission` در route handlerهای بررسی‌شده صدا زده نمی‌شود؛ عملاً تنها گیت، عضویت در workspace (نه نقش دقیق) است.
4. **دو endpoint بدون اعتبارسنجی Zod واقعی**: `customer.routes.ts`, `product.routes.ts` (بخش ۴) — امکان ورود داده‌ی نامعتبر/غیرمنتظره به این دو مسیر بیشتر از بقیه است.
5. **سه مسیر auth موازی** (بخش ۱۰) سطح حمله و پیچیدگی را بالا می‌برد — مثلاً `workspace.slice.ts` مستقیماً URL بک‌اند production (`https://hisabche.onrender.com`) را hardcode کرده، مستقل از `NEXT_PUBLIC_API_URL`، که یعنی رفتار این بخش در محیط‌های staging/local می‌تواند به‌طور غیرمنتظره همیشه production را هدف بگیرد.
6. **CORS در محیط غیر-production هم شامل دامنه‌های production است** (بخش ۴) — این افزایش سطح حمله‌ی بلاواسطه‌ای ندارد ولی نشان‌دهنده‌ی عدم تفکیک دقیق تنظیمات محیط‌هاست.

---

## ۱۹. پیشنهادات بهبود

### معماری

- یکی از دو الگوی Container/View (audit/activity/crm/manufacturing/purchasing) یا الگوی صفحه‌ای accounting (`AccountingPage` + `tabs/`) را به‌عنوان استاندارد واحد انتخاب و بقیه را به آن مهاجرت دهید — وجود دو الگوی موازی هزینه‌ی نگهداری را بالا می‌برد.
- سه مسیر auth (packages/auth، packages/api/hooks/auth.ts، store/auth.slice.ts) را یکپارچه کنید؛ یک منبع حقیقت واحد برای login/token/session تعریف کنید.
- زیرساخت Drizzle مرده (schema، سه client موازی) را یا کاملاً حذف کنید یا واقعاً به‌عنوان مسیر migration رسمی فعال کنید — وضعیت فعلی صرفاً سردرگمی ایجاد می‌کند.
- `middleware/arcjet.ts` و `websocket/activity.ws.ts` را یا در `index.ts` ثبت کنید یا از ریپازیتوری حذف کنید.

### کارایی

- `useRealtime` را به ماژول Purchasing هم اضافه کنید تا با بقیه‌ی ماژول‌های تجاری همسان شود.
- سیستم locale را یکپارچه کنید: یا کل کد (نه فقط next-intl) از `fa`/`af`/`en` استفاده کند، یا next-intl config به `fa-IR`/`fa-AF`/`en` مهاجرت یابد — این ناسازگاری باعث می‌شود مسیرهایی مثل `/fa-AF/...` که در چند جای کد (`generateMetadata`، `getLocaleFromPathname`) فرض گرفته شده‌اند، هرگز کار نکنند.

### امنیت

- تمام secretهای hardcoded (connection string در `drizzle.config.ts`، anon key fallback در `packages/db/src/client.ts`) را چرخانده و از کد حذف کنید؛ فقط از env var بدون fallback استفاده شود (مطابق الگویی که در `backend/src/db.ts` بعد از رفع مشابه پیاده شده).
- بررسی سیستماتیک کنید که آیا RLS واقعاً روی پروژه‌ی Supabase فعال است؛ اگر نه، حداقل یک audit کامل از فیلتر `workspace_id`/`user_id` در هر یک از ۳۰ فایل سرویس backend انجام دهید.
- `hasPermission`/RBAC را واقعاً در حداقل route های حساس (حذف، تغییر نقش، تنظیمات مالی) enforce کنید.
- اعتبارسنجی Zod را برای `customer.routes.ts` و `product.routes.ts` کامل کنید (اتصال `.parse()`/`schema` مثل بقیه‌ی route ها).

### قابلیت نگهداری

- مستندسازی صریح کنید که Offline/Sync Center در وضعیت فعلی «UI-only، بدون منطق واقعی» است تا تیم محصول انتظارات درستی داشته باشد، یا پیاده‌سازی واقعی (تکمیل `performSync`/`sync-queue.process`) را در بک‌لاگ قرار دهید.
- افزودن `@nozbe/watermelondb` به `apps/mobile/package.json` (یا حذف کامل وابستگی peer از `packages/offline` اگر مسیر موبایل رها شده).

### مقیاس‌پذیری

- الگوی fallback درون‌حافظه‌ای جدید در `cache.service.ts` per-process است؛ در استقرار چند-نمونه‌ای (که دقیقاً همان دلیلی بود که `memoryCache` را از Map محلی به Redis منتقل کرده بود)، اگر Redis برای مدت طولانی پایین بماند، invalidation بین نمونه‌ها دوباره ناهم‌گام می‌شود. برای محیط production واقعی، در اولویت اول باید مشکل شبکه‌ای/DNS واقعی به Redis رفع شود؛ fallback درون‌حافظه‌ای صرفاً یک شبکه‌ی ایمنی موقت است، نه جایگزین دائمی.

---

## ۲۰. خلاصه‌ی مدیریتی (Executive Summary)

Hisabche یک ERP فارسی/دری با پوشش دامنه‌ای بسیار گسترده است (حسابداری، CRM، انبار، تولید، خرید، منابع انسانی، پروژه، صورت‌حساب اشتراک، هوش مصنوعی سبک) که در قالب یک Monorepo با یک بک‌اند Fastify متمرکز و یک فرانت‌اند Next.js + یک اپ موبایل Expo، با پکیج‌های مشترک برای API hooks (TanStack Query)، state (Zustand)، UI و اعتبارسنجی (Zod) ساخته شده است.

نقاط قوت معماری: جداسازی روشن لایه‌ی دسترسی به API از state مدیریت (کوپلینگ یک‌طرفه‌ی `api`↔`store`)، استفاده‌ی گسترده و درست از Supabase Realtime به‌جای polling، یک لایه‌ی کش چندسطحی (Redis + TanStack Query) با یک رفع اخیر مستند برای تحمل خرابی Redis، و یک الگوی Container/View رو به رشد در ماژول‌های جدیدتر.

بزرگ‌ترین شکاف‌ها: (۱) دیتابیس واقعی هیچ منبع حقیقت نسخه‌کنترل‌شده‌ای ندارد — تنها ۶ از ۴۹ جدول واقعی در Drizzle تعریف شده‌اند و RLS در هیچ migration واقعی دیده نمی‌شود؛ (۲) سه پیاده‌سازی auth موازی وجود دارد که فقط یکی از آن‌ها واقعاً فعال است؛ (۳) زیرساخت Offline/Sync کاملاً scaffold است و منطق واقعی ندارد؛ (۴) دو سیستم locale ناهم‌خوان (next-intl با `fa/af/en` در برابر بقیه‌ی کد با `fa-IR/fa-AF/en`) باعث ۴۰۴ شدن مسیرهای منطقی‌به‌نظر و بی‌اثر شدن بخشی از متادیتای SEO می‌شود؛ (۵) چند secret واقعی (کانکشن استرینگ دیتابیس) به‌صورت hardcoded در کد نسخه‌کنترل‌شده وجود دارد.

اولویت پیشنهادی برای اقدام فوری: چرخاندن و حذف secretهای hardcoded (بخش ۱۸)، یکسان‌سازی سیستم locale (بخش ۱۷/۱۹)، و تصمیم صریح درباره‌ی سرنوشت زیرساخت Drizzle و Offline (نگه‌داشتن و تکمیل، یا حذف رسمی).
