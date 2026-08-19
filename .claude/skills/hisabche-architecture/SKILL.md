---
name: hisabche-architecture
description: Deciding where new code belongs, adding a package or app, changing dependency direction, or working out how a feature spans web, desktop, mobile and backend.
---

# Architecture

## Where does this code go?

| It is…                                                                  | It belongs in              |
| ----------------------------------------------------------------------- | -------------------------- |
| a Zod schema or domain rule                                             | `packages/validation`      |
| a pure display format (money, digits, CSV, locale)                      | `packages/formatting`      |
| a UI contract with no rendering (nav, selection, columns, colour roles) | `packages/ui-contract`     |
| a colour, spacing, radius or type scale                                 | `packages/design-tokens`   |
| a React screen or component for web/desktop/admin                       | `packages/ui`              |
| a React Native component                                                | `packages/mobile-ui`       |
| a TanStack Query hook over the API                                      | `packages/api`             |
| cross-app client state (auth, preferences, sync)                        | `packages/store`           |
| user-facing text                                                        | `packages/i18n/messages/*` |
| business logic                                                          | `backend/src/services`     |
| offline queue / local persistence                                       | `packages/offline`         |

If it is only ever used by one app, it can live in that app. If a second app
needs it, move it to a package rather than copying.

## Dependency direction

```
ui-contract · design-tokens · formatting · validation    (leaves)
        ↑
i18n · store · auth-core
        ↑
       api
        ↑
    ui / mobile-ui
        ↑
      apps
```

Packages never import from apps. `packages/ui` uses relative imports internally
— an `@/` alias there resolves into whichever app is consuming it.

Adding a cross-package import means declaring it in that package's
`package.json`. pnpm is strict: an undeclared dependency works by hoisting luck
until a build resolves it differently.

## Feature spanning platforms

1. Schema in `packages/validation`.
2. Service in `backend/src/services`, route in `backend/src/routes`, contract in
   `documents/API_REFERENCE.md` first.
3. Hook in `packages/api`.
4. Container + view in `packages/ui` → export from `screens.ts`.
5. Web route mounts the container; **add the matching desktop route** in
   `apps/desktop/src/app/app.tsx`.
6. Mobile builds a native screen with the same words and semantics.
7. Strings into all three locales.

## Metro and pnpm

React Native's bundler walks `node_modules` rather than following pnpm's
symlinks, so RN's transitive helpers must be hoisted. That list lives in
`publicHoistPattern` in `pnpm-workspace.yaml` — **not** `.npmrc`, which pnpm 10+
ignores for these settings. Changing it requires a full reinstall.

## Existing decisions worth knowing

- Desktop mounts web's screens; its router mirrors web's paths deliberately.
- Mobile is native by choice. No `react-native-web`, no WebView.
- Message catalogues are shared across web, desktop and admin; mobile has its own.
- Admin reuses `packages/ui` and the shared design system — it is not a fork.
- The party role (buyer/seller/both) is derived, not stored.

## Before adding a dependency

Check whether the monorepo already has something that does the job. Radix,
lucide, TanStack Query, Zod, zustand, date-fns-jalali and recharts are already
here. A new dependency needs a reason beyond convenience.
