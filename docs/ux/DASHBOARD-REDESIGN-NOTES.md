# Dashboard UI + UX Redesign Changelog (Phase 2)

> **Route:** `/dashboard` | **Date:** `2026-11-26` | **Status:** `DASHBOARD_UI_IMPLEMENTED_WAITING_FOR_OWNER_APPROVAL`

## Summary of Changes

1. **Top Workspace Hierarchy & Quick Operational Actions** (`dashboard-view.tsx`, `dashboard-container.tsx`)
   - Moved `FirstValueChecklist` and `setupGapsPrompt` below the main dashboard surface so `Greeting`, Quick Operational Actions (`فاکتور جدید`, `صندوق`, `انبار`, `مشتریان`), and KPIs appear immediately above the fold.
   - Added a unified top utility bar for `RegisterCustomizer`, `AiAssistantLauncher`, `DisplayBasisPicker`, and `ExchangeRateDialog`.
2. **KPI Cards Overflow & Scaling Protection** (`kpi-card.tsx`, `dashboard-view.tsx`)
   - Extended `valueFontClass()` to step down further for long numbers (`21–25` chars and `>25` chars) and added `overflow-hidden` + `max-w-full` on `KpiCard` so numbers with many zeros never overflow the card frame.
   - Highlighted the primary `totalSales` KPI card with `ring-1 ring-[hsl(var(--color-primary)/0.25)]`.
3. **12-Column Chart + 2-Column AI Insights Grid** (`dashboard-view.tsx`)
   - Desktop (`lg+`) uses `lg:col-span-7` (Chart) + `lg:col-span-5` (AI Insights), expanding automatically to `lg:col-span-12` when either is hidden (zero empty slots).
   - `AIInsightsPanel` uses `grid-cols-2` at **all** viewport sizes with `h-full` cards and unified header styling matching `RecentActivities`.
4. **Mobile-Adaptive Recent Activities & Industry Cards** (`dashboard-view.tsx`, `dashboard-container.tsx`)
   - Added `"مشاهده همه"` (`/activities`) in the `RecentActivities` header and converted `< sm` mobile rows into two-line touch-friendly cards (`min-h-[44px]`).
   - Wrapped active industry/operational cards in a responsive `grid-cols-1 lg:grid-cols-2` container (mounted only when at least one card is active).
