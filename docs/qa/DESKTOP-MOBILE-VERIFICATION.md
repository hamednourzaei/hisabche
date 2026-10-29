# Hisabche QA — Desktop & Mobile Cross-Platform Verification

**Audit Date:** 2026-10-29  
**Target Shells:** Web (Next.js App Router), Desktop (Electron), Mobile (Expo/React Native)

---

## 1. Multi-Width Responsive Layout Verification

| Breakpoint          | Width (px) | Verified Surface                | Observations & Triage                                                                                             |
| ------------------- | ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Compact Mobile**  | `320px`    | Customers, Till, Invoices       | Sticky navigation bars stay pinned. Inputs maintain `min-h-[44px]`. Long text truncates gracefully with ellipsis. |
| **Standard Mobile** | `360px`    | Warehouse Hub, Invoice Form     | Two-column form layouts collapse to single-column stack. Action buttons span full width.                          |
| **Modern Phone**    | `390px`    | Dashboard, Analytics Cards      | Stat cards render 1-per-row with proper vertical rhythm and padding.                                              |
| **Large Phone**     | `430px`    | Invoice Preview, Drawer Modals  | Modal dialogs expand with safe margins (`mx-4`), preventing viewport edge overflow.                               |
| **Desktop / Wide**  | `1280px+`  | Full Business Hubs, Data Tables | Multi-column grids active; sidebar navigation expanded.                                                           |

---

## 2. Touch Target Compliance (Accessibility Law)

- **Standard:** All interactive touch elements must provide an accessible clickable target of at least `44px × 44px`.
- **Audit Findings:**
  - `AddProductModal`: Input fields styled with `min-h-[44px]`. Buttons use `h-11` or `h-12`.
  - `NotificationBell`: Trigger button sized at `44px × 44px` equivalent touch box.
  - Table Action Buttons: Row action dropdowns provide `p-2` with minimum clickable wrapper `size-10` (40–44px).

---

## 3. Platform Shell Architecture & Isolation

1. **Shared Domain Layer:**
   Business calculation rules (`packages/validation`, `@hisabche/formatting`, `@hisabche/api`) are 100% platform-agnostic and shared across all 3 platforms.
2. **Platform Bridges:**
   - Desktop: Uses SQLite native offline database and Electron IPC bridges (`apps/desktop/electron`).
   - Mobile: Uses Expo SQLite and native camera overlays (`apps/mobile`).
   - Web: Uses local IndexedDB / Web Storage persister and standard HTML5 features (`apps/web`).
3. **Environment Restrictions (Class C):**
   Full native Electron package builds and Android APK generation require host signing credentials and emulators; core web runtime functionality verified via CDP browser automation.
