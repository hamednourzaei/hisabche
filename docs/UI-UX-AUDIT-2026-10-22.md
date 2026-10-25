# Pestinu UI/UX Audit — 2026-10-22

> **Status:** AUDIT ONLY. No application code was changed.
> **Rubric:** [`docs/UI-UX-GUIDELINES.md`](./UI-UX-GUIDELINES.md), WCAG 2.2 AA, WAI-ARIA APG, IBM Carbon, Shopify Polaris, GOV.UK, Baymard.
> **Scope:** Home, product listing, product detail, cart, checkout, login, account, admin dashboard, admin products, admin orders, plus shared header/layout/primitives.
> **Locales:** `fa` RTL and `en` LTR.
> **Method:** Static review of the named source files + live browser checks + Lighthouse on a running production build at `http://localhost:3000`.

---

## 0. Executive summary

| Severity |                   Count | Meaning                                                                                           |
| -------- | ----------------------: | ------------------------------------------------------------------------------------------------- |
| **P0**   | 1 cluster (5 locations) | Destructive actions execute without confirmation and can cancel/archive customer or catalog data. |
| **P1**   |                      19 | Major accessibility, correctness, error-state, or English/RTL failures.                           |
| **P2**   |                      16 | Consistency, i18n polish, semantic cleanup, and smaller UX gaps.                                  |

**Top five fixes, in order:**

1. Add explicit confirmation dialogs for order cancellation, address deletion, and bulk product archive (**P0-01**).
2. Give every form control a real label and every icon-only control an accessible name (**P1-04**, **P1-10**).
3. Fix the site-wide heading model: one `h1`, no skipped levels, and make `CardTitle` optionally semantic (**P1-02**).
4. Fix contrast and focus visibility using tokens, not raw palette values (**P1-03**, **P1-18**).
5. Fix product price sorting across the full result set, not just the current page (**P1-07**), and repair reorder/pending-payment links (**P1-16**).

### Lighthouse results (live, light theme, ~800×674 harness viewport)

| Page                        | Accessibility | Main failures                                                                    |
| --------------------------- | ------------: | -------------------------------------------------------------------------------- |
| `/` (fa home)               |      **0.91** | contrast, heading order, label/name mismatch, target size                        |
| `/products`                 |      **0.90** | contrast, heading order, label/name mismatch, unlabeled selects                  |
| `/products/peste-test-6393` |      **0.90** | invalid ARIA on gallery trigger, contrast, heading order, label/name mismatch    |
| `/checkout`                 |      **0.90** | contrast, heading order, label/name mismatch, unlabeled province/city selects    |
| `/login`                    |      **0.97** | contrast, label/name mismatch; no `h1`                                           |
| `/account` (addresses open) |      **0.86** | contrast, heading order, label/name mismatch, unlabeled fields, unlabeled select |
| `/admin`                    |      **0.95** | contrast only                                                                    |
| `/admin/products`           |      **0.94** | unnamed status filter, unnamed row/select-all checkboxes                         |
| `/admin/orders`             |      **0.94** | unnamed status filter, unnamed print/detail icon buttons                         |

Best-practices and SEO scores were 1.0 on the audited pages. SEO does not detect a missing `h1`.

---

## 1. P0 — destructive actions are not confirmed

### P0-01 — Order cancellation, address deletion, and bulk archive run immediately

| Field    | Value                                    |
| -------- | ---------------------------------------- |
| Rule IDs | `UX-CMP-011`, `UX-ADM-002`, `UX-ADM-005` |
| Severity | **P0**                                   |
| Status   | Open                                     |

**Locations**

- `src/app/[locale]/account/page.tsx:243-247` — `handleDeleteAddress` calls `DELETE` and immediately shows a success toast. No confirmation.
- `src/app/[locale]/account/page.tsx:255-264` — `handleCancelOrder` posts cancellation without confirmation.
- `src/app/[locale]/account/page.tsx:762-770` — the customer “Cancel order” button calls `handleCancelOrder` directly.
- `src/app/[locale]/admin/orders/page.tsx:496-505` — “لغو سفارش و بازگشت موجودی” calls `handleUpdateStatus("CANCELLED")` directly.
- `src/app/[locale]/admin/products/page.tsx:459-465` and `:182-196` — bulk “بایگانی” posts `archive` for every selected product with no count, confirmation, or reason.

**Evidence**

- No `AlertDialog`, `confirm`, or two-step state exists on these paths.
- The only native confirmations are `confirm()` for account deletion (`account/page.tsx:308-315`) and product deletion (`admin/products/page.tsx:170-179`); both use generic browser buttons, not explicit action labels.
- Admin cancellation reverses stock; it is not a cosmetic UI change.

**Fix**

- Add one shared confirmation primitive based on the existing Radix dialog primitives.
- Buttons must name the action and target: “Cancel order PST-1042”, “Archive 12 selected products”, “Delete this address”.
- For admin cancellation, require a reason and show it in the audit log.
- Only show success after a successful response; keep the dialog open on failure.

---

## 2. P1 — major usability and accessibility failures

### P1-01 — No skip link and no main-content target

| Field    | Value                                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rule IDs | `UX-A11Y-008`, `UX-LAY-004`                                                                                                                                                          |
| Files    | `src/app/[locale]/layout.tsx:95`, `src/components/admin/admin-shell.tsx:386`                                                                                                         |
| Evidence | Live DOM has no `a[href="#main-content"]`; `<main>` has no `id`. Keyboard users tab through the announcement bar, header, search, account menu, cart, and mobile menu on every page. |
| Fix      | Add a visible-on-focus skip link before the header; give storefront and admin `<main>` `id="main-content"` and `tabIndex={-1}`; ensure the skip link receives a visible focus ring.  |

### P1-02 — Missing `h1` and skipped heading levels across the storefront

