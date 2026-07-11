```markdown
# 📊 Hisabche — ERP & Business Management System

![Version](https://img.shields.io/badge/version-1.1-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.2-black)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Fastify](https://img.shields.io/badge/Fastify-4-000000)
![License](https://img.shields.io/badge/license-Proprietary-red)

**Hisabche** is a modern, full-stack ERP & business management application tailored for small and medium businesses in Iran and Afghanistan.  
It covers accounting, invoicing, inventory (warehouse), HR, projects, CRM, and real-time sync — fully offline-capable and multilingual.

🌐 **Website:** [hisabche.com](https://hisabche.com)  
📚 **API Docs:** [hisabche.com/docs](https://hisabche.com/docs)

---

## ✨ Features

- 📊 **Dashboard** — Real-time KPI cards, AI insights, sales charts
- 🧾 **Invoicing** — Create/print/PDF invoices, quick-invoice under 30s
- 🏬 **Warehouse** — Multi-warehouse inventory, stock transfers, barcode scanning
- 👥 **Customers** — Full CRM, debt tracking, payment recording
- 👤 **HR** — Employees, attendance, payroll, leaves
- 📂 **Projects** — Kanban boards, tasks, time tracking
- 🔐 **Permissions** — Role-based access control (RBAC)
- 🔄 **Offline Sync** — Full offline support with background sync
- 🌍 **i18n** — 3 languages: **فارسی (fa-IR)**, **دری (fa-AF)**, **English (en)**
- 🤖 **Workflow & Approvals** — Multi-step invoice approvals
- 🔔 **Notifications** — Real-time bell + polling
- 📈 **Analytics** — Google Analytics 4, PostHog, Sentry
- 🛡️ **Security** — Row Level Security (RLS), Arcjet rate limiting, audit logs

---

## 🏗️ Architecture

```
hisabche/
├── apps/
│   ├── web/          # Next.js 16 (App Router) + React 19 + Tailwind CSS
│   └── mobile/       # Expo + React Native
├── backend/          # Fastify 4 + Supabase + Zod
├── packages/
│   ├── ui/           # shadcn/ui components + design system
│   ├── api/          # TanStack Query hooks
│   ├── store/        # Zustand state management
│   ├── validation/   # Zod schemas (shared)
│   ├── i18n/         # react-i18next + next-intl translations
│   ├── auth/         # Supabase Auth client
│   ├── db/           # Drizzle ORM (mobile sync)
│   ├── analytics/    # Sentry + PostHog
│   └── config/       # Environment variables
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| **Mobile** | Expo, React Native |
| **Backend** | Fastify 4, Node.js |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Drizzle ORM |
| **Validation** | Zod |
| **State** | Zustand |
| **Query** | TanStack Query v5 |
| **Auth** | Supabase Auth (JWT + RLS) |
| **i18n** | react-i18next + next-intl |
| **PDF** | @react-pdf/renderer |
| **Realtime** | Supabase Realtime |
| **Monitoring** | Sentry, PostHog, GA4 |
| **CI/CD** | GitHub Actions |
| **Monorepo** | Turborepo |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase account
- Git

### 1. Clone & Install

```bash
git clone https://github.com/hamednourzaei/hisabche.git
cd hisabche
npm install
```

### 2. Environment Variables

Create `.env.local` in `apps/web/` and `backend/`:

```env
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

```env
# backend/.env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

### 3. Run Development Servers

