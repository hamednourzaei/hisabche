```md
# Hisabche — Project Summary

## Tech Stack
Next.js 16 + React 19, React Native + Expo SDK 51, Fastify, Zustand, TanStack Query, Zod, WatermelonDB, Tailwind CSS, shadcn/ui, PostHog, Sentry, Arcjet

## Structure
```
hisabche/
├── apps/
│   ├── web/          Next.js 16 (12 pages, build ready)
│   └── mobile/       Expo SDK 51 (8 screens)
├── packages/
│   ├── ui/           14 components (Button, Input, Card, Badge, Skeleton, Toast, SearchInput, FAB, SyncStatus, OfflineBanner, SaveIndicator, OfflineQueue, EmptyState, Celebration, ErrorBoundary)
│   ├── i18n/         fa-AF + en (200+ keys)
│   ├── store/        10 slices (auth, theme, currency, cart, onboarding, preferences, sync, device, godam, backup)
│   ├── validation/   6 schemas (common, auth, invoice, product, customer, transaction)
│   ├── api/          TanStack hooks (invoices, products, customers, transactions, auth) + Axios client
│   ├── analytics/    PostHog + Sentry
│   ├── db/           WatermelonDB schema + models
│   └── config/       env.ts (dev/staging/production)
├── backend/          Fastify (routes: auth, sync, invoice, product, customer, transaction, godam)
├── scripts/          generate-icons.js
├── .env.local / .env.staging / .env.production
├── turbo.json
└── tsconfig.json
```

## Web Pages (12)
`/` dashboard, `/onboarding` wizard, `/quick-invoice`, `/invoices`, `/godam`, `/baqidari`, `/sync-center`, `/settings`, `/sitemap.xml`, `/robots.txt`, `/login`, error/not-found/loading pages

## Mobile Screens (8)
App.tsx (shell + FAB + TrustBar), LoginScreen, OnboardingScreen, QuickInvoiceScreen, InvoicesScreen, GodamScreen, BaqidariScreen, SyncCenterScreen

## Backend Routes
`/api/auth/*`, `/api/sync/*`, `/api/invoices`, `/api/products`, `/api/customers`, `/api/transactions`, `/api/godams`, `/api/health`

## Key Features
- RTL (Dari/Pashto) + English i18n
- Dark/Light theme with CSS variables
- Offline-first with WatermelonDB
- Zod validation shared client/server
- Onboarding wizard + Quick invoice (<2min)
- FAB floating actions
- Trust UX (sync status, offline banner, backup, audit log)
- Lite mode for slow devices
- Error boundaries + Sentry + PostHog analytics
- Environment separation (dev/staging/prod)
- PWA manifest + SEO metadata
- Production build passing (Next.js 16 + Turbopack)

## Running
```
Terminal 1: cd backend && npx tsx src/index.ts              (port 3001)
Terminal 2: cd apps/web && npx next dev                      (port 3000)
Terminal 3: cd apps/mobile && npx expo start --offline       (port 8081)
Or: npm run dev from root
```

## Current State
Web: build success, all pages working
Backend: running with in-memory store
Mobile: all screens built, Expo Go ready
Production Readiness: 5/5 sprints complete
Ready for: Closed Beta Deploy

## Notes
- Backend uses in-memory store (data lost on restart)
- Sentry config ready but not active until DSN set
- PostHog stub ready, real key needed for production
- Mobile React 18.2 (RN 0.74), Web React 19
- PWA icons are SVG placeholders
```