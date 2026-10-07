# Session Cache: 2026-10-07 (UX Hardening & Wrench Customizer Fixes)

## Context
The user requested a massive Responsive UX / Layout Hardening Pass across Hisabche, moving from Desktop to iPad/Mobile without breaking layout.
We also faced challenges with the Global Page Customizer (Wrench) and the 'No Sales' empty state in the sales chart, as well as fixing a confusing 10.7 GB browser storage quota display in the Settings.

## Bugs Fixed
1. **Wrench Customizer on Hub Pages**: The \GlobalPageCustomizer\ in \DashboardHeader\ was failing to show page-specific sections for manually built hubs (\Customers\, \Warehouse\, \Governance\, \Sales\, \Approvals\). Fixed by injecting \RegisterCustomizer\ into those hubs.
2. **Next-Intl Signature Errors**: Added fallback strings to \	()\ causing \	sc\ errors. Removed fallbacks and correctly scoped translations.
3. **SalesHub Namespace Bug**: Using \useTranslations('salesHub')\ caused global customizer keys like \pageLook.hubSections\ to incorrectly resolve to \salesHub.pageLook.hubSections\. Solved by using a separate \	Global\ for global keys.
4. **Sales Chart (Empty State)**: The chart previously showed an empty state 'No sales in this period' when all values were zero (\llZero\). Removed the empty state entirely so Recharts gracefully renders a flat line on the 0 axis.
5. **Confusing Storage Quota**: The Settings page used \
avigator.storage.estimate()\ to show the browser's origin quota (e.g., 10.7 GB), which alarmed users. Modified \StorageSection\ to only display actual \usage\.

## Test Success
- Wrote RTL test for \StorageSection\'s clear cache button.
- Ran \pnpm --filter ui type-check\ multiple times until zero errors were achieved.
- Ran \pnpm --filter web build\ to statically compile and verify Next.js production build.
