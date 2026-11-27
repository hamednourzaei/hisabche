---
name: hisabche-adaptive-ui-ux
description: Cross-Device Responsive & Adaptive UI Engine for Hisabche — Laptop-first 1366x768 Vertical Space Budget, zero overlap, urgency-differentiated insights, and distinct Desktop/Tablet/Mobile adaptive compositions.
---

# Hisabche Cross-Device Responsive & Adaptive UI Engine

## 1. Laptop-First Vertical Space Budget (1366 × 768 Mandatory Target)

Every page MUST define and respect a Vertical Space Budget for `1366 × 768` before UI implementation:

| Component          | Target Desktop Height                 |
| ------------------ | ------------------------------------- |
| KPI Group / Strip  | 88–116px                              |
| Financial Overview | 112–160px                             |
| Main Chart         | 190–250px (Compact Laptop: 150–200px) |
| Toolbar            | 40–52px                               |
| Table Header       | 44–52px                               |
| Section Gaps       | 12–18px (`gap-3` / `gap-4`)           |

## 2. Three Adaptive Compositions (Never Simply Shrink Desktop)

- **Desktop / Windows (`lg+` / `1280×720`, `1366×768`, `1440×900`, `1920×1080`):** Multi-column, data-dense, zero empty vertical stretch (`items-start` when heights differ), full `DataTable`, no floating mobile nav covering content.
- **iPad / Tablet (`md`–`lg` / `768×1024`, `1024×768`):** Recompose columns based on available width (`grid-cols-2`), touch-friendly controls, prevent narrow squished 4-col cards.
- **Mobile (`< md` / `320–430px`):** Prioritize daily operations, compact summaries, structured mobile cards (`data-table-cards`), `>= 44×44px` touch targets, `pb-20 lg:pb-0` clearance above fixed bottom nav, zero horizontal overflow.

## 3. Hard Quality Rules

1. **Zero Overlap:** Never use `position: absolute` for adjacent toolbar controls or card action buttons inside label rows.
2. **Urgency Differentiation:** Smart insights and alerts must distinguish critical exceptions, pending actions, and informational tips using icons + labels/badges + semantic border accents (never color alone).
3. **No Empty Stretch:** Never stretch a 3-row panel to match a tall chart beside it; pair compact horizontal financial summaries above or beside appropriately sized charts.
4. **Full-Hub Scope:** Every tab, sub-tab (`SegmentedControl`), button, card, and table inside a route must be refactored together.

## 4. Global UI Quality & Responsive Scale Rules

- **Visual Quality:** Intentional visual hierarchy; avoid repetitive card grids; design cohesive visual compositions.
- **Financial & Chart Design:** Avoid repeated metrics; show comparisons only when backed by authoritative data; compact legends & readable Persian/AFN numerals.
- **Accessibility:** Target WCAG 2.2 AA; never communicate status by color alone; visible keyboard focus; `>= 44×44px` touch targets on touch interfaces (`min-h-[44px] sm:min-h-[36px]`).
- **Page Approval:** Complete one route at a time (Inspect → Redesign → Implement → Capture/Verify → Self-Critique → Owner Approval).

## 5. Inventory & Procurement Information Architecture Rules

- **No Unrelated Tools on Reorder:** Never mount Barcode/ZPL, Batch QC, IMEI/VIN/RMA, COD, Freight/Customs, or Agriculture/Livestock panels below `/warehouse?view=reorder`.
- **Industry Capability Gating:** Vertical extensions (e.g., Agriculture/Livestock) must only render when the workspace's active industry profile supports them; never in generic retail/wholesale.
- **Actionable Reorder Empty State:** When zero reorder suggestions exist, hide the floating supplier/PO-draft form and show an informative, actionable `EmptyState`.
- **No Duplicate Order Routes:** `/invoices?tab=orders` is removed; procurement/reorder lives cleanly under `/warehouse?view=reorder` and `/warehouse?view=rfqs`.

## 6. V100 Global UI/UX Reconstruction Engine (Anti-Shallow-Patch Law)

- **No Superficial Repositioning:** CSS margin tweaks, grid column adjustments, or centering bars do NOT pass when the route lacks clear IA, scannable hierarchy, or workflow separation.
- **Recursive Route Coverage (`Route -> Page -> Primary Tab -> Subtab -> Section -> Workflow -> Component`):** Discover and reconstruct every active tab, sub-switch, toolbar, dialog, and empty/populated/error state belonging to the route together.
- **1366×768 Content Density (No Cramming):** Strip dead vertical bloat (e.g. standalone full-width progress cards, stacked toolbars, empty mobile table rows) while keeping spacing intentional and legible.
- **Three Mandatory Proofs Per Route:**
  1. **Technical Verification:** `tsc --noEmit`, `eslint`, and Vitest suites (`0` weakened tests).
  2. **Route Coverage Proof:** Every active tab/subtab/section/dialog verified.
  3. **Visual QA Proof:** Real browser inspection/screenshots (`1366×768` + mobile, RTL/LTR, dark/light); if blocked by auth, declare `IMPLEMENTED_NOT_LIVE_VERIFIED` honestly.
- **Strict Approval Lock:** Record `WAITING_FOR_OWNER_VISUAL_APPROVAL` in `docs/ux/UX-OWNER-APPROVALS.md` and `docs/ux/UX-RECONSTRUCTION-PROGRESS.md` and wait for owner sign-off before touching another route.
- **Centered Responsive Blurred Form Modals & Green Gradient CTA:** Every create/edit form triggered from an action button (`+ تخفیف تازه`, `+ فهرست قیمت تازه`, etc.) MUST open centered in the viewport via `<Dialog>` / `<DialogContent size="sm|md|lg|xl">` adapting width/height across every resolution (`max-h-[88dvh]`), over a blurred translucent backdrop (`backdrop-blur-md`), styled with Hisabche's signature emerald green gradient accent and primary CTA (`bg-[image:var(--gradient-brand)]`).
