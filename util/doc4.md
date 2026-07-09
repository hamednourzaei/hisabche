```md
# 📋 Hisabche — Documentation v1.0

## 🏗️ Architecture

```
hisabche/
├── apps/
│   ├── web/          Next.js 16 + React 19
│   └── mobile/       Expo SDK 51 + React Native 0.74
├── packages/
│   ├── ui/           shadcn/ui + custom components
│   ├── api/          TanStack Query hooks + Axios
│   ├── store/        Zustand slices
│   ├── validation/   Zod schemas (shared)
│   ├── i18n/         Dari · English
│   └── db/           WatermelonDB + Drizzle
├── backend/          Fastify 4 + PostgreSQL + Supabase
└── tooling/          Turborepo · ESLint · Prettier · TypeScript strict
```

## 🚀 Running

| Service | Command | Port |
|---------|---------|------|
| Backend | `cd backend && npx tsx src/index.ts` | 3001 |
| Web | `cd apps/web && npx next dev` | 3000 |
| Mobile | `cd apps/mobile && npx expo start --offline` | 8081 |

## 🔑 Key Features

### Invoice Flow
- **QuickInvoice** → ProductPicker + CustomerPicker → ثبت با UUID واقعی
- **Invoice List** → FlashList (mobile) / Card grid (web) → کلیک به جزئیات
- **Invoice Detail** → WhatsApp · Telegram · Email · Share · Print · PDF
- **PDF** → Server-side `@react-pdf/renderer` + Vazirmatn font + Supabase Storage cache
- **Celebration** → Overlay با click-to-dismiss + auto-redirect

### warehouse (Inventory)
- **AddProductModal** → نام · موجودی · قیمت خرید/فروش · واحد · حداقل هشدار
- **Stats** → Multi-currency (AFN/USD/IRR) + ارزش کل موجودی
- **Product Detail** → ویرایش · حذف · سود هر واحد · سود کل

### Multi-Currency
- AFN (افغانی) · USD (دلار) · IRR (تومان)
- Stats bar بالای صفحه warehouse

### Offline-First
- WatermelonDB برای mobile
- TanStack Query با optimistic updates
- Offline indicator + pending queue

### RTL & i18n
- Dari (fa-AF) · Pashto (ps-AF) · English
- CSS logical properties + Tailwind RTL

## 📦 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 3, shadcn/ui |
| Mobile | Expo SDK 51, React Native 0.74, FlashList |
| State | Zustand 4, TanStack Query 5 |
| Validation | Zod 3 (shared schemas) |
| Backend | Fastify 4, PostgreSQL, Supabase |
| PDF | `@react-pdf/renderer` (server-side) |
| Auth | Supabase Auth + JWT |
| Security | Arcjet + Supabase RLS |
| Analytics | PostHog + Sentry (stubs) |

## 📊 Feature Parity

| Feature | Web | Mobile |
|---------|-----|--------|
| QuickInvoice with ProductPicker + CustomerPicker | ✅ | ✅ |
| Invoice List | ✅ | ✅ |
| Invoice Detail | ✅ | ✅ |
| WhatsApp / Telegram / Email / Share | ✅ | ✅ |
| Print | ✅ | ✅ |
| PDF (server-side, RTL, Vazirmatn) | ✅ | ✅ |
| warehouse with AddProductModal | ✅ | ✅ |
| Product Detail + Edit + Delete | ✅ | ✅ |
| Multi-currency Stats | ✅ | ✅ |
| Celebration | ✅ | ✅ |
| Dark/Light Theme | ✅ | ✅ |
| RTL | ✅ | ✅ |
| i18n | ✅ | ✅ |

## 🗂️ Key Files

| File | Purpose |
|------|---------|
| `apps/web/app/invoices/[id]/page.tsx` | Invoice detail |
| `apps/web/app/invoices/[id]/InvoicePDFDownload.tsx` | PDF download button |
| `apps/web/app/quick-invoice/page.tsx` | Quick invoice form |
| `apps/web/app/warehouse/page.tsx` | Inventory list |
| `apps/web/app/warehouse/[id]/page.tsx` | Product detail |
| `packages/ui/src/components/ui/product-picker.tsx` | ProductPicker |
| `packages/ui/src/components/ui/customer-picker.tsx` | CustomerPicker |
| `packages/ui/src/components/ui/add-product-modal.tsx` | Add product modal |
| `packages/ui/src/components/ui/stock-stats-card.tsx` | Stats card |
| `backend/src/routes/invoice-pdf.routes.ts` | PDF API endpoint |
| `backend/src/routes/invoice.routes.ts` | Invoice CRUD |
| `backend/src/routes/product.routes.ts` | Product CRUD |
| `backend/src/pdf/InvoicePDFDocument.tsx` | PDF document template |
| `apps/mobile/App.tsx` | Mobile app shell |
| `apps/mobile/screens/QuickInvoiceScreen.tsx` | Mobile quick invoice |
| `apps/mobile/screens/WarehouseScreen.tsx` | Mobile inventory |
| `apps/mobile/screens/ProductDetailScreen.tsx` | Mobile product detail |
| `apps/mobile/screens/InvoiceDetailScreen.tsx` | Mobile invoice detail |
| `apps/mobile/screens/InvoicesScreen.tsx` | Mobile invoice list |

## 🔐 Environment Variables

```env
# backend/.env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhb...
SUPABASE_DATABASE_URL=postgresql://...

# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🎯 Current Phase: Production-Ready

- ✅ Invoice CRUD with real UUIDs
- ✅ Product/Customer pickers
- ✅ Server-side PDF
- ✅ RTL + i18n
- ✅ Multi-currency
- ✅ Offline-first
- ✅ Feature parity Web ↔ Mobile

## 📈 Next Priorities

1. **Trust & Data Safety** — Audit log · Backup · Restore
2. **Business Intelligence** — Cashflow charts · Debt aging · Reports
3. **Collaboration** — Multi-user workspace
```