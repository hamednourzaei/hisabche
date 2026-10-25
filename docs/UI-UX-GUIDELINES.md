---
document_id: pestinu-ui-ux-guidelines
version: 1.0.0
status: active
last_updated: 2026-10-22
language: en
scope: web
applies_to:
  - storefront
  - customer-account
  - admin
locales:
  - fa-IR (rtl)
  - en (ltr)
stack:
  framework: nextjs-app-router
  react: '19'
  styling: tailwindcss-4
  primitives: shadcn-ui-radix
  icons: lucide-react
  motion: framer-motion
  font: vazirmatn
  translations: next-intl
normative_terms:
  MUST: required
  MUST_NOT: forbidden
  SHOULD: recommended unless a documented reason exists
  SHOULD_NOT: discouraged unless a documented reason exists
  MAY: optional
source_of_truth:
  color_and_radius_tokens: src/app/globals.css
  theme_and_palette: tailwind.config.ts
  ui_primitives: src/components/ui
  translations: messages/fa.json, messages/en.json
  routing: src/i18n/routing.ts
---

# Pestinu UI/UX Guidelines

> This file is the normative UI/UX contract for humans and AI agents working on Pestinu.
> It is intentionally structured with stable IDs, explicit rules, checklists, and machine-readable blocks.
> When this file conflicts with code, the code is the source of truth for token values, but the intent of this file remains binding. Update both in the same change.

## 0. Agent Quick Contract

Before editing any UI:

- [ ] Read this file.
- [ ] Read `.ai/codebase/CODEBASE_MAP.md` for non-error tasks.
- [ ] Reuse existing components in `src/components/ui` before creating new primitives.
- [ ] Use semantic tokens, not raw colors.
- [ ] Define all relevant states: default, hover, focus, active, disabled, loading, empty, error, success.
- [ ] Test both `fa` (RTL) and `en` (LTR).
- [ ] Test keyboard navigation and visible focus.
- [ ] Check mobile widths: 360, 390, 768, 1024, and 1440 CSS px.
- [ ] Run the applicable checks in Section 7.4 and satisfy Section 8.
- [ ] Report status using the labels in Section 8.1.
- [ ] Do not commit, push, or deploy without explicit approval.

### 0.1 AI decision order

1. Accessibility and correctness.
2. Pestinu brand and existing design tokens.
3. Existing component patterns.
4. Reference guidance from Section 9.
5. Aesthetic preference.

### 0.2 Conflict resolution

1. WCAG 2.2 AA and ARIA Authoring Practices override visual preference.
2. This document overrides external design systems for Pestinu-specific decisions.
3. `src/app/globals.css` and `tailwind.config.ts` override this document for token values.
4. If two references conflict, prefer the one closest to the page type:
   - Forms, errors, content: GOV.UK Design System.
   - Storefront and checkout: Shopify Polaris + Baymard.
   - Admin structure and data density: IBM Carbon + GitHub Primer.
   - RTL behavior: Ant Design + Material Design 3.
5. Never mix the visual language of multiple design systems. Extract principles, not skins.

---

## 1. Scope and Non-Goals

### 1.1 In scope

- Public storefront pages.
- Customer authentication and account pages.
- Cart and checkout.
- Admin dashboard and management screens.
- Shared UI primitives and design tokens.
- Persian RTL and English LTR experiences.
- Light and dark themes.

### 1.2 Out of scope

- Native mobile apps.
- Desktop apps.
- POS, warehouse, accounting, HR, manufacturing, offline, or sync features.
- New dependencies or component libraries without explicit approval.

---

## 2. Brand Direction

Pestinu is a premium Iranian pistachio and gift e-commerce brand. The interface should feel:

- Calm, warm, natural, and trustworthy.
- Premium without being flashy.
- Product-first, with generous spacing and clear photography.
- Persian-first, with English as a complete secondary experience.

### 2.1 Visual guardrails

