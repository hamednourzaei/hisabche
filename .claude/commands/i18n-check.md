---
description: Find hardcoded strings, missing translation keys and hardcoded locales
---

Audit i18n for $ARGUMENTS (or the current diff if no argument).

1. **Missing catalogue keys.** Components call `t('some.key', 'فارسی fallback')`.
   When the key is absent the fallback is shown, so English silently stays
   Persian. For each key the code uses, check it exists:
   ```bash
   node -e "const m=require('./packages/i18n/messages/en/common.json');console.log(m.PATH ?? 'MISSING')"
   ```
2. **Locale parity.** `cd packages/i18n && npx vitest run` — every `fa` key must
   exist in `af` and `en`.
3. **Hardcoded locales.** `grep -rn "'fa-AF'\|'fa-IR'\|toLocaleDateString('fa" packages/ui/src apps`
   — numbers and dates must use `useIntlLocale()` / `resolveIntlLocale()`.
4. **Hardcoded user-facing strings** — Persian literals in JSX that are not a
   `t()` fallback.
5. **RTL** — `ml-`/`mr-`/`left-`/`right-` instead of `ms-`/`me-`/`start-`/`end-`.

Fix the catalogue rather than the component when the keys already exist.
Dari is not a copy of Persian: بل، گدام، انترنت، معلومات، دکان.
