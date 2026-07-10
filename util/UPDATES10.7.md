```markdown
# Hisabche — گزارش کامل تغییرات (Changelog)

## 📅 تاریخ: ۱۰ ژوئیه ۲۰۲۶

---

## 🏗️ تغییرات ساختاری (Internationalization)

### تغییر نام ماژول‌ها

| نام قدیمی | نام جدید | توضیح |
|-----------|----------|--------|
| `godam` | `warehouse` | انبار |
| `baqidari` | `customers` | مشتریان |
| `hr` | `human-resources` | منابع انسانی |
| `faktoor` | `invoices` | فاکتورها |

### تغییر نام فایل‌ها

| مسیر قدیمی | مسیر جدید |
|------------|-----------|
| `backend/src/routes/godam.routes.ts` | `backend/src/routes/warehouse.routes.ts` |
| `backend/src/services/godam.service.ts` | `backend/src/services/warehouse.service.ts` |
| `backend/src/routes/hr.routes.ts` | `backend/src/routes/human-resources.routes.ts` |
| `backend/src/services/hr.service.ts` | `backend/src/services/human-resources.service.ts` |
| `packages/validation/src/schemas/godam.schema.ts` | `packages/validation/src/schemas/warehouse.schema.ts` |
| `packages/validation/src/schemas/hr.schema.ts` | `packages/validation/src/schemas/human-resources.schema.ts` |
| `packages/ui/src/components/ui/godam/` | `packages/ui/src/components/ui/warehouse/` |
| `packages/ui/src/components/ui/baqidari/` | `packages/ui/src/components/ui/customers/` |
| `packages/ui/src/components/ui/hr/` | `packages/ui/src/components/ui/human-resources/` |
| `apps/web/app/(dashboard)/godam/` | `apps/web/app/(dashboard)/warehouse/` |
| `apps/web/app/(dashboard)/baqidari/` | `apps/web/app/(dashboard)/customers/` |
| `apps/web/app/(dashboard)/hr/` | `apps/web/app/(dashboard)/human-resources/` |
| `apps/mobile/screens/GodamScreen.tsx` | `apps/mobile/screens/WarehouseScreen.tsx` |
| `apps/mobile/screens/BaqidariScreen.tsx` | `apps/mobile/screens/CustomersScreen.tsx` |

---

## 🛠️ تغییرات بک‌اند (Backend)

### اصلاح `backend/src/index.ts`
- اضافه شدن `accountingRoutes`, `crmRoutes`, `manufacturingRoutes`, `purchasingRoutes`
- اضافه شدن `workflowRoutes`, `notificationRoutes`, `jobSchedulerPlugin`
- اصلاح نام‌های import و register
- اضافه شدن Swagger UI در مسیر `/docs`

### اصلاح `warehouse.routes.ts`
- اصلاح import: `createwarehouseSchema`, `updatewarehouseSchema`
- اصلاح متدها: `listwarehouses`, `createWarehouse`, `updateWarehouse`, `deleteWarehouse`, `transferStock`, `getStockByWarehouse`

### اصلاح `warehouse.service.ts`
- اصلاح import: `createwarehouseSchema`, `updatewarehouseSchema`, `stockTransferSchema`
- اصلاح نام متدها: `listwarehouses`, `createWarehouse`, `updateWarehouse`, `deleteWarehouse`, `transferStock`, `getStockByWarehouse`
- اصلاح `godamId` → `warehouseId`

### اصلاح `human-resources.routes.ts`
- اصلاح import: `HumanResourcesService` به جای `humanResourcesService`
- اصلاح نمونه‌سازی: `new HumanResourcesService()`

---

## 🎨 تغییرات فرانت‌اند (Frontend)

### اصلاح `packages/ui/src/index.ts`
- اضافه شدن `warehouseContainer`, `warehouseSkeleton`, `warehouseView`
- اضافه شدن `customersContainer`, `customersView`, `customersSkeleton`
- اصلاح نام‌های export

### اصلاح کامپوننت‌های `customers`
- `customer-view.tsx` → صدا زدن `customersStats` و `customersCustomerList` به عنوان تابع
- `customer-stats.tsx` → تبدیل به تابع با props
- `customer-list.tsx` → تبدیل به تابع با props
- `customers-container.tsx` → اصلاح import `useCustomers`

### اصلاح کامپوننت‌های `warehouse`
- `warehouse-view.tsx` → صدا زدن `warehouseStats` و `warehouseProductList` به عنوان تابع
- `warehouse-container.tsx` → اصلاح import `useWarehouse`

### اصلاح صفحات Next.js
- `warehouse/page.tsx` → `"use client"` و صدا زدن توابع
- `customers/page.tsx` → اصلاح `customersClient`
- `customers/loading.tsx` → صدا زدن `customersSkeleton()` به عنوان تابع

---

## 📚 مستندات API (Swagger UI)

### نصب پکیج‌ها
```bash
npm install @fastify/swagger @fastify/swagger-ui
```

### اضافه شدن به `index.ts`
- ثبت `swagger` و `swaggerUi`
- مسیر `/docs` برای مشاهده مستندات

### اصلاح `auth.routes.ts`
- اضافه شدن `description`, `tags`, `summary`, `security` برای هر endpoint

---

## 📊 آنالیتیکس (Google Analytics 4)

### اضافه شدن به `layout.tsx`
```tsx
<Script strategy="afterInteractive" src="https://www.googletagmanager.com/gtag/js?id=G-T5XG907W4R" />
<Script id="google-analytics" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `...` }} />
```

### اضافه شدن `analytics-pageview.tsx`
- ثبت pageview در ناوبری‌های کلاینت‌ساید
- استفاده از `Suspense` برای جلوگیری از خطای build

---

## 🌐 تنظیمات دامنه (Cloudflare + Vercel)

### دامنه‌ها
- `hisabche.com` — اصلی
- `hisabche.org` — ریدایرکت به `.com`
- `hisabche.online` — ریدایرکت به `.com`

### تنظیمات Cloudflare
- Page Rules برای ریدایرکت ۳۰۱
- DNS: CNAME به `cname.vercel-dns.com`

### `vercel.json`
```json
{
  "redirects": [
    {
      "source": "/(.*)",
      "has": [{ "type": "host", "value": "hisabche.org" }],
      "destination": "https://hisabche.com/$1",
      "statusCode": 301
    },
    {
      "source": "/(.*)",
      "has": [{ "type": "host", "value": "hisabche.online" }],
      "destination": "https://hisabche.com/$1",
      "statusCode": 301
    },
    {
      "source": "/(.*)",
      "has": [{ "type": "host", "value": "www.hisabche.com" }],
      "destination": "https://hisabche.com/$1",
      "statusCode": 301
    }
  ]
}
```

---

## 🐛 رفع خطاهای Build

| خطا | راه حل |
|-----|--------|
| `useSearchParams() should be wrapped in a suspense boundary` | اضافه کردن `<Suspense>` در `layout.tsx` |
| `Attempted to call customersSkeleton() from the server` | استفاده از `"use client"` و صدا زدن به عنوان تابع |
| `Attempted to call warehouseSkeleton() from the server` | استفاده از `"use client"` و صدا زدن به عنوان تابع |
| ESLint: `no-explicit-any` | اضافه کردن typeهای مناسب |
| ESLint: `no-unused-vars` | حذف `useEffect` از `providers.tsx` |

---

## 🗄️ دیتابیس (Supabase)

### تغییرات اعمال‌شده
- حذف جدول `godams` (جایگزین با `warehouses`)
- حذف ستون‌های `from_godam_id` و `to_godam_id` از `stock_movements`
- اضافه شدن ستون‌های `from_warehouse_id` و `to_warehouse_id`

---

## ✅ وضعیت نهایی

| بخش | وضعیت |
|------|--------|
| **بک‌اند** | ✅ سالم و اجرا می‌شود |
| **فرانت‌اند** | ✅ سالم و اجرا می‌شود |
| **Swagger UI** | ✅ در `/docs` در دسترس است |
| **GA4** | ✅ فعال و نصب شده |
| **دامنه‌ها** | ✅ تنظیم شده و ریدایرکت کار می‌کند |
| **Build** | ✅ بدون خطا |

---

## 🚀 قدم بعدی

- Deploy روی Render و Vercel
- تست کامل E2E
- شروع فاز بعدی (Reports & Analytics)
- بررسی داده‌های GA4 پس از ۲۴ ساعت
```