| ID        | Level    | Rule                                                                                                     |
| --------- | -------- | -------------------------------------------------------------------------------------------------------- |
| BRAND-001 | MUST     | Use the warm cream, deep forest, pistachio green, and saffron gold palette defined by tokens.            |
| BRAND-002 | MUST     | Use gold as an accent only. Do not use gold for body text on light backgrounds.                          |
| BRAND-003 | MUST     | Prefer product photography and real content over generic illustrations.                                  |
| BRAND-004 | SHOULD   | Use soft borders and subtle shadows. Avoid heavy glassmorphism, neon gradients, and generic SaaS purple. |
| BRAND-005 | SHOULD   | Keep one primary action per view. Secondary actions must be visually subordinate.                        |
| BRAND-006 | MUST_NOT | Use dark patterns, fake urgency, hidden costs, or pre-checked consent.                                   |

---

## 3. Design Tokens

### 3.1 Color tokens

Current tokens live in `src/app/globals.css`. Dark equivalents are defined under `.dark`.

| Token                    | Current light value                            | Semantic use                       |
| ------------------------ | ---------------------------------------------- | ---------------------------------- |
| `--background`           | `hsl(40 33% 98%)` / warm cream `#FAF8F5`       | Page background                    |
| `--foreground`           | `hsl(135 30% 12%)` / deep forest               | Primary text                       |
| `--card`                 | `hsl(0 0% 100%)`                               | Cards, sheets, surfaces            |
| `--card-foreground`      | `hsl(135 30% 12%)`                             | Text on cards                      |
| `--primary`              | `hsl(132 25% 38%)` / pistachio `#4E7D55`       | Primary action, active state       |
| `--primary-foreground`   | `hsl(0 0% 100%)`                               | Text on primary                    |
| `--secondary`            | `hsl(130 35% 94%)` / light pistachio `#E8F5E9` | Subtle surfaces, secondary actions |
| `--secondary-foreground` | `hsl(135 30% 15%)`                             | Text on secondary                  |
| `--muted`                | `hsl(40 20% 92%)`                              | Disabled or subdued surfaces       |
| `--muted-foreground`     | `hsl(135 10% 40%)`                             | Secondary text, metadata           |
| `--accent`               | `hsl(46 65% 52%)` / saffron `#D4AF37`          | Highlight, badge, premium accent   |
| `--accent-foreground`    | `hsl(135 30% 10%)`                             | Text on accent                     |
| `--destructive`          | `hsl(0 84% 60%)`                               | Errors, destructive actions        |
| `--border` / `--input`   | `hsl(40 15% 88%)`                              | Borders, dividers, input outlines  |
| `--ring`                 | `hsl(132 25% 38%)`                             | Focus ring                         |

### 3.2 Color rules

| ID         | Level    | Rule                                                                                                                           |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| UX-COL-001 | MUST     | Use semantic tokens (`bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`) instead of raw palette values. |
| UX-COL-002 | MUST     | Do not use raw hex, RGB, or HSL values outside `src/app/globals.css` and `tailwind.config.ts`.                                 |
| UX-COL-003 | MUST     | Verify text contrast: at least 4.5:1 for normal text and 3:1 for large text and UI boundaries.                                 |
| UX-COL-004 | MUST_NOT | Use gold `#D4AF37` for normal text on white or cream. Use `--accent-foreground` or a dark text token.                          |
| UX-COL-005 | MUST     | Never communicate status by color alone. Add text, icon, or label.                                                             |
| UX-COL-006 | MUST     | Test every color decision in both light and dark themes.                                                                       |
| UX-COL-007 | SHOULD   | Use `--destructive` only for error and destructive intent, not decoration.                                                     |

### 3.3 Typography

| ID         | Level    | Rule                                                                                                        |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| UX-TYP-001 | MUST     | Use `var(--font-vazirmatn)` through the existing `font-sans` token.                                         |
| UX-TYP-002 | MUST     | Keep body text at least 14px; captions at least 12px.                                                       |
| UX-TYP-003 | MUST     | Use Persian-friendly line height: 1.7 to 1.9 for body copy.                                                 |
| UX-TYP-004 | SHOULD   | Use a clear hierarchy: display 32/40, h1 28/36, h2 24/32, h3 20/28, body 16/28, small 14/24, caption 12/20. |
| UX-TYP-005 | SHOULD   | Use `text-balance` for headings and `text-pretty` for paragraphs where supported.                           |
| UX-TYP-006 | MUST_NOT | Use all-caps or letter-spacing for Persian text.                                                            |
| UX-TYP-007 | MUST     | Use locale-aware digits. Persian UI uses Persian digits; English UI uses Latin digits.                      |

