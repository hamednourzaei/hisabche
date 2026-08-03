# Desktop Status

## Current architecture

- Turborepo monorepo. `apps/web` (Next 16), `apps/mobile` (Expo 51), `backend` (Fastify + Postgres + Supabase Auth).
- Shared: `@hisabche/api` (axios client + TanStack Query hooks, platform-agnostic storage adapter),
  `@hisabche/validation` (Zod), `@hisabche/auth-core` (session/roles/permissions),
  `@hisabche/i18n` (fa-IR / fa-AF / en), `@hisabche/db-schema` (Drizzle pg schema + types),
  `@hisabche/ui` (Radix + Tailwind + shadcn), `@hisabche/store` (Zustand).

## Reusable as-is

| Package | Desktop use |
|---|---|
| `@hisabche/api` | All server calls. Storage adapter registered with a desktop keychain implementation. |
| `@hisabche/validation` | Every form and every sync payload. |
| `@hisabche/auth-core` | Session model, `SessionStore` contract, capability checks. |
| `@hisabche/i18n` | Locale bundles; desktop adds a `desktop` namespace. |
| `@hisabche/ui` styles | `globals.css` tokens + `tailwind.config` — imported directly. |
| `@hisabche/db-schema` types | Row types mirrored into the local SQLite schema. |

## Partially reusable

`@hisabche/ui` **components**: 29 of 185 files import `next/*`. Desktop aliases `next/link`,
`next/navigation` and `next/image` to thin shims in `vite.config.ts`, so leaf components work.
Desktop-specific shells (sidebar, dense tables, toolbars, command palette) are built locally —
mobile/web layouts are deliberately not copied.

## Desktop plan

- **Stack**: Electron + electron-vite + React 19 + TypeScript strict. No Next.js.
- **Process split**: `electron/main` (windows, SQLite, printing, updater, secure storage),
  `electron/preload` (contextBridge, one validated channel per capability),
  `src/` (renderer, zero Node access).
- **Security**: `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`,
  every IPC payload parsed with Zod in main before it touches the database.
- **Local DB**: better-sqlite3 in main. Tables mirror the server: product, customer, invoice,
  invoice_item, transaction, inventory_movement, employee, plus `sync_queue`.
- **Sync**: pull (server → SQLite, cursor by `updated_at`) and push (SQLite `sync_queue` → server,
  idempotency key per row). Same queue shape as the mobile outbox so the two can converge.
- **Native**: ESC/POS thermal + A4 via `webContents.print`, USB scanners as keyboard input,
  CSV/Excel import, PDF/Excel export.

## Risks

1. **react 19 vs peers** — root pins react 19 while RN 0.74 peers 18; installs need
   `--legacy-peer-deps`. Same flag applies to desktop.
2. **better-sqlite3 is native** — needs `electron-rebuild` per Electron version; CI must build on
   each target OS. Falls back to a no-op cache if the binding fails to load.
3. **`@hisabche/ui` coupling to Next** — the alias shims cover routing/image only. A component that
   reaches for Next data APIs must be reimplemented locally rather than patched upstream.
4. **Sync conflicts** — server wins on pull; local rows keep `dirty` so a push is never lost.
   Permanent 4xx rejections park the row for manual resolution instead of retrying forever.
5. **Code signing** — Windows/macOS release requires certificates in CI secrets; unsigned builds
   are produced until those exist.
