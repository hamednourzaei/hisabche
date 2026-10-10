# Reports & Analytics (Domain Feature Audit)

## 1. Saved Reports

- **عنوان**: Saved Reports (گزارش‌های ذخیره‌شده)
- **توضیحات**: A feature allowing users to define and save dynamic queries (specifying dataset, groupings, and measures). No results are stored; reports pull live data when executed.
- **Backend**: `backend/src/services/reporting/report.service.ts`, `backend/src/services/reporting/dataset.domain.ts`, `docs/saved-reports-01-migration.sql` (Table: `public.saved_reports`)
- **Frontend**: `packages/ui/src/components/ui/analysis/report-builder.tsx`, `packages/ui/src/components/ui/analysis/report-run-view.tsx`
- **Status**: Implemented

## 2. Report Dashboards

- **عنوان**: Report Dashboards (داشبوردهای تحلیلی)
- **توضیحات**: Arrangements of saved reports into tiles across a grid layout. Users arrange predefined reports dynamically. Like reports, dashboards pull live data at runtime and are versioned by replacing them.
- **Backend**: `backend/src/services/reporting/dashboard.service.ts`, `docs/report-dashboards-01-migration.sql` (Table: `public.report_dashboards`)
- **Frontend**: `packages/ui/src/components/ui/analysis/dashboard-builder.tsx`, `packages/ui/src/components/ui/analysis/analysis-container.tsx`
- **Status**: Implemented

## 3. AI Insights

- **عنوان**: AI Insights (بینش هوش مصنوعی)
- **توضیحات**: AI-generated intelligence and automated analysis of reporting datasets, producing insights that guide user decisions.
- **Backend**: `backend/src/services/insights/insights.service.ts`, `backend/src/services/ai/reporting-reader.ts`
- **Frontend**: `packages/ui/src/components/ui/dashboard/ai-insights.tsx`
- **Status**: Implemented

## 4. Operational & Profit Reports

- **عنوان**: Operational & Profit Reports (گزارش‌های عملیاتی و سود و زیان)
- **توضیحات**: Specialized accounting/financial calculations to report on profit, income, and overall operational balance.
- **Backend**: `backend/src/services/accounting/profit-report.domain.ts`, `backend/src/services/accounting/operational-reports.ts`
- **Frontend**: `packages/ui/src/components/ui/accounting/tabs/IncomeStatementTab.tsx`, `packages/ui/src/components/ui/accounting/AccountingPage.tsx`
- **Status**: Implemented

## 5. Analytics & KPIs

- **عنوان**: General Analytics & KPIs (تحلیل‌های عمومی و شاخص‌ها)
- **توضیحات**: Dashboards containing key performance indicators, benchmarks, breakeven analysis, and high-level charts.
- **Backend**: `backend/src/services/analysis/analysis.service.ts`, `backend/src/services/analytics/benchmark.domain.ts`, `backend/src/services/analytics/break-even.domain.ts`
- **Frontend**: `packages/ui/src/components/ui/dashboard/dashboard-stats.tsx`, `packages/ui/src/components/ui/dashboard/dashboard-view.tsx`
- **Status**: Implemented