### 3.4 Spacing and layout

| ID         | Level  | Rule                                                                                                  |
| ---------- | ------ | ----------------------------------------------------------------------------------------------------- |
| UX-SPC-001 | MUST   | Use the 4px base scale: 4, 8, 12, 16, 24, 32, 48, 64, 96.                                             |
| UX-SPC-002 | MUST   | Container max width is 1400px. Use 24px horizontal padding on desktop and 16px on mobile.             |
| UX-SPC-003 | SHOULD | Section spacing: 64–96px desktop, 40–56px mobile.                                                     |
| UX-SPC-004 | SHOULD | Card padding: 24px standard, 16px compact.                                                            |
| UX-SPC-005 | MUST   | Avoid arbitrary values such as `p-[13px]`. If unavoidable, document the reason in the change summary. |

### 3.5 Radius, shadow, motion, z-index

| Token / rule       | Value / requirement                                                          |
| ------------------ | ---------------------------------------------------------------------------- |
| `--radius`         | `0.75rem` / 12px                                                             |
| Cards              | `rounded-lg`                                                                 |
| Buttons and inputs | `rounded-md`                                                                 |
| Badges and pills   | `rounded-full`                                                               |
| Shadows            | `shadow-sm` for cards, `shadow-md` for overlays; prefer borders in dark mode |
| Motion duration    | 150–250ms; ease-out for entry, ease-in for exit                              |
| Reduced motion     | Respect `prefers-reduced-motion: reduce`                                     |
| Z-index            | base 0, sticky 10, header 30, dropdown 40, modal 50, toast 60                |

| ID         | Level  | Rule                                                                    |
| ---------- | ------ | ----------------------------------------------------------------------- |
| UX-MOT-001 | MUST   | Respect reduced-motion preferences and disable non-essential animation. |
| UX-MOT-002 | MUST   | Do not autoplay carousels without pause/stop controls.                  |
| UX-MOT-003 | SHOULD | Animate opacity and transform, not layout properties.                   |
| UX-ZIX-001 | MUST   | Use the z-index scale above. Do not invent one-off values.              |

---

## 4. Normative Rules

### 4.1 Foundation

| ID         | Level    | Rule                                                                                            | Check                                     |
| ---------- | -------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- |
| UX-FND-001 | MUST     | Use semantic design tokens for color, radius, and typography.                                   | Search changed files for raw hex/rgb/hsl. |
| UX-FND-002 | MUST     | Use `cn()` from `@/lib/utils` for conditional or merged classes.                                | Inspect class composition.                |
| UX-FND-003 | MUST     | Reuse existing primitives in `src/components/ui` before creating a new primitive.               | Compare with existing components.         |
| UX-FND-004 | MUST_NOT | Add a dependency, icon pack, animation library, or component library without explicit approval. | Check `package.json` diff.                |
| UX-FND-005 | MUST     | Keep a normal UI change within 2–3 files unless a documented reason exists.                     | Review file count.                        |
| UX-FND-006 | MUST     | Preserve the existing light/dark theme behavior.                                                | Test both themes.                         |
| UX-FND-007 | MUST_NOT | Copy the visual skin of an external design system. Adapt principles to Pestinu tokens.          | Visual review.                            |

### 4.2 Layout and responsive behavior

| ID         | Level  | Rule                                                                                                       |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| UX-LAY-001 | MUST   | Design mobile-first. No horizontal overflow at 320px.                                                      |
| UX-LAY-002 | MUST   | Test at 360, 390, 768, 1024, and 1440 CSS px.                                                              |
| UX-LAY-003 | MUST   | Use a 4-column grid on mobile, 8 on tablet, and 12 on desktop where a grid is appropriate.                 |
| UX-LAY-004 | MUST   | Sticky headers, filters, and checkout summaries must not cover focused content. Use `scroll-margin`.       |
| UX-LAY-005 | MUST   | Long content must wrap or truncate intentionally; never clip prices, CTAs, or error text.                  |
| UX-LAY-006 | SHOULD | Keep card CTA positions aligned within the same grid row.                                                  |
| UX-LAY-007 | MUST   | Ensure touch targets are at least 24×24 CSS px; 44×44 is the preferred minimum for primary mobile actions. |

