# Hisabche — System Design

## High Level Architecture

Monorepo (pnpm workspaces + Turborepo) with four deployable targets and a
stack of shared packages:

```
hisabche/
├── apps/
│   ├── web/        Next.js 16 web app (App Router, [lang] i18n)
│   ├── desktop/    Electron 31 desktop app (React + Vite renderer)
│   └── mobile/     Expo / React Native app (iOS + Android)
├── backend/        Fastify 5 API server (TS)
├── packages/
│   ├── auth-core/  Session/persistence contract + role→capability rules
│   ├── auth/       Auth adapters (Supabase client wrappers)
│   ├── api/        Typed API client, hooks, storage, Supabase realtime
│   ├── store/      Zustand stores (auth, cart, currency, sync, workspace…)
│   ├── sync/       HSB binary wire + wake-up stream client (server + clients)
│   ├── app-shell/  desktop/mobile shell and the sync engine
│   ├── db-schema/  Drizzle shared schema (subset used by desktop)
│   ├── validation/ Zod schemas (login, signup, forgot/reset password…)
│   ├── ui/         Shared React UI kit (shadcn-style primitives)
│   ├── mobile-ui/  Shared RN UI kit
│   ├── i18n/       Locales + i18n setup
│   ├── offline/    Web/native offline entry points, sync queue
│   ├── config/     Env config
│   └── analytics/  Analytics helpers
```

Turborepo pipeline (`turbo.json`): `build`, `dev`, `lint`, `test`,
`type-check`, `clean`. Each package depends on its own build.

## Frontend

### Web (`apps/web`)

- **Next.js 16 App Router**, routes under `app/[lang]/`.
  i18n locale prefix; `messages/{fa,en,af}`.
- `(dashboard)` route group = authenticated shell; public pages: `login`,
  `signup`, `forgot-password`, `reset-password`, `accept-invite`,
  `public-invoice/[token]`, `public-task/[token]`, `legal/*`, `about`, `contact`.
- Feature pages: `dashboard`, `invoices`, `quick-invoice`, `customers`,
  `crm`, `accounting`, `purchasing`, `warehouse`, `manufacturing`,
  `projects`, `human-resources`, `permissions`, `approvals`,
  `workflow-templates`, `sales-followup`, `activities`, `billing`,
  `settings`, `onboarding`, `sync-center`.
- **State**: Zustand (`@hisabche/store`) for client state (auth, cart,
  workspace, currency, sync, theme, preferences, device, onboarding,
  warehouse, backup); TanStack Query for server state (hooks in
  `@hisabche/api/hooks`).
- **UI**: shared `@hisabche/ui` components (shadcn-style, CVA + clsx +
  tailwind-merge), Tailwind CSS, RTL-ready.
- **Forms**: react-hook-form + zod validation (`@hisabche/validation`).
- **PDF**: `@react-pdf/renderer`, `jspdf`, `html2canvas`.
- **Observability**: Sentry (`@sentry/nextjs`), PostHog (`posthog-js`).

### Desktop (`apps/desktop`)

Electron 31 + Vite renderer.

- **Main process** (`electron/main/`): window management (`window.ts`),
  local SQLite DB (`db/database.ts`, `db/schema.ts`), IPC registration
  (`ipc/register.ts`), services — secure storage (`secure-store.ts`),
  printing (`printing.ts`), file export/import (`files.ts`), updater
  (`updater.ts`), monitoring (`monitoring.ts`).
- **Renderer** (`src/`): React app, feature folders mirroring the web
  features (auth, dashboard, inventory, sales, accounting, crm, settings,
  sync), shadcn-style components in `src/components/ui`, Zustand stores
  (`src/shared/stores`), i18n in `src/shared/i18n`.
- **Preload bridge** (`electron/preload/index.ts`): exposes a typed,
  whitelisted API over `contextBridge`; contract in
  `electron/shared/ipc-contract.ts` — every channel has a Zod payload
  schema validated in main before touching the DB/OS.
- **IPC channels**: `secure:get/set/delete` (Credential Manager / Keychain /
  encrypted file), `db:query`, `db:upsertMany`, `db:enqueue`, `db:queue`,
  `db:resolveQueue`, `print:html`, `print:escpos`, `file:export`,
  `file:import`, `window:control`, `app:info`, `app:checkUpdates`.

## Backend (`backend/`)

- **Fastify 5**, TypeScript, Swagger UI at `/docs`, health at
  `/api/health`, `/live`, `/ready`.
- **Auth**: Supabase (`@supabase/supabase-js`) as identity provider;
  JWT bearer tokens verified by `middleware/auth.middleware.ts`.
- **Validation**: Zod schemas from `@hisabche/validation`,
  `zod-to-json-schema` feeds Swagger.
- **Security**: Arcjet (`middleware/arcjet.ts`), rate limiting
  (`@fastify/rate-limit`), CORS (`@fastify/cors`), compression
  (`@fastify/compress`).
- **Caching**: per-route `cache.middleware.ts` + `cache.service.ts`
  (tiny-lru; the global HTTP cache layer was removed in v2.5).
- **Queues**: BullMQ (`queue.ts`, `queue/pdf-queue.ts`) + Redis
  (`ioredis`); job scheduler plugin + `node-cron` (`scheduler/`).
- **Email**: Resend (`services/email.service.ts`, password-reset service).
- **DB**: Postgres via `postgres` driver + Drizzle ORM
  (`drizzle-schema.ts`), migrations in `backend/drizzle/migrations/`.
