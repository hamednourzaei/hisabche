# Hisabche UX Reconstruction — Progress Tracker

> **Last Updated:** `2026-11-27` | **Current Route:** `/invoices` (`WAITING_FOR_OWNER_VISUAL_APPROVAL`)

## A. Workspace Routes (30 Routes — Web + Desktop + Mobile WebView)

| Route ID                  | Path                    | Discovery    | Design            | Desktop            | Mobile            | Implementation | Functional          | Responsive    | A11y              | i18n                        | Industry      | Approval                                                    |
| ------------------------- | ----------------------- | ------------ | ----------------- | ------------------ | ----------------- | -------------- | ------------------- | ------------- | ----------------- | --------------------------- | ------------- | ----------------------------------------------------------- |
| `dashboard`               | `/dashboard`            | `DISCOVERED` | `BLUEPRINT_READY` | `DESKTOP_DESIGNED` | `MOBILE_DESIGNED` | `IMPLEMENTED`  | `TESTING`           | `IMPLEMENTED` | `BLUEPRINT_READY` | `DISCOVERED`                | `IMPLEMENTED` | `APPROVED`                                                  |
| `invoices`                | `/invoices`             | `DISCOVERED` | `BLUEPRINT_READY` | `DESKTOP_DESIGNED` | `MOBILE_DESIGNED` | `IMPLEMENTED`  | `VERIFIED_IN_TESTS` | `IMPLEMENTED` | `BLUEPRINT_READY` | `VERIFIED` (`fa`/`af`/`en`) | `IMPLEMENTED` | `WAITING_FOR_OWNER_VISUAL_APPROVAL`                         |
| `invoices-new`            | `/invoices/new`         | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `invoices-new-preview`    | `/invoices/new/preview` | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `invoices-detail`         | `/invoices/:id`         | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `till`                    | `/till`                 | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `warehouse`               | `/warehouse`            | `DISCOVERED` | `BLUEPRINT_READY` | `DESKTOP_DESIGNED` | `MOBILE_DESIGNED` | `IMPLEMENTED`  | `TESTING`           | `IMPLEMENTED` | `BLUEPRINT_READY` | `DISCOVERED`                | `IMPLEMENTED` | `INVENTORY_PROCUREMENT_REFACTOR_WAITING_FOR_OWNER_APPROVAL` |
| `warehouse-detail`        | `/warehouse/:id`        | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `accounting`              | `/accounting`           | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `customers`               | `/customers`            | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `customers-detail`        | `/customers/:id`        | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `team-and-payroll`        | `/team-and-payroll`     | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `team-and-payroll-detail` | `/team-and-payroll/:id` | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `approvals`               | `/approvals`            | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `manufacturing`           | `/manufacturing`        | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `analysis`                | `/analysis`             | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `market-seller`           | `/market-seller`        | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `BLOCKED` (`DISABLED_PAGES`)                                |
| `marketplace`             | `/marketplace`          | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `BLOCKED` (`DISABLED_PAGES`)                                |
| `operations`              | `/operations`           | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `stock-count`             | `/stock-count`          | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `settings`                | `/settings`             | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `activities`              | `/activities`           | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `data-and-sync`           | `/data-and-sync`        | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `sync-center`             | `/sync-center`          | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `billing`                 | `/billing`              | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `assistant`               | `/assistant`            | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `governance`              | `/governance`           | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `developers`              | `/developers`           | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `audit`                   | `/audit`                | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |
| `onboarding`              | `/onboarding`           | `DISCOVERED` | `NOT_STARTED`     | `NOT_STARTED`      | `NOT_STARTED`     | `NOT_STARTED`  | `NOT_STARTED`       | `NOT_STARTED` | `NOT_STARTED`     | `NOT_STARTED`               | `NOT_STARTED` | `NOT_STARTED`                                               |

## B. Platform Admin Routes (`apps/admin` — 27 Routes, Web Only)

| Route ID                 | Admin Path       | Discovery    | Reconstruction Status | Approval      |
| ------------------------ | ---------------- | ------------ | --------------------- | ------------- |
| `admin-ai`               | `/ai`            | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-audit-logs`       | `/audit-logs`    | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-blog`             | `/blog`          | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-blog-new`         | `/blog/new`      | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-blog-detail`      | `/blog/:id`      | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-cms-globals`      | `/cms/globals`   | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-cms-media`        | `/cms/media`     | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-cms-pages`        | `/cms/pages`     | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-cms-pages-new`    | `/cms/pages/new` | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-cms-pages-detail` | `/cms/pages/:id` | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-content`          | `/content`       | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-customers`        | `/customers`     | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-dashboard`        | `/dashboard`     | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-market`           | `/market`        | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-oauth-apps`       | `/oauth-apps`    | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-offline`          | `/offline`       | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-operations`       | `/operations`    | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-product`          | `/product`       | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-revenue`          | `/revenue`       | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-security`         | `/security`      | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-servers`          | `/servers`       | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-subscriptions`    | `/subscriptions` | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-users`            | `/users`         | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-wallet`           | `/wallet`        | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-workspaces`       | `/workspaces`    | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-login`            | `/login`         | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
| `admin-wall`             | `/wall`          | `DISCOVERED` | `NOT_STARTED`         | `NOT_STARTED` |