### 4.3 RTL and LTR

| ID         | Level    | Rule                                                                                                                    |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| UX-RTL-001 | MUST     | Use logical utilities: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`.                    |
| UX-RTL-002 | MUST     | Set `dir` and `lang` at the document/layout level; do not flip individual components ad hoc.                            |
| UX-RTL-003 | MUST     | Isolate LTR data inside RTL UI with `dir="ltr"` where needed: phone numbers, emails, SKUs, tracking codes, URLs.        |
| UX-RTL-004 | MUST     | Flip directional icons such as back/forward arrows and chevrons. Do not flip checkmarks, play controls, or brand marks. |
| UX-RTL-005 | MUST     | Test layout in both `fa` and `en`, not only text replacement.                                                           |
| UX-RTL-006 | MUST     | Use locale-aware formatting for numbers, currency, dates, and phone numbers.                                            |
| UX-RTL-007 | MUST_NOT | Use physical `left`/`right` alignment where logical `start`/`end` is intended.                                          |

### 4.4 Components

| ID         | Level | Rule                                                                                                       |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| UX-CMP-001 | MUST  | One primary button per view or card. Secondary actions use `secondary`, `outline`, or `ghost`.             |
| UX-CMP-002 | MUST  | Icon-only buttons require an accessible name and, where useful, a tooltip.                                 |
| UX-CMP-003 | MUST  | Inputs require a visible label. Placeholder text is not a label.                                           |
| UX-CMP-004 | MUST  | Invalid fields set `aria-invalid` and reference error text with `aria-describedby`.                        |
| UX-CMP-005 | MUST  | Dialogs trap focus, close on Escape, have a title and description, and return focus to the trigger.        |
| UX-CMP-006 | MUST  | Tables need a caption or accessible name; sortable headers use `aria-sort`; provide a mobile alternative.  |
| UX-CMP-007 | MUST  | Tabs use `role="tablist"`, arrow-key navigation, and URL state when tabs control filters or views.         |
| UX-CMP-008 | MUST  | Toasts are not the only error mechanism. Persistent errors must also appear inline or in an error summary. |
| UX-CMP-009 | MUST  | Loading skeletons must match the final layout and avoid layout shift.                                      |
| UX-CMP-010 | MUST  | Empty states include a reason, a next action, and an icon or illustration.                                 |
| UX-CMP-011 | MUST  | Destructive actions require confirmation with an explicit action label, not generic “OK”.                  |
| UX-CMP-012 | MUST  | A card with nested actions must not make the whole card a competing click target.                          |
| UX-CMP-013 | MUST  | Badges use text plus color, never color alone.                                                             |
| UX-CMP-014 | MUST  | Validate forms on blur and submit, not on every keystroke.                                                 |
| UX-CMP-015 | MUST  | Preserve user input after validation or server errors and focus the first invalid field.                   |
| UX-CMP-016 | MUST  | OTP inputs support paste, segmented entry, clear resend timing, and accessible error messages.             |
| UX-CMP-017 | MUST  | Select menus with more than 10 options should support search or grouping.                                  |
| UX-CMP-018 | MUST  | Accordions expose `aria-expanded` and preserve keyboard operation.                                         |

### 4.5 E-commerce flows

| ID          | Level | Rule                                                                                                                      |
| ----------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| UX-ECOM-001 | MUST  | Product cards show image, name, price, availability, and a clear primary action.                                          |
| UX-ECOM-002 | MUST  | Product detail pages show gallery, variant, price, stock, add-to-cart, quantity, shipping/returns, and trust information. |
| UX-ECOM-003 | MUST  | Cart lines show product, variant, quantity, unit price, line total, remove action, subtotal, and checkout CTA.            |
| UX-ECOM-004 | MUST  | Quantity changes update line totals, subtotal, and cart count immediately without a full-page reload.                     |
| UX-ECOM-005 | MUST  | Checkout supports guest flow, clear progress, address, shipping, payment, order summary, and inline validation.           |
| UX-ECOM-006 | MUST  | Show shipping cost and return policy before the final payment action.                                                     |
| UX-ECOM-007 | MUST  | Out-of-stock products disable purchase and offer an alternative or notify action.                                         |
| UX-ECOM-008 | MUST  | Filters expose active filter chips, a clear-all action, URL state, and a mobile filter sheet.                             |
| UX-ECOM-009 | MUST  | Search and filter no-results states explain what happened and offer a recovery action.                                    |
| UX-ECOM-010 | MUST  | Order confirmation shows order number, summary, next steps, and support contact.                                          |
| UX-ECOM-011 | MUST  | Format prices with locale-aware digits and the correct currency label; never truncate the amount.                         |
| UX-ECOM-012 | MUST  | Do not use fake countdowns, fake stock warnings, or hidden fees.                                                          |

### 4.6 Admin

| ID         | Level    | Rule                                                                                                 |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------- |
| UX-ADM-001 | MUST     | Admin screens may be dense, but body text stays at least 14px and captions at least 12px.            |
| UX-ADM-002 | MUST     | Bulk actions show the selected count and require confirmation for destructive operations.            |
| UX-ADM-003 | MUST     | Filters, sorting, and pagination persist in the URL.                                                 |
| UX-ADM-004 | MUST     | Tables remain usable on mobile through a card/list view or an explicit horizontal-scroll affordance. |
| UX-ADM-005 | MUST     | Destructive actions include enough context for the operator to identify the target.                  |
| UX-ADM-006 | MUST     | Every data view defines loading, empty, error, and permission-denied states.                         |
| UX-ADM-007 | MUST_NOT | Hide critical actions behind hover only.                                                             |
| UX-ADM-008 | MUST     | Dashboard cards show metric, time period, trend, and a link to the detailed view.                    |
| UX-ADM-009 | MUST     | Permission-denied states explain the required role or next step.                                     |
| UX-ADM-010 | MUST     | Row-level actions have accessible names that include the row identity.                               |

### 4.7 Accessibility

| ID          | Level  | Rule                                                                                     |
| ----------- | ------ | ---------------------------------------------------------------------------------------- |
| UX-A11Y-001 | MUST   | Meet WCAG 2.2 AA for all customer and admin flows.                                       |
| UX-A11Y-002 | MUST   | Every interactive element is reachable and operable by keyboard.                         |
| UX-A11Y-003 | MUST   | Focus is always visible. Do not remove focus outlines without an equivalent replacement. |
| UX-A11Y-004 | MUST   | Use semantic HTML and correct landmarks and heading order.                               |
| UX-A11Y-005 | MUST   | Informative images have meaningful alt text; decorative images use `alt=""`.             |
| UX-A11Y-006 | MUST   | Text contrast is at least 4.5:1; large text and UI boundaries at least 3:1.              |
| UX-A11Y-007 | MUST   | Do not use color as the only indicator of state or meaning.                              |
| UX-A11Y-008 | MUST   | Provide a skip link and preserve a logical tab order.                                    |
| UX-A11Y-009 | MUST   | Forms have labels, instructions, and accessible error messages.                          |
| UX-A11Y-010 | MUST   | Motion respects reduced-motion preferences.                                              |
| UX-A11Y-011 | MUST   | Run axe on changed pages and resolve critical and serious issues.                        |
| UX-A11Y-012 | SHOULD | Spot-check at least one critical flow with a screen reader.                              |

### 4.8 Content and internationalization

| ID         | Level    | Rule                                                                                         |
| ---------- | -------- | -------------------------------------------------------------------------------------------- |
| UX-CNT-001 | MUST     | User-facing strings come from `messages/fa.json` and `messages/en.json` through `next-intl`. |
| UX-CNT-002 | MUST     | Persian is the primary experience; English must be complete, not partial.                    |
| UX-CNT-003 | MUST_NOT | Ship machine-translated copy without human review.                                           |
| UX-CNT-004 | MUST     | Button labels start with a verb: “Add to cart”, “Save address”, “Continue to payment”.       |
| UX-CNT-005 | MUST     | Error messages explain what happened and how to fix it, without blaming the user.            |
| UX-CNT-006 | MUST     | Use Persian punctuation in Persian copy: `،` `؛` `؟`.                                        |
| UX-CNT-007 | MUST     | Format numbers, currency, dates, and phone numbers with locale-aware utilities.              |
| UX-CNT-008 | MUST     | Do not use lorem ipsum or placeholder copy in production.                                    |
| UX-CNT-009 | SHOULD   | Keep microcopy short, specific, and warm; avoid hype and excessive exclamation marks.        |
| UX-CNT-010 | MUST     | Alt text describes purpose or content, not “image” or the file name.                         |

Example Persian action labels:

- `افزودن به سبد خرید`
- `ادامه فرآیند خرید`
- `ذخیره آدرس`
- `بازگشت به فروشگاه`

### 4.9 Performance UX

| ID          | Level    | Rule                                                                     |
| ----------- | -------- | ------------------------------------------------------------------------ |
| UX-PERF-001 | SHOULD   | Target Core Web Vitals: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1.              |
| UX-PERF-002 | MUST     | Use `next/image` with explicit dimensions or aspect ratio.               |
| UX-PERF-003 | MUST     | Only the hero/LCP image uses `priority`; below-fold images lazy-load.    |
| UX-PERF-004 | MUST     | Avoid layout shift from fonts, images, banners, and skeletons.           |
| UX-PERF-005 | MUST_NOT | Add blocking third-party scripts without approval.                       |
| UX-PERF-006 | MUST     | Broken image URLs are not acceptable; provide a fallback or placeholder. |

---

## 5. Required States

Every interactive component and every data view must define the states that apply to it.

| State            | Required for                   | Requirement                                             |
| ---------------- | ------------------------------ | ------------------------------------------------------- |
| Default          | All components                 | Stable layout and readable content                      |
| Hover            | Pointer devices                | Visible but not the only affordance                     |
| Focus            | All interactive elements       | Visible ring, logical order                             |
| Active / pressed | Buttons, tabs, toggles         | Clear pressed feedback                                  |
| Disabled         | Actions that cannot run        | `disabled` or `aria-disabled`, with reason where useful |
| Loading          | Actions and data views         | Spinner or skeleton; prevent duplicate submission       |
| Empty            | Lists, tables, search, cart    | Explanation + next action                               |
| Error            | Forms, data views, checkout    | Inline message + recovery path                          |
| Success          | Forms, checkout, admin actions | Confirmation and next step                              |
| Long content     | Cards, tables, menus           | Wrap, truncate, or scroll intentionally                 |
| RTL / LTR        | All layouts                    | No overflow, correct icon direction                     |
| Dark mode        | All surfaces                   | Contrast and border visibility preserved                |

---

## 6. Page Acceptance Criteria

| Page             | MUST pass                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Home             | Clear value proposition, one primary CTA, no autoplay without pause, LCP image optimized, trust signals visible.                |
| Product listing  | Filters/sort/pagination usable on mobile, active filters visible, clear-all action, no-results state, no horizontal overflow.   |
| Product detail   | Gallery, variant, price, stock, quantity, add-to-cart, shipping/returns, trust content, accessible gallery controls.            |
| Cart             | Quantity updates immediately, line totals and subtotal correct, remove action accessible, empty cart state, checkout CTA clear. |
| Checkout         | Guest flow, progress, address, shipping, payment, order summary, inline errors, preserved input, no hidden costs.               |
| Login / register | Email or phone login, password visibility toggle, accessible errors, loading state, OTP optional and hidden by default.         |
| Account          | Orders, addresses, profile, and logout are reachable; empty states exist; destructive actions confirm.                          |
| Admin dashboard  | Metrics are labeled with period and trend; loading/empty/error states; links to details.                                        |
| Admin products   | Search/filter/sort, bulk actions, create/edit, validation, image upload states, destructive confirmation.                       |
| Admin orders     | Status filters, order detail, customer/address context, safe status transitions, audit-friendly messaging.                      |

---

## 7. Audit Protocol

### 7.1 Required test matrix

| Dimension     | Values                                                          |
| ------------- | --------------------------------------------------------------- |
| Viewports     | 360×800, 390×844, 768×1024, 1024×768, 1440×900                  |
| Locales       | `fa` RTL, `en` LTR                                              |
| Themes        | Light, dark                                                     |
| States        | Default, loading, empty, error, success, disabled, long content |
| Input methods | Mouse, keyboard, touch                                          |
| Accessibility | axe + keyboard + focus + one screen-reader spot check           |

### 7.2 Severity

| Severity | Definition                                 | Examples                                                                                  |
| -------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| P0       | Blocks a critical flow or causes data loss | Checkout cannot complete, login broken, destructive action without confirmation           |
| P1       | Major usability or accessibility failure   | Keyboard trap, missing form label, contrast failure, mobile overflow, missing error state |
| P2       | Polish or consistency issue                | Inconsistent spacing, misaligned CTA, minor copy inconsistency                            |

### 7.3 Audit output schema

AI agents must return findings in this shape:

```json
{
  "page": "/fa/products",
  "locale": "fa",
  "viewport": "390x844",
  "theme": "light",
  "issues": [
    {
      "id": "A11Y-001",
      "severity": "P1",
      "rule_id": "UX-A11Y-003",
      "file": "src/components/example.tsx",
      "line": 42,
      "evidence": "Focus ring is removed and no replacement is present.",
      "fix": "Restore focus-visible ring using the ring token.",
      "status": "open"
    }
  ]
}
```

### 7.4 Verification commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

If a command is skipped or fails, state that explicitly. Do not infer success from a successful edit.

---

## 8. Definition of Done

A UI change is done only when all applicable items are true:

- [ ] The change cites the rule IDs it implements.
- [ ] Existing primitives and tokens are reused.
- [ ] No raw colors or one-off spacing values were introduced.
- [ ] All relevant states are implemented.
- [ ] `fa` RTL and `en` LTR both work.
- [ ] Light and dark themes both work.
- [ ] Keyboard navigation and focus are correct.
- [ ] axe has no critical or serious issues on changed pages.
- [ ] Typecheck, lint, tests, and build pass as applicable.
- [ ] Screenshots or recordings are captured for visual changes.
- [ ] The AI index is regenerated if code changed.
- [ ] No commit, push, or deploy happens without explicit approval.

### 8.1 Status labels

Use exactly these labels:

- `IMPLEMENTED` — code or documentation written, not executed.
- `TYPECHECKED` — `pnpm typecheck` passed.
- `UNIT TESTED` — `pnpm test` passed; name the tests.
- `E2E VERIFIED` — Playwright passed; name the specs.
- `LIVE VERIFIED` — exercised against a running app; include URL and steps.
- `NOT VERIFIED` — no applicable check was run.

### 8.2 Required AI response format

When proposing or completing a UI change, report:

```text
Rule IDs:
Primary files:
Change:
States covered:
RTL/LTR:
Accessibility:
Verification:
Status:
```

---

## 9. Reference Library

These references are advisory unless marked normative. Use them to extract principles, not to copy visual skins.

| ID     | Reference                        | Authority                    | Use for                                                  | Link                                                                                 |
| ------ | -------------------------------- | ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| REF-01 | Material Design 3                | Advisory                     | Color, typography, layout, motion, accessibility         | https://m3.material.io/                                                              |
| REF-02 | Apple Human Interface Guidelines | Advisory                     | Interaction principles, navigation, feedback             | https://developer.apple.com/design/human-interface-guidelines/                       |
| REF-03 | IBM Carbon Design System         | Primary structure            | Tokens, patterns, content, accessibility, data density   | https://www.carbondesignsystem.com/ · https://github.com/carbon-design-system/carbon |
| REF-04 | Shopify Polaris                  | Primary commerce             | Admin tables, forms, empty states, storefront operations | https://shopify.dev/docs/api/polaris                                                 |
| REF-05 | GitHub Primer                    | Primary product UI           | Dense product UI, navigation, forms, accessibility       | https://primer.style/ · https://github.com/primer/css                                |
| REF-06 | Atlassian Design System          | Advisory                     | Product patterns, tokens, content guidelines             | https://atlassian.design/                                                            |
| REF-07 | Microsoft Fluent 2               | Advisory                     | Enterprise patterns, motion, accessibility               | https://fluent2.microsoft.design/ · https://github.com/microsoft/fluentui            |
| REF-08 | Adobe Spectrum                   | Advisory                     | Color, spacing, components, patterns                     | https://spectrum.adobe.com/ · https://github.com/adobe/spectrum-web-components       |
| REF-09 | GOV.UK Design System             | Primary forms/content        | Forms, errors, content design, research-backed patterns  | https://design-system.service.gov.uk/ · https://github.com/alphagov/govuk-frontend   |
| REF-10 | U.S. Web Design System           | Advisory                     | Responsive government patterns, forms, accessibility     | https://designsystem.digital.gov/ · https://github.com/uswds/uswds                   |
| REF-11 | Ant Design                       | Primary RTL                  | React enterprise patterns, forms, tables, RTL            | https://ant.design/ · https://github.com/ant-design/ant-design                       |
| REF-12 | GitLab Pajamas                   | Advisory                     | Product UX principles, content, navigation               | https://design.gitlab.com/                                                           |
| REF-13 | Nielsen 10 Usability Heuristics  | Advisory principles          | Usability review and heuristic evaluation                | https://www.nngroup.com/articles/ten-usability-heuristics/                           |
| REF-14 | WCAG 2.2                         | Normative                    | Accessibility conformance                                | https://www.w3.org/TR/WCAG22/ · https://github.com/w3c/wcag                          |
| REF-15 | WAI-ARIA Authoring Practices     | Normative for custom widgets | Accessible component behavior                            | https://www.w3.org/WAI/ARIA/apg/ · https://github.com/w3c/aria-practices             |
| REF-16 | Laws of UX                       | Advisory principles          | Psychology of interaction and decision-making            | https://lawsofux.com/                                                                |
| REF-17 | Inclusive Design Principles      | Advisory principles          | Inclusive design review                                  | https://inclusivedesignprinciples.info/                                              |
| REF-18 | Checklist Design                 | Audit checklist              | Page-level UI/UX review                                  | https://www.checklist.design/                                                        |
| REF-19 | Baymard Institute                | Commerce research            | Product page, cart, checkout, search benchmarks          | https://baymard.com/                                                                 |
| REF-20 | Front-End Checklist              | Technical checklist          | HTML, CSS, accessibility, SEO, performance               | https://frontendchecklist.io/ · https://github.com/thedaviddias/Front-End-Checklist  |

### 9.1 Reference usage rules

| ID          | Level    | Rule                                                                                      |
| ----------- | -------- | ----------------------------------------------------------------------------------------- |
| REF-USE-001 | MUST     | Use WCAG 2.2 and ARIA APG as normative accessibility sources.                             |
| REF-USE-002 | MUST     | Use Carbon, Polaris, GOV.UK, Primer, and Baymard as pattern sources, not as visual skins. |
| REF-USE-003 | MUST_NOT | Copy code or long text from a reference without checking its license.                     |
| REF-USE-004 | SHOULD   | Record which reference influenced a new pattern in the change summary.                    |
| REF-USE-005 | MUST     | When references conflict, follow the conflict order in Section 0.2.                       |

---

## 10. Machine-Readable Change Gate

```yaml
ui_change_gate:
  required_reads:
    - docs/UI-UX-GUIDELINES.md
    - .ai/codebase/CODEBASE_MAP.md
  reuse_before_create:
    - src/components/ui
    - src/components/storefront
    - src/app/globals.css
    - tailwind.config.ts
  forbidden:
    - raw_hex_colors_outside_token_files
    - new_dependency_without_approval
    - div_or_span_as_button
    - placeholder_as_label
    - color_only_status
    - focus_outline_removed_without_replacement
    - hidden_critical_actions_on_hover
    - fake_urgency_or_hidden_fees
  required_states:
    - default
    - hover
    - focus
    - active
    - disabled
    - loading
    - empty
    - error
    - success
  required_checks:
    - responsive_360_390_768_1024_1440
    - locale_fa_rtl
    - locale_en_ltr
    - theme_light
    - theme_dark
    - keyboard_navigation
    - axe_critical_serious_zero
    - typecheck
    - lint
    - tests
    - build
  status_labels:
    - IMPLEMENTED
    - TYPECHECKED
    - UNIT TESTED
    - E2E VERIFIED
    - LIVE VERIFIED
    - NOT VERIFIED
```

---

## 11. Change Log

| Version | Date       | Change                                                                                                   |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| 1.0.0   | 2026-10-22 | Initial AI-readable UI/UX contract, tokens, rules, page criteria, audit protocol, and reference library. |
