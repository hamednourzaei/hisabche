# Hisabche UX Reconstruction — Responsive UX Standard

> **Phase 1 Deliverable** | Generated: `2026-11-26`

## 1. Breakpoints (Tailwind Standard — No Custom Conflicting System)

- **Compact Mobile:** `< 640px` (base)
- **Larger Mobile / Phablet:** `sm` (`>= 640px`)
- **Tablet:** `md` (`>= 768px`) — transition point from card-list/bottom-sheet to `DataTable`/side-sheet
- **Small Laptop:** `lg` (`>= 1024px`) — sidebar visible, multi-column grids
- **Standard / Large Desktop:** `xl` (`>= 1280px`), `2xl` (`>= 1440px` container max)

## 2. Density & Touch Targets (From `packages/design-tokens/src/scale.ts`)

- **Mobile (`< md` / WebView):** Minimum `44px` touch target (`density.mobile.minTouchTarget: 44`), `rowHeight: 64`, bottom tab bar (`MOBILE_TAB_IDS` = 3 + More).
- **Web (`md+`):** `minTouchTarget: 40`, `rowHeight: 48`.
- **Desktop Electron:** `minTouchTarget: 32`, `rowHeight: 40`.

## 3. Adaptive Transformation Rules

1. **Tables -> Cards:** `DataTable` must use `VISIBILITY_CLASS` (`essential`, `standard`, `wide`) and render structured mobile cards below `md` rather than squishing columns. Financial numbers and invoice/SKU IDs must never truncate unreadably.
2. **HubTabs:** Centered on desktop; `overflow-x-auto` single-row horizontal scroll on mobile (no multi-line tab wrapping).
3. **Modals -> Bottom Sheets:** Forms in `Sheet` open from `end` (logical RTL side) on desktop and `bottom` on mobile.
4. **RTL Logical CSS:** Strictly `ms-`, `me-`, `ps-`, `pe-`, `text-start`, `text-end`, `border-s`, `border-e`. Zero `ml-`/`mr-`/`pl-`/`pr-`/`text-left`/`text-right`.
5. **Known Baseline Gaps to Fix:** Add responsive layout classes to `GovernanceHubContainer`, and add mobile card/sheet adaptation to the 17 domains currently lacking mobile-specific handling.
