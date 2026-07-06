hisabche/
├── LICENSE
├── README.md
├── apps/
│   ├── mobile/
│   │   ├── App.tsx
│   │   ├── app.json
│   │   ├── dir
│   │   ├── globals.css
│   │   ├── index.js
│   │   ├── metro.config.js
│   │   ├── package.json
│   │   ├── screens/
│   │   │   ├── BaqidariScreen.tsx
│   │   │   ├── GodamScreen.tsx
│   │   │   ├── InvoiceDetailScreen.tsx
│   │   │   ├── InvoicesScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── OnboardingScreen.tsx
│   │   │   ├── ProductDetailScreen.tsx
│   │   │   ├── QuickInvoiceScreen.tsx
│   │   │   ├── SettingsScreen.tsx
│   │   │   └── SyncCenterScreen.tsx
│   │   ├── src/
│   │   │   └── components/
│   │   │       ├── Celebration.tsx
│   │   │       ├── EmptyState.tsx
│   │   │       ├── FAB.tsx
│   │   │       └── TrustBar.tsx
│   │   └── tsconfig.json
│   │
│   └── web/
│       ├── app/
│       │   ├── (dashboard)/
│       │   │   ├── audit/
│       │   │   ├── baqidari/
│       │   │   ├── constants/
│       │   │   ├── dashboard/
│       │   │   ├── dashboard-layout.tsx
│       │   │   ├── godam/
│       │   │   ├── hr/
│       │   │   ├── invoices/
│       │   │   ├── layout.tsx
│       │   │   ├── loading.tsx
│       │   │   ├── onboarding/
│       │   │   ├── page.tsx
│       │   │   ├── permissions/
│       │   │   ├── projects/
│       │   │   ├── quick-invoice/
│       │   │   ├── settings/
│       │   │   ├── sync-center/
│       │   │   └── workspace/
│       │   ├── auth-gate.tsx
│       │   ├── client-error-boundary.tsx
│       │   ├── global-error.tsx
│       │   ├── heavy-providers.tsx
│       │   ├── instrumentation-client.ts
│       │   ├── layout.tsx
│       │   ├── login/
│       │   │   ├── LoginClient.tsx
│       │   │   └── page.tsx
│       │   ├── page.tsx
│       │   ├── pricing/
│       │   │   └── page.tsx
│       │   ├── providers.tsx
│       │   ├── robots.ts
│       │   ├── signup/
│       │   │   ├── SignupClient.tsx
│       │   │   └── page.tsx
│       │   └── sitemap.ts
│       ├── e2e/
│       │   └── critical-paths.spec.ts
│       ├── eslint.config.mjs
│       ├── instrumentation.ts
│       ├── lib/
│       │   ├── posthog-client.ts
│       │   └── utils.ts
│       ├── package.json
│       ├── playwright.config.ts
│       ├── postcss.config.js
│       ├── public/
│       │   ├── android-chrome-192x192.png
│       │   ├── android-chrome-512x512.png
│       │   ├── apple-touch-icon.png
│       │   ├── dir
│       │   ├── favicon-128x128.png
│       │   ├── favicon-16x16.png
│       │   ├── favicon-32x32.png
│       │   ├── favicon-48x48.png
│       │   ├── favicon-64x64.png
│       │   ├── favicon.ico
│       │   ├── fonts/
│       │   │   ├── Vazirmatn-Bold.ttf
│       │   │   └── Vazirmatn-Regular.ttf
│       │   ├── logo-icon.png
│       │   ├── manifest.json
│       │   ├── site.webmanifest
│       │   └── test.html
│       ├── sentry.client.config.ts
│       ├── sentry.edge.config.ts
│       ├── sentry.server.config.ts
│       ├── tailwind.config.ts
│       ├── test-results/
│       ├── tsconfig.json
│       └── playwright.config.ts
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── db.ts
│   │   ├── drizzle-schema.ts
│   │   ├── errors/
│   │   │   ├── auth.error.ts
│   │   │   ├── base.error.ts
│   │   │   └── database.error.ts
│   │   ├── fonts/
│   │   │   ├── Vazirmatn-Bold.ttf
│   │   │   └── Vazirmatn-Regular.ttf
│   │   ├── index.ts
│   │   ├── middleware/
│   │   │   ├── arcjet.ts
│   │   │   └── auth.middleware.ts
│   │   ├── pdf/
│   │   │   └── InvoicePDFDocument.tsx
│   │   ├── queue/
│   │   │   └── pdf-queue.ts
│   │   ├── routes/
│   │   │   ├── accounting.routes.ts
│   │   │   ├── ai.routes.ts
│   │   │   ├── analytics.routes.ts
│   │   │   ├── audit.routes.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── crm.routes.ts
│   │   │   ├── customer.routes.ts
│   │   │   ├── event.routes.ts
│   │   │   ├── godam.routes.ts
│   │   │   ├── hr.routes.ts
│   │   │   ├── invoice-pdf.routes.ts
│   │   │   ├── invoice.routes.ts
│   │   │   ├── manufacturing.routes.ts
│   │   │   ├── permission.routes.ts
│   │   │   ├── product.routes.ts
│   │   │   ├── project.routes.ts
│   │   │   ├── purchasing.routes.ts
│   │   │   ├── sync.routes.ts
│   │   │   ├── transaction.routes.ts
│   │   │   └── workspace.routes.ts
│   │   ├── services/
│   │   │   ├── accounting.service.ts
│   │   │   ├── ai.service.ts
│   │   │   ├── analytics.service.ts
│   │   │   ├── audit.service.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── crm.service.ts
│   │   │   ├── customer.service.ts
│   │   │   ├── event.service.ts
│   │   │   ├── godam.service.ts
│   │   │   ├── hr.service.ts
│   │   │   ├── invoice.service.ts
│   │   │   ├── manufacturing.service.ts
│   │   │   ├── permission.service.ts
│   │   │   ├── product.service.ts
│   │   │   ├── project.service.ts
│   │   │   ├── purchasing.service.ts
│   │   │   └── workspace.service.ts
│   │   └── utils/
│   │       └── product.mapper.ts
│   └── tsconfig.json
│
├── dir
├── drizzle.config.ts
├── echo
├── env.example
├── npm
├── package-lock.json
├── package.json
│
├── packages/
│   ├── analytics/
│   │   └── src/
│   │       ├── index.ts
│   │       ├── posthog.ts
│   │       └── sentry.ts
│   │
│   ├── api/
│   │   ├── package.json
│   │   └── src/
│   │       ├── __tests__/
│   │       │   └── helpers.test.ts
│   │       ├── hooks/
│   │       │   ├── audit.ts
│   │       │   ├── auth.ts
│   │       │   ├── customers.ts
│   │       │   ├── dashboard.ts
│   │       │   ├── employees.ts
│   │       │   ├── index.ts
│   │       │   ├── invoices.ts
│   │       │   ├── permissions.ts
│   │       │   ├── products.ts
│   │       │   ├── projects.ts
│   │       │   ├── transactions.ts
│   │       │   ├── useRealtime.ts
│   │       │   └── workspace.ts
│   │       ├── index.ts
│   │       ├── lib/
│   │       │   └── client.ts
│   │       └── supabase/
│   │           └── realtime.ts
│   │
│   ├── auth/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── auth.ts
│   │   │   ├── index.ts
│   │   │   └── supabase.ts
│   │   └── tsconfig.json
│   │
│   ├── config/
│   │   ├── package.json
│   │   └── src/
│   │       └── env.ts
│   │
│   ├── db/
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── database.ts
│   │   │   ├── index.ts
│   │   │   ├── mobile.ts
│   │   │   ├── models/
│   │   │   │   ├── Customer.model.ts
│   │   │   │   ├── Invoice.model.ts
│   │   │   │   └── Product.model.ts
│   │   │   ├── schema/
│   │   │   │   └── schema.ts
│   │   │   ├── schema.ts
│   │   │   ├── server.ts
│   │   │   ├── supabase.ts
│   │   │   ├── sync-queue.ts
│   │   │   └── sync.ts
│   │   └── tsconfig.json
│   │
│   ├── i18n/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── locales/
│   │           ├── en.json
│   │           ├── fa-AF.json
│   │           └── fa-IR.json
│   │
│   ├── store/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── lib/
│   │       │   └── encryption.ts
│   │       └── slices/
│   │           ├── auth.slice.ts
│   │           ├── backup.slice.ts
│   │           ├── cart.slice.ts
│   │           ├── currency.slice.ts
│   │           ├── device.slice.ts
│   │           ├── godam.slice.ts
│   │           ├── onboarding.slice.ts
│   │           ├── preferences.slice.ts
│   │           ├── sync.slice.ts
│   │           ├── theme.slice.ts
│   │           └── workspace.slice.ts
│   │
│   ├── ui/
│   │   ├── components.json
│   │   ├── package.json
│   │   ├── postcss.config.js
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   └── ui/
│   │   │   │       ├── dashboard/
│   │   │   │       │   ├── ai-insights.tsx
│   │   │   │       │   ├── containers/
│   │   │   │       │   ├── dashboard-invoices.tsx
│   │   │   │       │   ├── dashboard-stats.tsx
│   │   │   │       │   ├── dashboard-view.tsx
│   │   │   │       │   ├── date-range-picker.tsx
│   │   │   │       │   ├── kpi-cards.tsx
│   │   │   │       │   └── sales-chart.tsx
│   │   │   │       ├── landing/
│   │   │   │       │   ├── cinematic-hero.tsx
│   │   │   │       │   ├── cta-scene.tsx
│   │   │   │       │   ├── faq-scene.tsx
│   │   │   │       │   ├── features-scene.tsx
│   │   │   │       │   ├── index.ts
│   │   │   │       │   ├── landing-page.tsx
│   │   │   │       │   ├── pain-scene.tsx
│   │   │   │       │   ├── social-scene.tsx
│   │   │   │       │   ├── stats-section.tsx
│   │   │   │       │   ├── transform-scene.tsx
│   │   │   │       │   ├── use-scene-observer.ts
│   │   │   │       │   └── use-scroll-narrative-store.ts
│   │   │   │       ├── audit/
│   │   │   │       │   ├── audit-view.tsx
│   │   │   │       │   └── containers/
│   │   │   │       │       └── audit-container.tsx
│   │   │   │       ├── select.tsx
│   │   │   │       ├── jalali-datepicker.tsx
│   │   │   │       └── ...
│   │   │   ├── containers/
│   │   │   ├── hooks/
│   │   │   │   ├── baqidari/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── godam/
│   │   │   │   ├── invoices/
│   │   │   │   ├── menu/
│   │   │   │   ├── use-autosave.ts
│   │   │   │   ├── use-currency.ts
│   │   │   │   └── use-sort-filter.ts
│   │   │   ├── index.ts
│   │   │   ├── lib/
│   │   │   │   ├── baqidari/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── export.ts
│   │   │   │   ├── godam/
│   │   │   │   ├── invoices/
│   │   │   │   ├── menu/
│   │   │   │   ├── persian-numbers.ts
│   │   │   │   ├── use-in-view.ts
│   │   │   │   └── utils.ts
│   │   │   └── styles/
│   │   │       ├── cinematic-motion.css
│   │   │       ├── globals.css
│   │   │       └── lite-mode.css
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── validation/
│       ├── package.json
│       └── src/
│           ├── __tests__/
│           │   └── schemas.test.ts
│           ├── index.ts
│           └── schemas/
│               ├── accounting.schema.ts
│               ├── ai.schema.ts
│               ├── analytics.schema.ts
│               ├── audit.schema.ts
│               ├── auth.schema.ts
│               ├── common.schema.ts
│               ├── crm.schema.ts
│               ├── customer.schema.ts
│               ├── event.schema.ts
│               ├── godam.schema.ts
│               ├── hr.schema.ts
│               ├── invoice.schema.ts
│               ├── manufacturing.schema.ts
│               ├── permission.schema.ts
│               ├── product.schema.ts
│               ├── project.schema.ts
│               ├── purchasing.schema.ts
│               ├── sync.schema.ts
│               ├── transaction.schema.ts
│               └── workspace.schema.ts
│
├── prettier.config
├── scripts/
│   └── generate-icons.js
├── structure.txt
├── tsconfig.json
├── turbo.json
├── type
│
└── util/
    ├── 2manifest new.md
    ├── Manifest v7.md
    ├── ai,assists.md
    ├── debug-prompt.md
    ├── doc.md
    ├── doc3.md
    ├── doc4.md
    ├── doc6.md
    ├── docupdate.md
    ├── dpc7.md
    ├── hisabche.remote
    ├── key
    ├── logos.summary
    ├── main.manifest.md
    ├── manifest7.md
    ├── newdoc5.md
    ├── prompt 4.md
    ├── prompt new.md
    ├── prompt.md
    ├── prompt3.md
    ├── prompt4.md
    ├── project-structure.md
    └── 🧮 Hisabche — Development Log & Product Roadmap v5.0