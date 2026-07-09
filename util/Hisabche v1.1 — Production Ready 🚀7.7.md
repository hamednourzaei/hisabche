# 📊 Hisabche — مستندات فنی کامل

---

## 🏗️ ساختار پروژه

| بخش | تکنولوژی | توضیح |
|------|-----------|--------|
| **Monorepo** | Turborepo | مدیریت پکیج‌های چندگانه |
| **Web App** | Next.js 16 (App Router) + React 19 | فرانت‌اند اصلی |
| **Mobile App** | Expo + React Native | اپلیکیشن موبایل |
| **Backend** | Fastify 4 | API Server |
| **Database** | Supabase (PostgreSQL) | دیتابیس اصلی + Auth + Realtime |
| **ORM** | Drizzle ORM | برای mobile sync |
| **Validation** | Zod | اعتبارسنجی shared |
| **State** | Zustand | مدیریت state (client) |
| **Query** | TanStack Query v5 | fetch/cache/mutation |
| **UI** | shadcn/ui + Tailwind CSS v4 | کامپوننت‌های UI |
| **i18n** | react-i18next | ترجمه (fa-IR, fa-AF, en) |
| **Auth** | Supabase Auth | احراز هویت |
| **PDF** | @react-pdf/renderer | تولید PDF فاکتور |
| **Realtime** | Supabase Realtime | اعلان‌های زنده |
| **Security** | Arcjet | Rate limiting |
| **Monitoring** | Sentry + PostHog | مانیتورینگ و آنالیتیکس |

---

## 📦 ساختار پکیج‌ها

```
hisabche/
├── apps/
│   ├── web/          # Next.js 16 (App Router)
│   └── mobile/       # Expo + React Native
├── backend/          # Fastify 4 API
├── packages/
│   ├── analytics/    # Sentry + PostHog
│   ├── api/          # TanStack Query hooks
│   ├── auth/         # Supabase client
│   ├── config/       # Environment variables
│   ├── db/           # Drizzle ORM + models
│   ├── i18n/         # Translations
│   ├── store/        # Zustand slices
│   ├── ui/           # shadcn/ui components
│   └── validation/   # Zod schemas
```

---

## 🗄️ دیتابیس — ۳۲ جدول

| # | جدول | توضیح |
|:--:|--------|--------|
| ۱ | `products` | محصولات |
| ۲ | `customers` | مشتریان |
| ۳ | `suppliers` | تأمین‌کنندگان |
| ۴ | `invoices` | فاکتورها |
| ۵ | `invoice_items` | اقلام فاکتور |
| ۶ | `transactions` | تراکنش‌ها |
| ۷ | `accounts` | حساب‌های مالی |
| ۸ | `ledger_entries` | دفتر کل |
| ۹ | `journal_entries` | ثبت‌های روزنامه |
| ۱۰ | `journal_lines` | سطرهای روزنامه |
| ۱۱ | `warehouses` | انبارها |
| ۱۲ | `warehouses` | گدام‌ها |
| ۱۳ | `stock_movements` | حرکت کالا |
| ۱۴ | `purchase_orders` | سفارشات خرید |
| ۱۵ | `purchase_order_items` | اقلام سفارش خرید |
| ۱۶ | `boms` | Bill of Materials |
| ۱۷ | `bom_items` | اقلام BOM |
| ۱۸ | `work_orders` | دستورات تولید |
| ۱۹ | `departments` | دپارتمان‌ها |
| ۲۰ | `employees` | کارمندان |
| ۲۱ | `attendance` | حضور و غیاب |
| ۲۲ | `payrolls` | حقوق و دستمزد |
| ۲۳ | `leaves` | مرخصی‌ها |
| ۲۴ | `projects` | پروژه‌ها |
| ۲۵ | `project_tasks` | تسک‌ها |
| ۲۶ | `project_members` | اعضای پروژه |
| ۲۷ | `project_time_entries` | ثبت زمان |
| ۲۸ | `workspaces` | ورک‌اسپیس‌ها |
| ۲۹ | `workspace_members` | اعضای ورک‌اسپیس |
| ۳۰ | `workspace_invites` | دعوت‌نامه‌ها |
| ۳۱ | `permissions` | دسترسی‌ها |
| ۳۲ | `roles` | نقش‌ها |
| ۳۳ | `role_permissions` | نقش-دسترسی |
| ۳۴ | `user_roles` | کاربر-نقش |
| ۳۵ | `audit_logs` | لاگ‌های حسابرسی |
| ۳۶ | `event_log` | رویدادها |
| ۳۷ | `event_types` | انواع رویداد |
| ۳۸ | `sync_queue` | صف همگام‌سازی |
| ۳۹ | `sync_logs` | لاگ همگام‌سازی |
| ۴۰ | `interactions` | تعاملات CRM |
| ۴۱ | `opportunities` | فرصت‌های فروش |
| ۴۲ | `invoice_pdf_cache` | کش PDF فاکتور |

