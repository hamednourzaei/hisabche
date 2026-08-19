---
name: hisabche-i18n
description: Adding or fixing user-facing text, translations, locale-aware numbers and dates, or RTL layout. Use whenever a string, date or number is shown to a user in web, desktop, mobile or admin.
---

# i18n

## Where the strings live

One catalogue for web, desktop and admin:

```
packages/i18n/messages/fa/common.json   Persian (Iran)   — default
packages/i18n/messages/af/common.json   Dari (Afghanistan)
packages/i18n/messages/en/common.json   English
```

Nested objects, addressed by dotted path: `t('invoices.type.purchase')`.

Mobile has its own bundle — `apps/mobile/src/shared/i18n/mobile-strings.ts` —
typed by a `MobileBundle` interface, merged into i18next under the `mobile`
namespace. Adding a key there means adding it to the interface and all three
locales, or it will not compile.

## How each renderer reads them

| Renderer   | Mechanism                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| web, admin | `next-intl`; `apps/web/i18n/request.ts` loads the catalogue                                                       |
| desktop    | `apps/desktop/src/shims/next-intl.tsx` maps `useTranslations`/`useLocale` onto i18next reading the SAME catalogue |
| mobile     | `react-i18next`, `mobile` namespace                                                                               |

Because desktop shims `next-intl`, components in `packages/ui` write
`useTranslations()` and work unchanged on both.

## The mistake that keeps happening

Most components call `t('some.key', 'متن فارسی')` — a key plus a Persian
fallback. When the key is **missing from the catalogue**, `t` returns the
fallback, so the UI looks correct in Persian and silently stays Persian in
English. Whole features (landing FAQ, feature cards) shipped this way.

**Before editing a component, check whether the key exists:**

```bash
node -e "const m=require('./packages/i18n/messages/en/common.json');console.log(m.landing?.feature ?? 'MISSING')"
```

If the code already has keys, the fix is the catalogue, not the component.

## Adding strings

Edit the JSON with a Node script, not `sed` or a heredoc — Persian text through
shell quoting fails silently and has corrupted edits here before.

```js
const fs = require('fs')
const v = { fa: 'خروجی', af: 'خروجی', en: 'Export' }
for (const loc of ['fa', 'af', 'en']) {
  const p = `packages/i18n/messages/${loc}/common.json`
  const j = JSON.parse(fs.readFileSync(p, 'utf8'))
  j.customers = j.customers || {}
  j.customers.export = v[loc]
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n')
}
```

Dari is not a copy of Persian. It differs in vocabulary: بل not فاکتور, گدام not
انبار, انترنت not اینترنت, معلومات not اطلاعات, دکان not فروشگاه.

## Numbers and dates

`Intl.NumberFormat('fa-IR')` emits Persian digits; `'en'` emits Latin. Hardcoding
`'fa-AF'` is why English UI showed Persian digits across the app.

```tsx
import { useIntlLocale } from '../../hooks/use-intl-locale'
const locale = useIntlLocale()
new Intl.NumberFormat(locale).format(value)
```

Outside React, `resolveIntlLocale(lang)` from `@hisabche/formatting`.

Money formatting lives in `@hisabche/formatting` (`formatAmount`, `formatMoney`,
`currencySign`). Don't reimplement it.

## RTL

fa and af are RTL, en is LTR. Use logical CSS properties — `ms-`/`me-`,
`ps-`/`pe-`, `start`/`end` — never `ml-`/`mr-`/`left`/`right`. Check any layout
you touch in both directions.

## Validation

`packages/i18n` has a parity test: every key present in `fa` must exist in `af`
and `en`. It fails the build on a gap.

```bash
cd packages/i18n && npx vitest run
```

`packages/ui/src/lib/menu/__tests__/nav-contract.test.ts` additionally asserts
every navigation and command-palette label resolves in all three locales.

## Common mistakes

- Adding a key to `fa` only — the parity test catches it, but only if you run it.
- Editing the component when the key was already there and the catalogue wasn't.
- Using `sed`/heredoc for Persian JSON edits.
- `ml-`/`mr-` instead of `ms-`/`me-`.
- A key whose node is an object while code reads it as a string (`billing.plans.free`
  was both) — a path must resolve to a string or `t` returns the raw key.
