---
name: hisabche-desktop
description: Working in apps/desktop — Electron shell, renderer routes, shims, IPC, local SQLite, or packaging the Windows build.
---

# Desktop (Electron + Vite + react-router)

The desktop app is a **thin shell around the shared UI**. Screens come from
`@hisabche/ui/screens` — the same modules web renders. Do not fork a screen.

```
apps/desktop/electron/          main + preload (Node side)
apps/desktop/src/app/app.tsx    hash router
apps/desktop/src/features/      thin pages that mount shared screens
apps/desktop/src/shims/         next-intl, next/navigation, next/link, next/image
apps/desktop/src/shared/        local i18n init, storage, print, stores
```

A feature page should be a few lines:

```tsx
import { InvoicesContainer } from '@hisabche/ui/screens'
export default function InvoicesPage() {
  return <InvoicesContainer />
}
```

## Routes must mirror web

Shared containers navigate by pushing web-style paths (`/invoices/:id`,
`/quick-invoice`, `/warehouse/:id`). `app.tsx` matches them exactly so no
container needs a platform branch. **A new web route needs its desktop twin**,
or the shared screen navigates into a 404. Old paths keep redirects so existing
windows and shortcuts still resolve.

Hash routing (`createHashRouter`) — a packaged app loads from `file://` and has
no server to rewrite paths.

## Shims

`electron.vite.config.ts` aliases `next-intl`, `next/navigation`, `next/link`
and `next/image` to `src/shims/`. That is what lets `packages/ui` be written
against Next and still run here. If a shared component starts using another
Next API, extend the shim rather than branching the component.

The `next-intl` shim reads the same `packages/i18n/messages` catalogue as web,
so copy stays identical across the two.

## Native module

`better-sqlite3` is native and stays unpacked from the asar
(`asarUnpack` in `electron-builder.yml`). Do not bundle it into the renderer.

## Build and package

```bash
cd apps/desktop
npx tsc --noEmit
npx electron-vite build        # catches shim and import breakage early
pnpm package:win               # NSIS installer in dist/
```

The renderer build is the fastest way to find a shared-UI import that desktop
cannot resolve — run it after any `packages/ui` change.

## Adding a workspace dependency

pnpm is strict. If a shared package pulls something in, that package must
declare it — `packages/store` missing `@hisabche/api` broke the desktop bundle
while every other app worked by hoisting luck.

## Common mistakes

- Rebuilding a screen that `@hisabche/ui/screens` already exports.
- Adding a web route without the desktop route.
- Branching a shared component for desktop instead of extending a shim.
- Assuming Node globals in the renderer — it has no `process`.