| Field    | Value                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-A11Y-004`, `UX-TYP-004`                                                                                                                                                                                                                                                                                                                                                                             |
| Files    | `src/app/[locale]/page.tsx:69-79`, `src/components/storefront/ProductCarousel.tsx:42`, `src/app/[locale]/login/page.tsx:311`, `src/components/ui/card.tsx:32-44`, `src/app/[locale]/products/page.tsx:130`, `src/components/storefront/ProductCard.tsx:156`, `src/app/[locale]/products/[slug]/page.tsx:162-164,228`, `src/app/[locale]/checkout/page.tsx:451`, `src/app/[locale]/account/page.tsx:498` |
| Evidence | Live home has **zero** `h1`; first heading is `h2`, product cards are `h4`, footer uses `h6`. Login has **zero** `h1`. Product listing goes `h1 → h4`. Product detail goes `h1 → h3 → h5/h6`. Checkout goes `h1 → h5`. Account goes `h1 → h3 → h6`. Lighthouse `heading-order` fails on home, listing, detail, checkout, and account.                                                                   |
| Fix      | One `h1` per page. Home needs an `h1` (value proposition), not just a carousel `h2`. Product-card titles should be `h3` when the page title is `h1` and the section title is `h2`. Make `CardTitle` accept `asChild`/`as` or explicitly render an `h2`/`h3`; use visually hidden headings where the visual heading is a card title.                                                                     |

### P1-03 — Confirmed WCAG contrast failures

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| Rule IDs | `UX-COL-003`, `UX-COL-004`, `UX-A11Y-006` |
| Severity | **P1**                                    |

**Confirmed values from Lighthouse**

- `src/components/storefront/AnnouncementBar.tsx:29` — phone `#d4af37` on `#2d5033` = **4.32:1** at 11.1px. Needs 4.5:1.
- `src/components/storefront/ProductCard.tsx:130-137` — discount badge `#fafafa` on `#ef4343` = **3.62:1**; variant `#f04e4e` = **3.40:1**.
- `ProductCard.tsx:185-189` — unselected variant `#66786a` on `#f5f4f1` = **4.28:1**; selected variant `#ffffff` on `#54815c` = **4.49:1**; worst measured variant `#7e8d81` on `#f6f5f2` = **3.20:1**.
- `ProductCard.tsx:215` — product price `#54815c` on white = **4.49:1**.
- `ProductCard.tsx:163` — description `#7e8d81` on `#fefefe` = **3.46:1**.
- `ProductCard.tsx:240` — stock badge `#359577` on `#effcf6` = **3.48:1**.
- `src/components/admin/admin-shell.tsx:199` — avatar initials `#ffffff` on `#009966` = **3.65:1**.
- `admin-shell.tsx:239` — sidebar section label `#90a1b9` on white = **2.63:1**.
- `src/app/[locale]/admin/page.tsx:166` — pending badge `#e17100` on white = **3.19:1**.
- `src/app/[locale]/account/page.tsx:396-401` — “خروج از حساب” `#ef4343` on `#fcfaf8` = **3.63:1**.

**Fix**

- Darken large-area green text or use `text-primary-foreground` on `bg-primary`.
- Use `emerald-800`/`emerald-900` for muted stock text; do not use 10–11px muted text for meaningful values.
- Replace `text-pistachio-gold` on dark green with a lighter gold that reaches 4.5:1, or increase size/weight to qualify as large text.
- Replace admin `text-slate-400` at 11px with `text-slate-600`/`text-slate-700`.
- Re-run Lighthouse after token changes; target 0 contrast failures.

### P1-04 — Unlabeled forms and compact controls

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| Rule IDs | `UX-CMP-003`, `UX-A11Y-009`, `UX-ADM-010` |
| Severity | **P1**                                    |

**Locations**

- Checkout: `src/app/[locale]/checkout/page.tsx:348-351`, `:373-376` — province/city `<Label>` has no `htmlFor`; `<select>` has no `id` or `aria-label`. Coupon input `:696-703` has only a placeholder.
- Account: `src/app/[locale]/account/page.tsx:525-607` — all address-form labels lack `htmlFor`; inputs/select have no `id` (only `data-testid`). This includes title, recipient name, phone, province, city, postal code, and street.
- Admin products: `src/app/[locale]/admin/products/page.tsx:382-388` search; `:392-402` status filter; `:478-482` select-all checkbox; `:518-522` row checkboxes.
- Admin orders: `src/app/[locale]/admin/orders/page.tsx:219-225` search; `:228-241` status filter; `:514-520` tracking code.
- Header: `src/components/storefront/Header.tsx:253-259` search input (placeholder only).
- Product filters: `src/components/storefront/ProductFilterBar.tsx:127-142`, `:148-160`, `:163-174`, `:277-302` (search, category, sort, range).
- Cart: `src/components/storefront/CartDrawer.tsx:248-255` coupon input (placeholder only).

**Evidence**

- Lighthouse `label` and `select-name` fail on checkout and account.
- Lighthouse `button-name` fails on the admin status filter and every row/select-all checkbox.
- Live `/account` with “Add Address” open reports **7 unlabeled controls** (plus an unlabeled hidden file input).
- Live `/checkout` reports the province and city selects as unlabeled.

**Fix**

- Add stable `id` + visible `<Label htmlFor>` pairs.
- For compact toolbar controls, use `aria-label` and a visible label where space allows.
- Give table checkboxes `aria-label={`Select ${product.nameFa}`}` and a select-all label.
- Add `aria-describedby` for helper text and error text.
- Prefer `fieldset`/`legend` for grouped variant/size controls.

### P1-05 — Product gallery is not keyboard operable and the zoom dialog lacks a name