- **PDF**: `@react-pdf/renderer` for server-side PDF generation.
- **Routes** (all under `/api`): auth, invoice, invoice-public,
  invoice-pdf, customer, product, transaction, accounting, analytics,
  permission, workspace, sync, crm, manufacturing, purchasing, workflow,
  warehouse, project, human-resources, billing, activity, audit,
  notification, event, ai, debug.

## Mobile (`apps/mobile`)

- **Expo 51 / React Native 0.74**, expo-router file-based routing
  (`app/(auth)`, `app/(tabs)`, `app/customers`, `app/inventory`,
  `app/sales`).
- Offline DB: expo-sqlite (`apps/mobile/src/host/local-db.ts`) + outbox (`apps/mobile/src/features/offline/sync-runner.ts`); the outbox pushes, the cursor pulls.
- Secure storage: `expo-secure-store` (session adapter).
- Biometrics (`expo-local-authentication`), camera (`expo-camera`),
  notifications (`expo-notifications`), netinfo for connectivity state.
- i18n via `@hisabche/i18n`; UI via `@hisabche/ui` + `@hisabche/mobile-ui`.

## Data Flow

```
User action
   │
   ▼
UI (React/RN component)
   │  event handler
   ▼
State Layer (Zustand store or React Query)
   │
   ├── online ──► API client (@hisabche/api) ──► Fastify backend ──► Supabase ──► Postgres
   │                 (Bearer JWT)                  (Zod validation,     (RLS + workspace/user
   │                                                 rate limit,           filters)
   │                                                 Arcjet)
   │
   └── offline ──► Local DB (SQLite: better-sqlite3 / expo-sqlite, outbox)
                        │   enqueue
                        └──► sync worker ──► /api/sync/push (when online)
                                              /api/sync/pull (incremental)
```

Desktop variant: renderer → IPC (typed, Zod-validated) → main process →
local SQLite; secure credentials via OS credential store; network calls
done by main or a fetcher in renderer with token from the credential store.

## Offline-First Architecture

### Local Database

- **Web**: no local database — online through the API.
- **Mobile**: expo-sqlite in `apps/mobile/src/host/local-db.ts`.
- **Desktop**: plain SQLite via `better-sqlite3` in main process
  (`apps/desktop/electron/main/db/schema.ts`), tables mirror the server
  tables (product, customer, invoice, invoice_item, transaction,
  inventory_movement, employee) with `updated_at` (incremental pull cursor)
  and `dirty` (pending local change) columns, plus `sync_queue`,
  `sync_cursor`, `meta`.

### Sync Queue

- **Web**: `packages/db/src/sync-queue.ts` — items persisted via Supabase
  `sync_queue` table (user_id, entity_type, entity_id, action, payload,
  status, priority, retryCount, maxRetries), processed in batches of 10,
  statuses pending/processing/completed/failed, UI in web `sync-center`.
- **Desktop**: local `sync_queue` table with attempts/status/last_error;
  `db:enqueue`/`db:resolveQueue` IPC push local rows; incremental pull
  using `sync_cursor.last_pulled_at` per entity.

### Conflict Handling

- Server ids stay the primary key locally, so a pulled row overwrites its
  local copy verbatim (pull is authoritative).
- Local `dirty=1` rows are pushed via the queue; queue rows carry retry
  counts and `last_error` for manual inspection.
- Backend `/api/sync/push` applies creates/updates/deletes per user/workspace.

### Event System

- Backend: `event.routes.ts` + `event.service.ts` + `event-log.service.ts`
  for audit/activity events.
- Realtime: `@hisabche/api` supabase realtime (`packages/api/src/supabase/realtime.ts`),
  web hooks `useRealtime`, `useRealtimeActivities`, `useOfflineActivities`.

## Security Architecture

### Authentication

- Supabase Auth (email/password). Endpoints: `/api/auth/login`,
  `/api/auth/signup`, `/api/auth/forgot-password`, `/api/auth/reset-password`,
  `/api/auth/profile`.
- JWT bearer verified per request (`middleware/auth.middleware.ts`).
- Sessions modeled in `@hisabche/auth-core` (`Session { token, user }`);
  validation helpers `isSession`/`parseSession`; per-platform stores:
  web → localStorage adapter, mobile → expo-secure-store, desktop → OS
  credential store through IPC.

### Authorization

- Role-based ACL in `packages/auth-core/src/permissions.ts`:
  roles `owner(4) > admin(3) > member(2) > viewer(1)`, capabilities
  `record.read` (viewer+), `record.create`/`record.update` (member+),
  `record.delete` (owner), `member.invite` (admin+), `workspace.manage` (owner).
- Multi-tenancy: most tables carry `workspace_id`; the API filters by the
  caller's workspace, plus `user_id` columns for RLS and row-level filtering.

### Token Handling

- Tokens received from the backend are stored in the platform's secure
  store (desktop: Credential Manager/Keychain/encrypted file; mobile:
  Keychain/Keystore via expo-secure-store; web: localStorage).
- Desktop auth store (`apps/desktop/src/features/auth/auth.store.ts`)
  registers a token getter with the API client and handles unauthorized
  (401) by clearing the session; it decodes JWT claims only to fill gaps in
  a `user` payload — the server remains the source of truth.

### Desktop IPC hardening

- Context isolation, preload bridge whitelist, Zod-validated payloads in
  main (`ipc-contract.ts`), writable column allow-lists
  (`WRITABLE_COLUMNS` in `db/schema.ts`) so a compromised renderer cannot
  smuggle unexpected shapes through the bridge.

### Other

- Arcjet bot/abuse protection, rate limiting, CORS, compression.
- Public invoice/task shares are token-scoped (`public-invoice/[token]`).
- Legal/security pages published at `/[lang]/legal/*`.
