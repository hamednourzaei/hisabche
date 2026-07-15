# 🧾 Hisabche — ERP & CRM System

## 📌 Project Overview

**Name:** Hisabche (حسابچه)  
**Type:** ERP + CRM Hybrid SaaS  
**Target Users:** Small & Medium Businesses (SMB) in Afghanistan, Iran, Pakistan, Turkey  
**Languages:** Persian (Dari/Farsi), English  
**Currencies:** AFN (افغانی), USD (دالر), PKR (کلدار), IRR (تومان)  
**Team Size:** 2 developers  
**Development Time:** ~9 months  
**Status:** Production (v2.0)  

### 🌍 Domains
- **Primary:** [hisabche.com](https://hisabche.com)
- **Redirects:** hisabche.org, hisabche.online → hisabche.com

---

## 🏗️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.2.6 (Turbopack) | Web Application |
| **React** | 19.x | UI Library |
| **TypeScript** | 5.x | Type Safety |
| **Tailwind CSS** | 4.x | Styling |
| **TanStack Query** | 5.x | Server State Management |
| **TanStack Virtual** | 3.x | Virtualized Tables |
| **React i18next** | - | Internationalization |
| **Framer Motion** | - | Animations |
| **Lucide React** | - | Icons |
| **React Hook Form** | - | Form Management |
| **Zod** | - | Validation |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Fastify** | 5.x | API Server |
| **TypeScript** | 5.x | Type Safety |
| **Supabase** | - | Database + Auth + Storage |
| **Drizzle ORM** | - | Schema Definition |
| **PostgreSQL** | 16.x | Database |
| **Resend** | - | Email Service |
| **PostHog** | - | Analytics |
| **Sentry** | - | Error Tracking |
| **BullMQ** | - | Queue System |

### Mobile
| Technology | Purpose |
|------------|---------|
| **React Native** | Android & iOS Apps |
| **WatermelonDB** | Offline Database |
| **Zustand** | State Management |

### Infrastructure
| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend Hosting |
| **Render** | Backend Hosting |
| **Supabase** | Database + Auth + Storage |
| **Cloudflare** | CDN + DNS + CSP |
| **Upstash** | Redis Cache (future) |

---

## 📊 Project Statistics

### Backend
- **API Endpoints:** 131
- **Services:** 22
- **Database Tables:** 42
- **Indexes:** 64
- **Materialized Views:** 1

### Frontend
- **Pages:** 26 dynamic routes
- **Components:** 100+ reusable
- **Hooks:** 50+ TanStack Query hooks
- **Languages:** 4 (fa-IR, fa-AF, en, ps)

### Performance (Production)
- **Dashboard:** 5.8s → 1.4s (76% improvement)
- **Invoice List:** 3.5s → 0.7s (80% improvement)
- **EXPLAIN ANALYZE:** 0.132ms (Index Scan)

---

## 🎯 Core Modules

### 1. 📊 Dashboard
- Real-time KPIs (sales, debt, customers, inventory)
- AI-powered insights
- Sales charts (30-day)
- Quick actions

### 2. 📋 Invoices
- Create/Edit/Delete invoices
- Invoice items with product selection
- PDF generation (React PDF)
- Payment tracking (paid/unpaid/partial)
- Discount & tax support
- Barcode scanning (mobile)

### 3. 👥 Customers (Baqidari)
- Customer list with debt tracking
- **Customer Workspace v4:**
  - 360° Header with health score
  - KPI summary cards
  - DataGrid with virtual scrolling
  - Smart filters (All, VIP, Debtors, Overdue)
  - Export to CSV/Excel
  - **Progressive Disclosure:** CRM tabs only for credit customers
  - AI summary widget
  - Next best action suggestions

### 4. 📦 Warehouse (Godam)
- Product management (CRUD)
- Stock tracking with low-stock alerts
- Stock transfers between warehouses
- Barcode/SKU support
- Category management

### 5. 💰 Accounting
- Double-entry journal entries
- Trial balance
- Balance sheet
- Income statement
- Account management (Chart of Accounts)
- **Unified financial data:** Single source of truth via journal_entries

### 6. 👨‍💼 HR (Human Resources)
- Employee management
- Department management
- Attendance tracking
- Payroll processing
- Leave management

### 7. 📐 Projects
- Project lifecycle management
- Task management (Kanban-style)
- Team member assignment
- Time tracking
- Progress tracking

### 8. 🏢 Workspace
- Multi-tenant workspace management
- Member roles (Owner, Admin, Member, Viewer)
- Invite system with token-based authentication
- Permission management

### 9. 🔐 Permissions & RBAC
- Role-based access control (33 default permissions)
- Custom role creation
- Permission assignment per role
- Global + workspace-level roles

### 10. 📝 Audit
- Full audit trail (who, when, what, old/new values)
- Entity-level history tracking
- Export audit logs
- Auto-triggered via database triggers

### 11. 🤝 CRM
- Customer interactions (call, email, SMS, meeting, note)
- Sales opportunities with pipeline stages
- Integrated into Customer Workspace

### 12. 🏭 Manufacturing
- Bill of Materials (BOM) management
- Work orders
- Production tracking

### 13. 📦 Purchasing
- Purchase order management
- Supplier management
- Goods receipt tracking
- Linked to invoices (type=purchase)

### 14. 🔔 Workflow & Approvals
- Custom approval workflows
- Multi-step approval process
- Auto-notification on approval actions
- Instance tracking with FK relationships

### 15. 🔔 Notifications
- In-app notification bell
- Real-time Supabase subscriptions
- Read/unread tracking
- Action URLs for direct navigation

### 16. 🔄 Sync (Offline-First)
- Offline data entry support
- Background sync queue
- Conflict resolution
- Mobile-optimized

### 17. ⚙️ Settings
- Business profile
- Currency preferences
- Language selection (fa-IR, fa-AF, en)
- Theme (Light/Dark/System)
- Performance mode (Auto/Normal/Lite)
- Backup & restore

---

## 🏗️ Architecture Highlights

### Performance Optimizations (v2.0)
1. **Explicit Column Selection:** All 22 services use explicit columns instead of `SELECT *`
2. **Composite Indexes:** 64 indexes across 42 tables
3. **N+1 Query Elimination:** Batch queries via `Promise.all`
4. **Keyset Pagination:** Cursor-based pagination for large datasets
5. **Materialized Views:** Dashboard summary pre-computed
6. **Full-Text Search:** PostgreSQL GIN indexes on products, customers, invoices
7. **Memory Cache:** Layer 1 cache with TTL + invalidation on write
8. **Connection Pooling:** Supabase PgBouncer (Shared Pooler)
9. **Compression:** Brotli/Gzip via @fastify/compress
10. **Virtualization:** TanStack Virtual for large tables (10,000+ rows)

### Security
1. **CSP Headers:** Content-Security-Policy with strict directives
2. **Rate Limiting:** Per-user rate limiting
3. **Audit Triggers:** Auto-logging on invoices, products, customers
4. **JWT Authentication:** Supabase Auth
5. **Row-Level Security:** Supabase RLS
6. **Input Validation:** Zod schemas on all endpoints
7. **Security Headers:** X-Frame-Options, X-Content-Type-Options, Referrer-Policy

### Data Architecture
- **Unified Financial Data:** Single source of truth via journal_entries
- **Progressive Disclosure:** CRM features only for credit customers
- **Multi-tenancy:** workspace_id-based data isolation
- **Soft Deletes:** deleted_at columns for audit compliance

---

## 📱 Mobile Features
- React Native app (Android + iOS)
- Offline-first with WatermelonDB
- Barcode scanning
- Real-time sync
- Push notifications

---

## 🔧 Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/hisabche.git

# Install dependencies
cd hisabche
npm install

# Start web app
cd apps/web
npm run dev

# Start backend
cd backend
npm run dev

# Start mobile
cd apps/mobile
npx react-native start