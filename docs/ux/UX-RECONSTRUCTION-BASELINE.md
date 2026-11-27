# Hisabche UX Reconstruction — Baseline & Completeness Report

> **Phase 0 Deliverable** | Revised: `2026-11-26` | All values measured directly from source.

## 1. Measurable Completeness Report

| Discovery Target                     |           Discovered |                                          Verified on Disk | Unresolved | Evidence Path                                              |
| ------------------------------------ | -------------------: | --------------------------------------------------------: | ---------: | ---------------------------------------------------------- |
| Web Workspace `(dashboard)` Routes   |                   30 |                                                        30 |          0 | `apps/web/app/[lang]/(dashboard)/**/page.tsx`              |
| Web Public / Auth / Token Routes     |                   37 |                                                        37 |          0 | `apps/web/app/[lang]/**/page.tsx`                          |
| Web Legacy `moved` Redirects         |                   31 |                                                        31 |          0 | `apps/web/next.config.js`                                  |
| App-Shell Route Entries              |                   74 |                          74 (36 active + 38 `<Navigate>`) |          0 | `packages/app-shell/src/app/app.tsx`                       |
| Platform Admin Routes (`apps/admin`) |                   27 |                                                        27 |          0 | `apps/admin/app/[lang]/**/page.tsx`                        |
| Mobile Native Host                   |       1 WebView host |                                                         1 |          0 | `apps/mobile/app/_layout.tsx` -> `shell-webview.tsx`       |
| `NAV_CONTRACT` Destinations          |                   17 |                                                        17 |          0 | `packages/ui-contract/src/navigation.ts`                   |
| Industry Profiles (`INDUSTRY_KEYS`)  |                   67 | 67 (66 trade profiles; `retail`/`wholesale` sales models) |          0 | `packages/validation/src/schemas/industry-profiles.ts`     |
| Business Capabilities                |                   53 |            53 (`4` available, `36` partial, `13` planned) |          0 | `packages/validation/src/schemas/business-capabilities.ts` |
| Engines & Feature Packs              | 21 engines / 7 packs |                                                    21 / 7 |          0 | `packages/validation/src/schemas/feature-packs.ts`         |

## 2. Shared UI, Responsive & Token Hygiene (`packages/ui/src/components/ui/`)

- **UI Source Files (non-test):** `565` (`63` containers/pages)
- **Component Reuse:** `HubTabs`/`PageHub` (`19` files), `SegmentedControl` (`33` files), `DataTable` (`68` files), `SelectField` (`112` files)
- **Responsive Gaps Found in Phase 0:**
  - `GovernanceHubContainer` (`governance/`) has **0** responsive Tailwind breakpoint prefixes (`sm:/md:/lg:/xl:`) and no mobile hook.
  - `17/30` workspace domains have no `useIsMobile` / `useMediaQuery` mobile-specific adaptation (relying purely on CSS breakpoints + WebView).
- **Hygiene Violations Found:**
  - Raw `<select>` (`4` files): `select-field.tsx` (the shared wrapper itself), `invoice-builder/grid/grid-cell.tsx`, `warehouse-detail/warehouse-detail-page.tsx`, `workflow/workflow-templates-view.tsx`
  - Hardcoded hex colors (`2` files): `chart.tsx`, `invoice-detail/containers/invoice-detail-container.tsx`
  - Physical direction CSS classes (`1` file): `kpi-card.tsx`
- **Existing Tests:** `227` test files in `packages/ui/src/__tests__/`, `33` in `packages/app-shell/`.

## 3. Failed Discovery Commands Disclosure (Zero Coverage Loss)

During Phase 0 discovery on Windows PowerShell, 3 initial shell commands exited non-zero due to PowerShell syntax/tool availability:

1. `ls -d apps/* packages/* ...` (exit `1`): PowerShell `Get-ChildItem` does not accept `-d` as bash `ls` does -> **Re-run** with `Get-ChildItem ... -Directory` (exit `0`).
2. `rg -n "moved|redirects" apps/web/next.config.*` (exit `1`): `rg` binary not in Windows PATH -> **Re-run** with `Select-String` (exit `0`).
3. Inline `node -e "..."` with regex quotes (exit `1`): PowerShell stripped inner quotes -> **Re-run** via here-string piped to `node -` (exit `0`).

**Impact on Coverage:** None (`0` unresolved routes or files).