### ✅ v1.1 — جداول جدید

| # | جدول | توضیح |
|:--:|--------|--------|
| ۴۳ | `workflows` | قالب‌های فرآیند تأیید |
| ۴۴ | `workflow_steps` | مراحل تأیید |
| ۴۵ | `workflow_instances` | نمونه‌های در حال اجرا |
| ۴۶ | `workflow_actions` | تاریخچه اقدامات |
| ۴۷ | `notifications` | اعلان‌ها |
| ۴۸ | `background_jobs` | تسک‌های زمان‌بندی |

---

## 🚀 فازهای پیاده‌سازی شده

### فاز ۱-۹: هسته اصلی
- ✅ Auth (Login/Signup)
- ✅ Invoices (CRUD + PDF)
- ✅ Products (CRUD + Stock)
- ✅ Customers (CRUD)
- ✅ Transactions
- ✅ warehouse (Inventory)
- ✅ Sync (Offline-first mobile)

### فاز ۱۰-۱۴: پیشرفته
- ✅ Accounting (دفتر کل، ترازنامه)
- ✅ CRM (Interactions, Opportunities)
- ✅ Purchasing (Purchase Orders)
- ✅ Manufacturing (BOM, Work Orders)

### فاز ۱۵-۱۹: سازمانی
- ✅ HR (Employees, Payroll, Attendance, Leaves)
- ✅ Projects (Tasks, Time Tracking)
- ✅ Workspace (Multi-tenant)
- ✅ Permissions (RBAC)
- ✅ Audit (Logging)

### فاز ۲۰-۲۳: زیرساخت
- ✅ Sync Engine
- ✅ Event System
- ✅ Analytics (Dashboard KPIs)
- ✅ AI Assistant

### 🆕 v1.1 — Enterprise Infrastructure (امروز)
- ✅ Workflow & Approval Engine
- ✅ Notification Center (Realtime)
- ✅ Job Queue / Scheduler
- ✅ Enterprise Invite System (Token Hash, Email Match)

---

## 🔌 API Endpoints

| Domain | Routes | Endpoints |
|--------|--------|:---------:|
| Auth | `auth.routes.ts` | ۶ |
| Invoices | `invoice.routes.ts` + `invoice-pdf.routes.ts` | ۸ |
| Products | `product.routes.ts` | ۵ |
| Customers | `customer.routes.ts` | ۵ |
| Transactions | `transaction.routes.ts` | ۴ |
| warehouse | `warehouse.routes.ts` | ۶ |
| Accounting | `accounting.routes.ts` | ۸ |
| CRM | `crm.routes.ts` | ۴ |
| Purchasing | `purchasing.routes.ts` | ۴ |
| Manufacturing | `manufacturing.routes.ts` | ۶ |
| HR | `hr.routes.ts` | ۱۲ |
| Projects | `project.routes.ts` | ۱۰ |
| Workspace | `workspace.routes.ts` | ۱۲ |
| Permissions | `permission.routes.ts` | ۶ |
| Audit | `audit.routes.ts` | ۶ |
| Analytics | `analytics.routes.ts` | ۴ |
| AI | `ai.routes.ts` | ۳ |
| Sync | `sync.routes.ts` | ۴ |
| Event | `event.routes.ts` | ۳ |
| **🆕 Workflow** | `workflow.routes.ts` | **۹** |
| **🆕 Notification** | `notification.routes.ts` | **۳** |

