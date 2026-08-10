# UI PARITY EXECUTION

Ledger for the Web → Mobile → Desktop parity programme. Web is the visual and
information-architecture reference; each platform renders the same specification
with its own primitives.

Status legend: `✓` at parity · `~` partial · `✗` missing.

---

## Architecture

The navigation layer is now one contract with three renderers:

```
packages/ui-contract/src/navigation.ts      ← destinations, copy keys, grouping
   ├── packages/ui/src/lib/menu/nav-items.ts    (lucide icons)  → web, desktop
   └── apps/mobile/src/shared/navigation/nav.ts (Ionicons)      → mobile
```

`ui-contract` has no React, DOM or React Native imports, which is what lets
mobile consume it — `packages/ui` cannot be imported on device.

Copy comes from `packages/i18n/messages/{fa,af,en}/common.json` on all three
platforms. Web and desktop read it through next-intl; mobile registers the same
catalogs as the i18next `common` namespace (`apps/mobile/src/shared/i18n`), so a
destination is spelled once and rendered identically everywhere. The catalogs
are registered in the mobile bootstrap rather than in `@hisabche/i18n` so web
does not ship them twice.

---

## Route parity

Contract paths are web paths. Desktop resolves them against its hash router;
mobile now serves them under the same names via expo-router.

| Intent     | Path               | Web | Desktop | Mobile |
| ---------- | ------------------ | --- | ------- | ------ |
| today      | `/dashboard`       | ✓   | ✓       | ✓ tab  |
| sell       | `/quick-invoice`   | ✓   | ✓       | ✓ tab  |
| get-paid   | `/invoices`        | ✓   | ✓       | ✓ tab  |
| stock      | `/warehouse`       | ✓   | ✓       | ✓ tab  |
| buy        | `/purchasing`      | ✓   | ✓       | ✓      |
| money      | `/accounting`      | ✓   | ✓       | ✓      |
| buyers     | `/customers`       | ✓   | ✓       | ✓      |
| follow-up  | `/crm`             | ✓   | ✗       | ✗      |
| team       | `/human-resources` | ✓   | ✗       | ✗      |
| projects   | `/projects`        | ✓   | ✗       | ✗      |
| production | `/manufacturing`   | ✓   | ✗       | ✗      |
| approvals  | `/approvals`       | ✓   | ✗       | ✗      |
| settings   | `/settings`        | ✓   | ✓       | ✓      |
| access     | `/permissions`     | ✓   | ✗       | ✗      |
| events     | `/activities`      | ✓   | ✓       | ✓      |
| sync       | `/sync-center`     | ✓   | ✓       | ✓      |

Detail routes: `/invoices/:id`, `/customers/:id`, `/warehouse/:id` exist on all
three. `/warehouse/scan` is mobile-only — it needs a camera.

Web additionally serves `/billing`, `/onboarding`, `/sales-followup`,
`/workflow-templates`, `/team-and-payroll` and `/projects/:id`,
`/human-resources/:id`, `/warehouse/:id`. None are in the navigation contract
yet; classify before porting.

---

## Documented platform differences

| Difference                                                         | Why                                                                                                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile bottom bar seats four primary intents, not six              | Five targets is the limit before a tab drops under the 44pt touch minimum. «خرید» and «پول و سود» render first on the More screen, still primary, one tap deeper. Decided in `MOBILE_TAB_IDS`.    |
| Mobile «بیشتر» is a navigation hub; Settings is a separate screen  | Matches web, which files Settings under the System group rather than making it the menu. Sync keeps a shortcut inside Settings because its pending-outbox count is what a user checks from there. |
| Purchasing renders as cards on mobile, a table on web              | A six-column table is unreadable at 390pt. Every web column is present: supplier, order date, expected delivery, item count, status, receive-goods action.                                        |
| Activities collapses to three activities per entity card on mobile | The web feed collapses the same way behind «نمایش بیشتر».                                                                                                                                         |

---

## Completed

**Navigation contract unification.**

- Extracted `NAV_CONTRACT`, `MORE_GROUPS_CONTRACT`, `COMMAND_CONTRACT` into
  `@hisabche/ui-contract`. `packages/ui` now attaches icons only; its public
  exports (`NAV_ITEMS`, `PRIMARY_ITEMS`, `MORE_GROUPS`, `COMMAND_ITEMS`,
  `MORE_ICON`, `SYNC_INTERVAL_MS`) are unchanged, so web and desktop are
  untouched. Existing `nav-contract.test.ts` passes unmodified.
- Mobile tab bar and More screen are generated from the contract.

**Mobile route paths aligned to web.**
`sales → invoices`, `inventory → warehouse`, `sync → sync-center`,
`(tabs)/index → (tabs)/dashboard`, `sales/new → (tabs)/quick-invoice`;
`customers` moved out of the tab bar to `/customers`. Detox testIDs updated.

**New mobile screens.** Purchasing (`usePurchaseOrders` / `useReceiveGoods`) and
Activities (`useActivities` / `useUnreadCount` / `useMarkAllAsRead`) — the same
hooks the web containers use, no duplicated fetching or business logic. Zero new
translation keys: both reuse the `purchasing.*` and `activity.*` keys already
present in all three catalogs.

**Sale/purchase parity.** `/quick-invoice?type=purchase` now seeds the mobile
draft's transaction type, matching the web and desktop command-palette entries.
One form, one engine, two semantics.

**Guard.** `apps/mobile/src/shared/navigation/__tests__/nav.test.ts` fails if
mobile offers a destination with no route file, or names a tab route file
differently from the contract path.

---

## Next

1. Screen-level audit of the seven routes already shared by all three platforms
   (dashboard, quick-invoice, invoices, invoice detail, warehouse, customers,
   accounting): measure web, compare typography/spacing/table and form structure,
   fix at the token or primitive level rather than per page.
2. Build the six destinations neither desktop nor mobile has: `/crm`,
   `/human-resources`, `/projects`, `/manufacturing`, `/approvals`,
   `/permissions`. Neither platform dead-links today — desktop filters the
   sidebar through `DESKTOP_ROUTES` and mobile through `IMPLEMENTED` — so each
   new screen lights up in navigation by adding its path or id to that one set.
3. Classify the un-contracted web routes listed above.