| Field    | Value                                                                                                                                                                                                                                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-A11Y-002`, `UX-CMP-005`, `UX-A11Y-005`                                                                                                                                                                                                                                                                                                                                                  |
| File     | `src/components/storefront/ProductGallery.tsx:26-43,46,63-81`                                                                                                                                                                                                                                                                                                                               |
| Evidence | The zoom trigger is a `<div>` with `onClick` but no `role`, `tabIndex`, or keyboard handler. Live DOM confirms `tag: DIV`, `role: null`, `tabIndex: null`. Lighthouse reports `aria-allowed-attr` because `aria-expanded="false"` is placed on a generic `div`. `DialogContent` has no `DialogTitle`/`Description`. Thumbnails are buttons but expose no `aria-pressed` or per-image label. |
| Fix      | Use `<button type="button">` as the trigger with an accessible name and `aria-haspopup="dialog"`. Add a visually hidden `DialogTitle` (“Product image zoom”) and description. Add `aria-pressed`/`aria-current` to thumbnails and an accessible label such as “Show image 2 of 4”. Return focus to the trigger on close.                                                                    |

### P1-06 — Selected state is visual only

| Field    | Value                                                                                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-A11Y-007`, `UX-CMP-018`, `UX-A11Y-001`                                                                                                                                                                                                                        |
| Files    | `ProductCard.tsx:178-192`, `ProductBuyBox.tsx:192-207`, `ProductFilterBar.tsx:177-189,217-228`, `src/app/[locale]/admin/page.tsx:93-104`, `src/app/[locale]/products/page.tsx:167-178`                                                                            |
| Evidence | Live home/listing/detail show `aria-pressed` count 0 (detail has one unrelated pressed toggle). Selected variant/filter is indicated only by background and scale. Dashboard day buttons have no `aria-pressed`. Product pagination has no `aria-current="page"`. |
| Fix      | Add `aria-pressed` to variant/size/day buttons. Add `aria-current="page"` to the active pagination link. Add `aria-expanded` + `aria-controls` to the advanced-filter toggle. Use `role="group"` with `aria-labelledby` for option groups.                        |

### P1-07 — Price sorting only sorts the current page

| Field    | Value                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rule IDs | `UX-ECOM-008`, `UX-A11Y-001` (correctness), `UX-CMP-006`                                                                                                                                         |
| File     | `src/app/[locale]/products/page.tsx:33,80-99,106-112`                                                                                                                                            |
| Evidence | Database query always orders by `createdAt`; `price_asc`/`price_desc` sorts only the 12 already-fetched products. On a multi-page catalog, page 1 can contain a more expensive item than page 2. |
| Fix      | Sort by aggregate variant price in the database (`_min`/`_max`, a materialized `minPriceRials`, or a raw query), then paginate. Add a test with more than 12 products and at least two pages.    |

### P1-08 — Checkout and login errors are not announced or tied to fields

| Field    | Value                                                                                                                                                                                                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-CMP-004`, `UX-CMP-008`, `UX-CMP-015`, `UX-A11Y-009`                                                                                                                                                                                                                                            |
| Files    | `src/app/[locale]/checkout/page.tsx:180-196,289-297`, `src/app/[locale]/login/page.tsx:322-330`                                                                                                                                                                                                    |
| Evidence | Both error banners are plain `<div>`s with no `role="alert"` or `aria-live`. Live audit reports zero `[role="alert"]`/`aria-live` nodes. Checkout validation sets one global message and does not focus the first invalid field. Login errors appear above the tabs but focus remains in the form. |
| Fix      | Render an error summary with `role="alert"` or `aria-live="assertive"`, focus it on submit failure, and link each message to its field with `aria-describedby`. Set `aria-invalid`. Preserve all values. Add inline field messages instead of a single top banner.                                 |

### P1-09 — Admin dashboard has no error state and no recovery path

| Field    | Value                                                                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-ADM-006`, `UX-CMP-009`                                                                                                                                                                                      |
| File     | `src/app/[locale]/admin/page.tsx:62-66,138-232`                                                                                                                                                                 |
| Evidence | `fetchDashboard` catches errors with `console.error` only. If the request fails, `data` stays null and every KPI/chart keeps rendering skeletons forever. There is no retry, error message, or stale indicator. |
| Fix      | Add explicit `loading                                                                                                                                                                                           | ready | error`state. On error, show a compact inline error with “Retry” and keep the last successful data if available. Add`aria-live="polite"` for refresh results. |

### P1-10 — Admin products/orders controls lack names and mutations fail silently

| Field    | Value                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-ADM-006`, `UX-ADM-010`, `UX-CMP-002`, `UX-CMP-008`                                                                                                                                                                                                                                                                                                                                                     |
| Files    | `src/app/[locale]/admin/products/page.tsx:170-196,382-402,518-522,596-618`; `src/app/[locale]/admin/orders/page.tsx:112-117,134-177,219-241,337-347,514-520`                                                                                                                                                                                                                                               |
| Evidence | Lighthouse `button-name` failures include the status filter trigger and every checkbox on admin products. Row edit/duplicate/delete buttons use `title` only and do not include the product identity. Order detail/print buttons use `title` only. `handleDelete`, `handleBulkAction`, `handleUpdateStatus`, and `handleSaveTracking` catch errors with `console.error` and show no toast or inline error. |
| Fix      | Add `aria-label` with row identity for every icon button and checkbox. Add success/error toasts plus an inline error region. Disable controls while pending and announce results. For print, use a real `<button>` with `aria-label="Print invoice for order ...">`.                                                                                                                                       |

### P1-11 — English admin is Persian and hard-coded RTL

| Field    | Value                                                                                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-CNT-002`, `UX-RTL-005`, `UX-RTL-002`                                                                                                                                                                                                                                  |
| File     | `src/components/admin/admin-shell.tsx:39-112,152,239-240,272-273,286`                                                                                                                                                                                                     |
| Evidence | Live `/en/admin`: document `lang="en"`, `dir="ltr"`, but `AdminShell` has `dir="rtl"` and renders fully Persian nav, header, badges, and sidebar labels. There are zero English admin strings.                                                                            |
| Fix      | Decide explicitly: either (a) localize the admin via `messages/en.json` and derive `dir` from the locale, or (b) make admin Persian-only and redirect `/en/admin` to `/fa/admin` with a documented reason. Do not render `lang="en"` with a hard-coded Persian RTL shell. |

### P1-12 — Autoplay carousel has no pause and uses Persian labels in English

