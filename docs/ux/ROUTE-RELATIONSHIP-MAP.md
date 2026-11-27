# Hisabche UX Reconstruction — Route Relationship Map

> **Phase 0 Deliverable** | Generated: `2026-11-26`

## 1. Hub-and-Spoke Product Hierarchy

```text
Hisabche Business OS
├── [Primary Daily Intents]
│   ├── /dashboard                  (Today / KPIs / Quick Actions / Role+Industry Widgets)
│   ├── /invoices                   (Sales & Purchase Hub)
│   │   ├── /invoices/new           (Invoice Builder — Step 1, ?type=sale|purchase)
│   │   ├── /invoices/new/preview   (Invoice Preview — Step 2)
│   │   └── /invoices/:id           (Invoice 360° Detail)
│   ├── /till                       (Cashier Standing Workplace / POS & Shifts)
│   ├── /warehouse                  (Inventory & Catalog Hub)
│   │   ├── /warehouse/:id          (Product Detail & Stock Layers)
│   │   ├── /operations             (Unlinked in nav — Reorder / Ops)
│   │   └── /stock-count            (Unlinked in nav — Cycle Counts)
│   └── /accounting                 (Books, Treasury, Reports, Tax, Close)
├── [People]
│   ├── /customers                  (Customers, Suppliers, Outreach, Campaigns)
│   │   └── /customers/:id          (Customer/Supplier 360° Detail)
│   └── /team-and-payroll           (Staff, Branches, Attendance, Payroll, Timesheets)
│       └── /team-and-payroll/:id   (Employee Detail)
├── [Work & Intelligence]
│   ├── /approvals                  (Approvals Inbox & Workflows)
│   ├── /manufacturing              (BOM, Production Orders)
│   ├── /analysis                   (Business Analytics & Break-even)
│   └── /market-seller              (DISABLED_PAGES — Marketplace Seller)
└── [System & Governance]
    ├── /settings                   (Workspace, Tax, Currency, Hardware, Industry Profile)
    ├── /activities                 (Notifications & Event Stream)
    ├── /data-and-sync              (Data Import, Conflicts, Sync Overview)
    ├── /sync-center                (Standalone Local Outbox Queue — Desktop/Mobile)
    ├── /billing                    (Subscription, Wallet, Referrals)
    ├── /assistant                  (AI Assistant)
    ├── /governance                 (Roles, Permissions, Separation of Duties)
    ├── /developers                 (API Keys, Webhooks, Sandbox; OAuth/Storefront disabled)
    ├── /audit                      (Security & Financial Audit Log)
    └── /onboarding                 (Initial Workspace Bootstrap)
```

## 2. Platform Parity Architecture

- **Web (`apps/web`)**: Next.js 16 App Router (`/[lang]/(dashboard)/*`). Mounts `@hisabche/ui` screen containers directly.
- **Desktop (`apps/desktop` + `packages/app-shell`)**: Electron + React Router (`createHashRouter`). Mounts the exact same `@hisabche/ui` screen containers.
- **Mobile (`apps/mobile`)**: Expo SDK 51 + `ShellWebView` (`assets/shell/index.html` compiled from `@hisabche/app-shell`). Native shell provides SQLite cache, offline outbox queue, secure storage, camera barcode scan, and network state events. Bottom bar shows 3 primary tabs (`today`, `get-paid`, `stock`) + `More` drawer (`MOBILE_TAB_IDS` in `packages/ui-contract/src/navigation.ts`).
- **Locked Global Chrome**: Global Header and Sidebar in `packages/ui` and `packages/app-shell` are **LOCKED** per `hisabche-ux.md §0.1`.