**مجموع: ۱۲۰+ endpoint**

---

## 🎨 Design System

| Token | مقدار |
|-------|--------|
| `--color-primary` | `168 84% 43%` (#12C8A0 - Teal) |
| `--surface-base` | `192 55% 6%` (#061417 - Dark BG) |
| `--surface-elevated` | `200 30% 10%` |
| `--fg-primary` | `165 35% 97%` |
| `--border-default` | `206 26% 19%` |

- Glassmorphism cards
- RTL-first (Farsi)
- Dark/Light theme
- GPU-accelerated animations
- Accessibility (focus rings, aria labels)

---

## 🔒 امنیت

- ✅ Row Level Security (RLS) روی همه جداول
- ✅ JWT Authentication (Supabase Auth)
- ✅ Rate Limiting (Arcjet)
- ✅ Input Validation (Zod)
- ✅ Audit Logging
- ✅ Tenant Isolation (workspace_id)
- ✅ Soft Delete (deleted_at)
- ✅ Token Hashing (SHA256) برای Invite System

---

## 📊 آمار کلی

| Metric | مقدار |
|--------|:-----:|
| **تعداد فایل‌ها** | ~۳۰۰+ |
| **تعداد جداول** | ۴۸ |
| **تعداد endpoints** | ۱۲۰+ |
| **پکیج‌ها** | ۹ |
| **زبان‌ها** | ۳ (fa-IR, fa-AF, en) |
| **فازهای تکمیل شده** | ۲۳ + ۳ ماژول v1.1 |
| **Deployment** | Render (Backend) + Vercel (Frontend) |

---

## 🏆 v1.1 — خلاصه تغییرات امروز

| # | فایل | تغییر |
|:--:|------|--------|
| ۱ | `workflow.service.ts` | 🆕 موتور تأیید |
| ۲ | `workflow.routes.ts` | 🆕 API workflow |
| ۳ | `notification.service.ts` | 🆕 سرویس اعلان |
| ۴ | `notification.routes.ts` | 🆕 API اعلان |
| ۵ | `job.service.ts` | 🆕 صف تسک‌ها |
| ۶ | `job-scheduler.plugin.ts` | 🆕 زمان‌بندی |
| ۷ | `workspace.service.ts` | ✏️ Enterprise Invite |
| ۸ | `invoice.service.ts` | ✏️ Auto-workflow hook |
| ۹ | `approval-card.tsx` | 🆕 کارت تأیید |
| ۱۰ | `approval-actions.tsx` | 🆕 دکمه‌های تأیید/رد |
| ۱۱ | `notification-bell.tsx` | ✏️ Realtime + polling |
| ۱۲ | `workspace-page.tsx` | ✏️ Role management |
| ۱۳ | `invite-modal.tsx` | ✏️ Link box + copy |
| ۱۴ | `accept-invite/page.tsx` | 🆕 صفحه قبول دعوت |
| ۱۵ | `workspace.slice.ts` | ✏️ fetchWorkspace |
| ۱۶ | `auth.middleware.ts` | ✏️ workspaceId, userRole |
| ۱۷ | `invoice.routes.ts` | ✏️ InvoiceService |
| ۱۸ | `common.schema.ts` | ✏️ phone validation |
| ۱۹ | `providers.tsx` | ✏️ WorkspaceLoader |
| ۲۰ | `customers-customer-list.tsx` | ✏️ Design tokens |

---

**Hisabche v1.1 — Production Ready 🚀**