| Field    | Value                                                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rule IDs | `UX-MOT-002`, `UX-CNT-002`, `UX-A11Y-010`                                                                                                                                                                                                                    |
| Files    | `src/components/storefront/ProductCarousel.tsx:26-28,65`, `src/components/ui/carousel.tsx:208,238`                                                                                                                                                           |
| Evidence | `Autoplay({ delay: 4500, stopOnInteraction: false })` runs continuously. There is no pause/play control and no pause on keyboard focus. Live `/en` carousel buttons expose `aria-label="اسلاید قبلی"`/`"اسلاید بعدی"` while their `sr-only` text is English. |
| Fix      | Add a visible pause/play button, pause on hover and focus, and respect `prefers-reduced-motion`. Pass localized labels into `CarouselPrevious`/`CarouselNext` or derive them from `useLocale`.                                                               |

### P1-13 — Header language switch and mobile menu are not announced correctly

| Field    | Value                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-A11Y-001`, `UX-CMP-002`, `UX-RTL-005`                                                                                                                                                                                                                                                                                                                                                               |
| Files    | `src/components/storefront/AnnouncementBar.tsx:41-49`, `src/components/storefront/Header.tsx:192-195,219-227,253-259`                                                                                                                                                                                                                                                                                   |
| Evidence | Live Lighthouse `label-content-name-mismatch` on the language switch: visible “English” / “فارسی”, accessible name “Switch Language”. Mobile toggle is always `aria-label="Toggle Menu"` (English even in Persian), has no `aria-expanded`/`aria-controls`, and the menu has no focus management or Escape handling. Desktop/mobile nav links have no `aria-current`. Search input is placeholder-only. |
| Fix      | Make the accessible name contain the visible text, localized: “Switch to English” / “تغییر به فارسی”. Add `aria-expanded`, `aria-controls`, Escape-to-close, and focus return. Add `aria-current="page"` to active nav links. Label the search input.                                                                                                                                                   |

### P1-14 — Admin `/` shortcut hijacks inputs and the command palette is not a dialog

| Field    | Value                                                                                                                                                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-A11Y-002`, `UX-CMP-005`                                                                                                                                                                                                                                                                                               |
| File     | `src/components/admin/admin-shell.tsx:124-133,287-289,335-356`                                                                                                                                                                                                                                                            |
| Evidence | The global keydown handler intercepts `/` everywhere, including when focus is in the search, tracking, or form inputs. The palette is a plain `div` with no `role="dialog"`, `aria-modal`, title, focus trap, or Escape handler. The search input has only a placeholder. The mobile close button has no accessible name. |
| Fix      | Ignore the shortcut when the event target is an input, textarea, select, or contenteditable. Rebuild the palette with the existing Radix `Dialog` primitive; add a title, focus trap, Escape handling, and return focus. Label the search input and close button.                                                         |

### P1-15 — No-results state has no recovery action

| Field    | Value                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-ECOM-009`, `UX-CMP-010`                                                                                                                                                                                             |
| File     | `src/components/storefront/AnimatedProductGrid.tsx:41-59`                                                                                                                                                               |
| Evidence | Empty state says “No products found” and “adjust your search”, but provides no button to clear filters or return to the full catalog. The filter bar’s clear button is not rendered when the filter bar is out of view. |
| Fix      | Pass a `clearFilters` callback or a `/products` link into the empty state. Show active filter chips and a primary “Clear all filters” action.                                                                           |

### P1-16 — Account reorder corrupts cart data and pending payment loses order context

| Field    | Value                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rule IDs | `UX-ECOM-003`, `UX-ECOM-005`, `UX-ECOM-007`                                                                                                                                                                                                                                                                                    |
| File     | `src/app/[locale]/account/page.tsx:266-284,754-761`                                                                                                                                                                                                                                                                            |
| Evidence | `handleReorder` writes `productSlug: "product"`, `stock: 50`, `weightGrams: 500`, a placeholder image, and uses the Persian name for the English name. This can create a 404 product link and allow 50 units of an item that may have less stock. Pending-order “Pay Now” goes to generic `/checkout`, not the specific order. |
| Fix      | Use the real product/variant snapshot from the order or fetch the variant before adding. Persist `productSlug`, actual stock, weight, image, and both localized names. Route pending payment to `/checkout?order=<orderNumber>` or a dedicated payment-resume route.                                                           |

### P1-17 — Account destructive mutations report success without checking the response

| Field    | Value                                                                                                                                                                                                                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-CMP-008`, `UX-ADM-006` (applied to customer data views)                                                                                                                                                                                                                                                                                                          |
| File     | `src/app/[locale]/account/page.tsx:243-253,286-299,308-315`                                                                                                                                                                                                                                                                                                          |
| Evidence | Delete address, set default, remove wishlist, and revoke session all `await fetch(...)`, refresh, and show success regardless of `res.ok`. `handleDeleteAccount` redirects even when deletion fails. Sub-resource fetches (`fetchAddresses`, `fetchOrders`, `fetchWishlist`, `fetchSessions`, `:120-150`) ignore failures and render empty states instead of errors. |
| Fix      | Check `res.ok`, parse the error, show an inline/toast error, and do not update the UI on failure. Add an error state for each tab and a retry action. Confirm account deletion with an explicit dialog.                                                                                                                                                              |

### P1-18 — Focus indicators are too faint or removed