```bash
# Start backend (port 3001)
cd backend
npm run dev

# Start frontend (port 3019)
cd apps/web
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

---

## 📖 API Documentation

Full interactive API docs are available at:

```
https://hisabche.com/docs
```

Or locally at:

```
http://localhost:3001/docs
```

### Key Endpoints

| Method | Endpoint | Description |
|--------|---------|-------------|
| `POST` | `/auth/login` | User login |
| `POST` | `/auth/signup` | User registration |
| `GET` | `/products` | List products |
| `POST` | `/products` | Create product |
| `PUT` | `/products/:id` | Update product |
| `DELETE` | `/products/:id` | Delete product |
| `GET` | `/invoices` | List invoices |
| `POST` | `/invoices` | Create invoice |
| `GET` | `/invoices/:id/pdf` | Download invoice PDF |
| `GET` | `/customers` | List customers |
| `POST` | `/customers` | Create customer |
| `GET` | `/warehouse` | List warehouses |
| `GET` | `/hr/employees` | List employees |
| `GET` | `/projects` | List projects |
| `GET` | `/audit` | Audit logs |
| `GET` | `/analytics/dashboard` | Dashboard stats |

> **Full list:** 120+ endpoints across 21 route files

---

## 🗄️ Database

**48 tables** including:

| Module | Tables |
|--------|--------|
| **Core** | products, customers, suppliers, invoices, invoice_items, transactions |
| **Accounting** | accounts, ledger_entries, journal_entries, journal_lines |
| **Inventory** | warehouses, stock_movements |
| **Purchasing** | purchase_orders, purchase_order_items |
| **Manufacturing** | boms, bom_items, work_orders |
| **HR** | employees, departments, attendance, payrolls, leaves |
| **Projects** | projects, project_tasks, project_members, project_time_entries |
| **Workspace** | workspaces, workspace_members, workspace_invites, permissions, roles |
| **Infra** | audit_logs, event_log, sync_queue, notifications, workflows, background_jobs |

---

## 🌍 Internationalization (i18n)

| Language | Code | Direction | Status |
|----------|------|:--------:|:------:|
| فارسی | `fa-IR` | RTL | ✅ |
| دری | `fa-AF` | RTL | ✅ |
| English | `en` | LTR | ✅ |

- **Routing:** `next-intl` with proxy middleware
- **Content:** `react-i18next` with JSON translation files
- **SEO:** Dynamic metadata per locale, hreflang tags, sitemap (54 URLs)

---

## 🧪 Testing

| Type | Tool | Tests | Status |
|------|------|:-----:|:------:|
| **E2E** | Playwright | 29 | ✅ |
| **API** | Vitest | 5 | ✅ |
| **Lint** | ESLint 9 | 11 packages | ✅ |
| **TypeCheck** | tsc | via build | ✅ |

```bash
# Run E2E tests
cd apps/web && npx playwright test

# Run API tests
cd backend && npx vitest run

# Run lint
npm run lint
```

---

## 🚢 Deployment

| Service | Platform | URL |
|---------|----------|-----|
| **Frontend** | Vercel | [hisabche.com](https://hisabche.com) |
| **Backend** | Render | [hisabche-api.onrender.com](https://hisabche-api.onrender.com) |
| **Database** | Supabase | PostgreSQL |

---

## 🔒 Security

- ✅ Row Level Security (RLS) on all tables
- ✅ JWT Authentication via Supabase Auth
- ✅ Rate Limiting with Arcjet
- ✅ Input Validation with Zod
- ✅ Audit Logging
- ✅ Tenant Isolation (workspace_id)
- ✅ Soft Delete (deleted_at)
- ✅ Token Hashing (SHA256) for invite system

---

## 📁 Project Stats

| Metric | Value |
|--------|:-----:|
| **Files** | ~300+ |
| **Database Tables** | 48 |
| **API Endpoints** | 120+ |
| **Packages** | 9 |
| **Languages** | 3 |
| **E2E Tests** | 29 |
| **API Tests** | 5 |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Proprietary. All rights reserved.

---

## 📧 Contact

**Website:** [hisabche.com](https://hisabche.com)  
**GitHub:** [github.com/hamednourzaei/hisabche](https://github.com/hamednourzaei/hisabche)  
**Email:** support@hisabche.com

---

**Made with ❤️ for businesses in Iran & Afghanistan**
```