| Field    | Value                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-A11Y-003`, `UX-COL-003`                                                                                                                                                                                                           |
| Files    | `src/components/storefront/ProductFilterBar.tsx:142,152,167`, `src/app/[locale]/checkout/page.tsx:362,380`, `src/app/[locale]/account/page.tsx:569`, `src/components/storefront/Header.tsx:258`, `src/app/[locale]/login/page.tsx:71` |
| Evidence | `focus:ring-2 focus:ring-primary/20` is a 20%-opacity ring with insufficient boundary contrast. Account province select uses `focus:outline-none` with no replacement. Login password visibility uses `ring-primary/20`.              |
| Fix      | Use `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` or the equivalent token-based ring. Never remove the outline without a visible replacement.                                                            |

### P1-19 — Admin checkout redirect goes to a route that does not exist

| Field    | Value                                                                                                                                                                                                       |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule IDs | `UX-ECOM-005`, `UX-CMP-008`                                                                                                                                                                                 |
| File     | `src/app/[locale]/checkout/layout.tsx:20-24`                                                                                                                                                                |
| Evidence | Admins are redirected to `${prefix}/cart?error=...`, but there is no `src/app/[locale]/cart` route (glob confirms no cart page). The admin gets a 404 instead of an explanation.                            |
| Fix      | Redirect to an existing route (`/products?error=...`) or add a real `/cart` page. If admins must not check out, show an inline policy message on the checkout page instead of redirecting to a missing URL. |

---

## 3. Page-by-page findings

### 3.1 Home `/` and `/en`

**What works:** product-first layout, clear featured collection, visible category shortcuts, trust/quality banner, optimized `next/image` usage, product cards show price/stock/CTA.

**Findings**

- **P1-02** no `h1`; first heading is `h2` (`page.tsx:69-79`, `ProductCarousel.tsx:42`).
- **P1-12** autoplay carousel with no pause (`ProductCarousel.tsx:26-28,65`).
- **P2** category counts use Latin digits in Persian: `${cat._count.products}` at `page.tsx:117-120`; use `toPersianDigits`.
- **P2** no category empty state if `categories` is empty (`page.tsx:99-129`).
- **P2** raw hex `bg-[#2D5033]` alongside `bg-gradient-to-r` (`page.tsx:133`); remove the redundant raw value.
- **P2** product cards use `h4` (`ProductCard.tsx:156`) under an `h2`/`h3` page structure.

### 3.2 Product listing `/products` and `/en/products`

**What works:** clear `h1`, URL-driven filters, active-filter clear action, responsive grid, empty-state copy, pagination.

**Findings**

- **P1-07** price sort only sorts the current page (`products/page.tsx:106-112`).
- **P1-04** search/category/sort/range have no labels (`ProductFilterBar.tsx:127-174,277-302`).
- **P1-06** filter toggle has no `aria-expanded`; size buttons have no `aria-pressed`; pagination has no `aria-current` (`ProductFilterBar.tsx:177,217`; `products/page.tsx:167-178`).
- **P1-15** empty state lacks a clear-filters action (`AnimatedProductGrid.tsx:41-59`).
- **P2** pagination renders every page number (`products/page.tsx:163-180`) and uses English `aria-label="Previous Page"`/`"Next Page"` in Persian (`:157,187`).
- **P2** price slider value always formats with `fa-IR` + “تومان”, even in English (`ProductFilterBar.tsx:270-274,293-299`).
- **P2** search `defaultValue` is not synced to URL changes (`ProductFilterBar.tsx:129`), so back/forward can leave a stale query visible.
- **P2** active filter chips are missing; only a single clear-all button appears (`ProductFilterBar.tsx:191-202`).

### 3.3 Product detail `/products/[slug]`

**What works:** clear `h1`, price updates with quantity, variant selector, stock state, quantity stepper, shipping/returns trust content, related products, JSON-LD.

**Findings**

- **P1-05** gallery trigger is a non-focusable `div`; invalid `aria-expanded`; dialog has no title (`ProductGallery.tsx:26-43,46`).
- **P1-06** variant buttons have no `aria-pressed` (`ProductBuyBox.tsx:192-207`).
- **P1-02** `h1 → h3` and `h3 → h5` skips (`[slug]/page.tsx:162-164,228`).
- **P2** review dates always use Persian digits because `toPersianDigits` wraps the English date (`[slug]/page.tsx:223`).
- **P2** star ratings are five decorative Star icons with no text equivalent (`[slug]/page.tsx:216-220`); add `aria-label={`${rating} out of 5`}` or visible text.
- **P2** no breadcrumb or “back to results” link.
- **P2** out-of-stock variants remain selectable; add a clear disabled state or “notify me” alternative (`ProductBuyBox.tsx:192-207`).

### 3.4 Cart drawer

**What works:** immediate quantity/line-total/subtotal updates, product/variant/line total, empty state with a browse CTA, checkout CTA, coupon apply/remove.

**Findings**

- **P1-04** coupon input is placeholder-only (`CartDrawer.tsx:248-255`).
- **P2** remove button uses `title` only, no `aria-label` (`CartDrawer.tsx:205-212`).
- **P2** quantity controls use English `aria-label`s in Persian (`CartDrawer.tsx:183,199`).
- **P2** shared sheet close button uses physical `right-4` and English-only `sr-only` “Close” (`src/components/ui/sheet.tsx:68-70`); in RTL this is the wrong side and untranslated.
- **P2** no “continue shopping” secondary action inside the cart footer when items exist; only checkout.

### 3.5 Checkout `/checkout`

**What works:** clear `h1`, address → shipping → payment → summary structure, shipping cost before payment, coupon, order summary, guest/customer flow, large primary CTA.

**Findings**

- **P1-04** province/city selects and coupon input unlabeled (`checkout/page.tsx:348-351,373-376,696-703`).
- **P1-08** error banner not announced; no inline field errors; no focus to first invalid (`checkout/page.tsx:289-297`).
- **P1-18** faint focus rings (`checkout/page.tsx:362,380`).
- **P1-02** `h1 → h5` heading jump; section titles are `CardTitle` divs (`checkout/page.tsx:306-309,427-430,451`).
- **P2** no visible progress indicator; “1/2/3” is only text inside card titles.
- **P2** phone/postal/coupon inputs lack `inputMode`/`autoComplete` (`checkout/page.tsx:337,401,700`).
- **P2** many 11px metadata lines (`checkout/page.tsx:492,657`), below the 12px caption minimum.
- **P1-19** admin checkout redirect 404 (`checkout/layout.tsx:20-24`).

### 3.6 Login `/login`

**What works:** email/password, OTP tab when enabled, password visibility toggle with `aria-pressed`, inline error surface, loading states, resend countdown.

**Findings**

- **P1-02** no `h1`; `CardTitle` is a `div` (`login/page.tsx:311`, `ui/card.tsx:32-44`).
- **P1-08** error banner has no `role="alert"`/`aria-live` (`login/page.tsx:322-330`).
- **P2** `if (!mounted) return null` (`login/page.tsx:302`) renders a blank page during SSR/hydration; use a skeleton or server-rendered shell.
- **P2** OTP input is a plain text input with no `inputMode="numeric"`, `autoComplete="one-time-code"`, or `pattern` (`login/page.tsx:539-551`).
- **P2** no “Forgot password?” recovery link; no terms/privacy consent on register.
- **P2** password visibility button uses `right-2` rather than logical `end-2` (`login/page.tsx:71`); input is `dir="ltr"` so this works today, but it will break if the input direction changes.

### 3.7 Account `/account`

**What works:** orders, addresses, profile, wishlist, security tabs; empty states for addresses/orders/wishlist; order invoice link; avatar upload; session list.

**Findings**

- **P0-01** delete address and cancel order run without confirmation (`account/page.tsx:243-247,255-264,762-770`).
- **P1-04** all address-form fields unlabeled (`account/page.tsx:525-607`).
- **P1-16** reorder writes fake slug/stock/weight/image; pending “Pay Now” loses order context (`account/page.tsx:266-284,754-761`).
- **P1-17** mutations report success without checking `res.ok`; account deletion redirects even on failure (`account/page.tsx:243-315`).
- **P1-02** `h1 → h3` and footer `h6` skips (`account/page.tsx:498`).
- **P1-03** logout destructive text contrast 3.63:1 (`account/page.tsx:396-401`).
- **P2** order status shows raw enum `PAID`/`CANCELLED` instead of localized labels (`account/page.tsx:719`).
- **P2** order item names always use `productNameFa`/`variantNameFa` even in English (`account/page.tsx:733-734`).
- **P2** `confirm()` for account deletion uses generic browser buttons (`account/page.tsx:308-315`).
- **P2** 10–11px badges/meta text (`account/page.tsx:367,376,648,932`).

### 3.8 Admin dashboard `/admin`

**What works:** clear `h1`, KPI cards with labels, low-stock/top-product sections, date-range control, refresh action, link to create product.

**Findings**

- **P1-09** no error state; failed fetch leaves skeletons forever (`admin/page.tsx:62-66,138+`).
- **P1-06** day buttons have no `aria-pressed` (`admin/page.tsx:93-104`).
- **P1-11** hard-coded Persian/RTL shell on `/en/admin` (`admin-shell.tsx:152`).
- **P1-03** low-contrast avatar/sidebar/pending badge (`admin-shell.tsx:199,239`; `admin/page.tsx:166`).
- **P2** KPI cards have no trend or detail link (`admin/page.tsx:130-211`), despite `UX-ADM-008`.
- **P2** refresh button uses `title` only (`admin/page.tsx:108-116`); day buttons are visual-only.
- **P2** raw emerald/blue/purple/amber palette classes (`admin/page.tsx:133,153,180,200`).
- **P2** no `aria-live` for KPI refresh.

### 3.9 Admin products `/admin/products`

**What works:** dense table, select-all/row selection, bulk actions, create/edit/import dialogs, CSV export, image thumbnails, low/out-of-stock badges.

**Findings**

- **P0-01** bulk archive has no confirmation or count (`admin/products/page.tsx:459-465,182-196`).
- **P1-04** search, status filter, and checkboxes unnamed (`admin/products/page.tsx:382-402,478-482,518-522`).
- **P1-10** row actions are title-only and omit row identity; mutations fail silently (`admin/products/page.tsx:596-618,170-196`).
- **P2** filters/search/selection live in component state, not URL (`UX-ADM-003`).
- **P2** no pagination; all products render in one table.
- **P2** native `confirm()` for delete (`admin/products/page.tsx:170-179`) uses generic labels.
- **P2** dialogs have `DialogTitle` but no `DialogDescription`; add a short description or `aria-describedby={undefined}` (`admin/products/page.tsx:635-638`).
- **P2** 11px sidebar/meta text and raw emerald classes.

### 3.10 Admin orders `/admin/orders`

**What works:** status filter, search, order table, detail dialog, tracking code, print, state-transition controls.

**Findings**

- **P0-01** “لغو سفارش و بازگشت موجودی” has no confirmation (`admin/orders/page.tsx:496-505`).
- **P1-04** search/status/tracking inputs unnamed (`admin/orders/page.tsx:219-241,514-520`).
- **P1-10** detail/print icon buttons are title-only; status/tracking mutations fail silently (`admin/orders/page.tsx:337-347,134-177`).
- **P2** no URL-persisted filters/pagination (`UX-ADM-003`).
- **P2** table has no caption/accessible name (`UX-CMP-006`).
- **P2** tracking input lacks `inputMode="numeric"` and `autoComplete="off"`; 24-digit code is hard to enter on mobile.
- **P2** status change dialog shows no audit-friendly confirmation (“who/when/why”); cancellation should record a reason.
- **P2** empty state has no “clear filters” action (`admin/orders/page.tsx:268-273`).

---

## 4. P2 — consistency and polish backlog

| ID    | Finding                                                                                                        | Location                                                             | Fix                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| P2-01 | Home category counts use Latin digits in Persian; categories have no empty state                               | `src/app/[locale]/page.tsx:99-129,117-120`                           | `toPersianDigits`, add empty state with “Browse all products”        |
| P2-02 | Listing pagination has no `aria-current`, English labels in Persian, and renders every page                    | `src/app/[locale]/products/page.tsx:157-188`                         | localize labels, `aria-current="page"`, truncate with ellipsis       |
| P2-03 | Active filter chips are missing; price slider formats Persian in English; search default is stale              | `ProductFilterBar.tsx:129,270-299`                                   | chips + `useEffect` sync + locale-aware formatter                    |
| P2-04 | Product detail review dates use Persian digits in English; stars have no text equivalent; no breadcrumb        | `[slug]/page.tsx:216-223`                                            | locale-aware date, `aria-label` rating, breadcrumb                   |
| P2-05 | Checkout has no progress indicator; phone/postal/coupon missing input hints; 11px metadata                     | `checkout/page.tsx:337,401,492,657,700`                              | stepper/progress, `inputMode`/`autoComplete`, 12px minimum           |
| P2-06 | Login blank on SSR; OTP not numeric/autocomplete; no forgot-password/terms                                     | `login/page.tsx:302,539-551`                                         | skeleton, OTP attributes, recovery link, consent                     |
| P2-07 | Cart coupon unlabeled; remove title-only; quantity labels English; sheet close physical/English                | `CartDrawer.tsx:205-212,248-255`; `ui/sheet.tsx:68-70`               | label, `aria-label`, localized logical `end-4`                       |
| P2-08 | Account raw status enum; Persian order names in English; native confirm; sub-resource errors hidden; 10px text | `account/page.tsx:719,733-734,308-315,120-150,367`                   | localized status map, locale-aware names, dialog, error states, 12px |
| P2-09 | Admin KPI cards lack trend/detail links; refresh title-only; raw palette                                       | `admin/page.tsx:108-211`                                             | trend text + link, `aria-label`, tokens                              |
| P2-10 | Admin products filters not URL-persisted; no pagination; native confirm; dialog description missing            | `admin/products/page.tsx:170-179,382-402,635-638`                    | URL state, pagination, AlertDialog, description                      |
| P2-11 | Admin orders filters not URL-persisted; table no caption; tracking input mobile-unfriendly; no audit reason    | `admin/orders/page.tsx:219-241,248,514-520`                          | URL state, caption, `inputMode`, reason field                        |
| P2-12 | Header mobile menu lacks focus management/Escape; nav lacks `aria-current`                                     | `Header.tsx:192-195,219-227,287-375`                                 | focus trap/return, Escape, `aria-current`                            |
| P2-13 | `CardTitle` renders a `div`; section titles are not semantic                                                   | `src/components/ui/card.tsx:32-44`                                   | `asChild`/`as` prop or explicit heading component                    |
| P2-14 | Carousel has no empty state; `focus:outline-none` on a non-focusable section                                   | `ProductCarousel.tsx:33-36`                                          | empty state; remove outline-none                                     |
| P2-15 | `toPersianDigits` is used on English dates/price slider                                                        | `[slug]/page.tsx:223`; `ProductFilterBar.tsx:271,295`                | only convert for `fa`                                                |
| P2-16 | Raw palette values and one-off spacing remain in audited pages                                                 | `page.tsx:133`; `admin/page.tsx:133-200`; `account/page.tsx:713-716` | migrate to semantic tokens; document exceptions                      |

---

## 5. What passed / keep intact

- Cart line totals, subtotal, cart count, and quantity changes are immediate and consistent.
- Product detail and product card quantity pricing remain correct after prior fixes.
- Checkout shows shipping cost before the final payment action; the summary is persistent.
- Login password visibility exposes `aria-pressed` and localized labels.
- Account tabs use Radix tabs with keyboard behavior.
- Admin tables are horizontally scrollable and keep numeric columns aligned.
- Admin dashboard has one clear `h1` and readable KPI labels.
- Empty states exist for cart, orders, addresses, wishlist, and admin tables (though recovery actions are missing in some).
- `next/image` is used for product/cart/account images with meaningful alt text in the audited paths.

---

## 6. Verification coverage and limitations

### Live checks performed

- `http://localhost:3000/` and `/en` — home, DOM audit, Lighthouse.
- `/products` and `/en/products` — filters, pagination, DOM audit, Lighthouse.
- `/products/peste-test-6393` — gallery, variants, reviews, DOM audit, Lighthouse.
- `/checkout` with a seeded cart item — form labels, error banner, Lighthouse.
- `/login` — form, tabs, password toggle, Lighthouse.
- `/account` as customer `customer@pestinu.ir` — profile tab and addresses tab with “Add Address” open, Lighthouse.
- `/admin`, `/admin/products`, `/admin/orders` as `admin@pestinu.ir` — DOM audit, Lighthouse; order detail dialog opened.
- `/en/admin` — locale/direction audit.

### Not verified

- Full responsive matrix at **360×800, 390×844, 768×1024, 1024×768, 1440×900**. The browser harness exposed a single ~800×674 viewport, so responsive findings are static-class reviews, not geometric measurements.
- Dark theme. No dark-mode Lighthouse pass or contrast measurement was run.
- Screen-reader spot check.
- Real ZarinPal/Zibal sandbox, Neon, TOTP, and Vercel Blob flows.
- Cart drawer keyboard traversal and mobile menu focus trap under a real touch/keyboard session.
- Full payment/order completion against a real gateway.

### Test data / sessions

- Customer: `customer@pestinu.ir` / `Customer123!` (also `09121111111`).
- Admin: `admin@pestinu.ir` / `AdminPassword123!`.
- The local database runs on port `54329`; no `prisma/migrations`, setup uses `prisma db push`.
- The production DB still needs the nullable phone schema sync before deploying the phone-related fixes.

---

## 7. Proposed fix batches (after approval)

### Batch 1 — P0 safety and destructive actions

- Shared confirmation dialog primitive.
- Order cancellation (customer + admin), address deletion, bulk product archive.
- Explicit action labels and audit reason for admin cancellation.
- Files: `account/page.tsx`, `admin/orders/page.tsx`, `admin/products/page.tsx`, new `components/ui/alert-dialog.tsx` if not already present.
- Verification: manual destructive-path tests + unit tests for handlers.

### Batch 2 — Form labels, focus, and error announcements

- Checkout province/city/coupon; account address form; admin search/filter/tracking; header/filter/cart search.
- `aria-invalid`, `aria-describedby`, error summary, focus-first-invalid.
- Focus rings from `--ring`.
- Files: ~8 files; split into storefront and admin sub-batches to respect the 2–3 file edit cap.

### Batch 3 — Semantics, contrast, and skip link

- Skip link + `main id`.
- One `h1` per page; heading levels; `CardTitle` semantic option.
- Contrast token changes in announcement bar, product cards, admin shell, account logout.
- Files: `layout.tsx`, `admin-shell.tsx`, `card.tsx`, `ProductCard.tsx`, `AnnouncementBar.tsx`, `globals.css`/`tailwind.config.ts` if tokens change.

### Batch 4 — Correctness and i18n

- Price sort in DB across all pages.
- Reorder real variant data; pending payment route.
- Admin checkout redirect to an existing route.
- English admin decision (localize or redirect).
- Carousel pause + localized labels.
- Files: `products/page.tsx`, `account/page.tsx`, `checkout/layout.tsx`, `admin-shell.tsx`, `ProductCarousel.tsx`, `carousel.tsx`.

### Batch 5 — P2 polish

- Pagination `aria-current`/truncation, active filter chips, review dates, OTP attributes, table captions, URL state, native confirms, `text-[10px]/[11px]` cleanup, raw palette cleanup.

---

## 8. Machine-readable audit appendix

```json
{
  "audit": "pestinu-ui-ux-2026-10-22",
  "scope": [
    "home",
    "product-listing",
    "product-detail",
    "cart",
    "checkout",
    "login",
    "account",
    "admin-dashboard",
    "admin-products",
    "admin-orders"
  ],
  "locales": ["fa", "en"],
  "viewport": "~800x674 (harness; innerWidth 785 with scrollbar)",
  "theme": "light",
  "status": "audit-only",
  "severity_counts": { "P0": 1, "P1": 19, "P2": 16 },
  "findings": [
    {
      "id": "P0-01",
      "severity": "P0",
      "rule_id": ["UX-CMP-011", "UX-ADM-002", "UX-ADM-005"],
      "file": "src/app/[locale]/account/page.tsx",
      "line": 255,
      "also": [
        "src/app/[locale]/account/page.tsx:243",
        "src/app/[locale]/account/page.tsx:762",
        "src/app/[locale]/admin/orders/page.tsx:500",
        "src/app/[locale]/admin/products/page.tsx:462"
      ],
      "evidence": "Cancel order, delete address, and bulk archive execute without confirmation.",
      "fix": "Add explicit confirmation dialogs with target-specific action labels and audit reason.",
      "status": "open"
    },
    {
      "id": "P1-02",
      "severity": "P1",
      "rule_id": ["UX-A11Y-004", "UX-TYP-004"],
      "file": "src/app/[locale]/page.tsx",
      "line": 69,
      "also": [
        "src/app/[locale]/login/page.tsx:311",
        "src/components/ui/card.tsx:32",
        "src/components/storefront/ProductCard.tsx:156",
        "src/app/[locale]/products/[slug]/page.tsx:162"
      ],
      "evidence": "Home and login have zero h1; listing/detail/checkout/account skip heading levels.",
      "fix": "One h1 per page, sequential section headings, semantic CardTitle option.",
      "status": "open"
    },
    {
      "id": "P1-03",
      "severity": "P1",
      "rule_id": ["UX-COL-003", "UX-A11Y-006"],
      "file": "src/components/storefront/AnnouncementBar.tsx",
      "line": 29,
      "evidence": "Multiple measured contrast failures: 4.32 announcement, 3.62 discount, 3.20 variant, 2.63 admin sidebar, 3.19 admin pending badge.",
      "fix": "Token/foreground adjustments; re-run Lighthouse to zero contrast failures.",
      "status": "open"
    },
    {
      "id": "P1-04",
      "severity": "P1",
      "rule_id": ["UX-CMP-003", "UX-A11Y-009"],
      "file": "src/app/[locale]/checkout/page.tsx",
      "line": 348,
      "also": [
        "src/app/[locale]/account/page.tsx:525",
        "src/app/[locale]/admin/products/page.tsx:382",
        "src/app/[locale]/admin/orders/page.tsx:219"
      ],
      "evidence": "Province/city/coupon and all address fields lack programmatic labels; admin filters/checkboxes unnamed.",
      "fix": "Visible Label htmlFor/id pairs, aria-label for compact controls, row-identity names for checkboxes.",
      "status": "open"
    },
    {
      "id": "P1-05",
      "severity": "P1",
      "rule_id": ["UX-A11Y-002", "UX-CMP-005"],
      "file": "src/components/storefront/ProductGallery.tsx",
      "line": 27,
      "evidence": "Zoom trigger is a non-focusable div with invalid aria-expanded; dialog has no title.",
      "fix": "Button trigger, DialogTitle/Description, thumbnails aria-pressed, focus return.",
      "status": "open"
    },
    {
      "id": "P1-07",
      "severity": "P1",
      "rule_id": ["UX-ECOM-008"],
      "file": "src/app/[locale]/products/page.tsx",
      "line": 106,
      "evidence": "Price sort runs after pagination on the current 12 products only.",
      "fix": "Sort by aggregate variant price in the database before pagination.",
      "status": "open"
    },
    {
      "id": "P1-11",
      "severity": "P1",
      "rule_id": ["UX-CNT-002", "UX-RTL-005"],
      "file": "src/components/admin/admin-shell.tsx",
      "line": 152,
      "evidence": "Live /en/admin: document lang=en, dir=ltr; shell dir=rtl and all Persian.",
      "fix": "Localize admin or redirect /en/admin to /fa/admin; derive dir from locale.",
      "status": "open"
    }
  ]
}
```

---

## 9. Approval gate

No application code, migration, commit, push, or deploy was produced by this audit.

**Next step requires explicit approval.** Recommended sequence:

1. Approve Batch 1 only (P0 destructive actions) and I will implement it first.
2. Or approve Batch 1 + Batch 2 (P0 + form/error accessibility) for the highest-risk fixes.
3. Or request a narrower page-by-page fix order.

After approval I will keep changes within the 2–3 file edit cap per sub-batch, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, targeted browser checks, and regenerate the AI index.
