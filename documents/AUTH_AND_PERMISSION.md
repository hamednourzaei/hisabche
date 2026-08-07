# Hisabche — Auth & Permission

## Identity Provider

Supabase Auth (email/password). Backend `/api/auth/*` routes talk to
`supabase` (`backend/src/db.ts`) and return JWT sessions. Password-reset
emails go through Resend (`backend/src/services/password-reset.service.ts`).

## Roles (workspace-scoped)

Defined in `packages/auth-core/src/permissions.ts` and mirrored in the web
workspace slice (`packages/store/src/slices/workspace.slice.ts`).

Rank: **owner(4) > admin(3) > member(2) > viewer(1)**

```
owner
 ├── workspace.manage        (delete/rename workspace)
 ├── member.invite
 ├── record.delete
 ├── record.create
 └── record.read

admin
 ├── member.invite
 ├── record.create
 ├── record.update
 └── record.read

member
 ├── record.create
 ├── record.update
 └── record.read

viewer
 └── record.read
```

Capability table:

| Capability         | Min role | Meaning                             |
| ------------------ | -------- | ----------------------------------- |
| `record.read`      | viewer   | View any business record            |
| `record.create`    | member   | Create invoices/products/customers… |
| `record.update`    | member   | Edit records                        |
| `record.delete`    | owner    | Hard-delete records                 |
| `member.invite`    | admin    | Invite users to workspace           |
| `workspace.manage` | owner    | Workspace settings/ownership        |

Enforcement points:

- **Client UI**: `can(role, capability)` / `sessionCan()` from
  `@hisabche/auth-core` hides disallowed actions.
- **Backend**: `authenticate` middleware sets `request.userId` /
  `request.workspaceId`; services check role for destructive ops
  (e.g. `workflow.service.performAction` verifies actor role vs
  `approver_role` → 403).

## Session Contract

`packages/auth-core/src/session.ts`:

```
Session = { token: string, user: { id, email, ... }, workspace?: ... }
SessionStore { read, write, clear }
isSession() / parseSession() — validate persisted payload
```

The store is **adapter-based**: same contract, different backend per
platform.

## Platform Auth Stacks

### Web (Next.js)

```
Browser
  └─ POST /api/auth/login ──► Fastify ──► Supabase Auth (JWT)
        │
        ▼
  session written via createSessionStore(localStorage)  ← auth-core adapter
        │
        ▼
  ApiClient (axios) attaches Bearer token
  React Query hooks consume typed API
```

- Token in `localStorage` (web adapter in `packages/api/src/storage/web`).
- Supabase realtime for live updates (`packages/api/src/supabase/realtime.ts`).

### Desktop (Electron)

```
Renderer (React)
  └─ IPC (typed, Zod-validated) ──► Main process
        │ secure:get/set/delete (secure-store.ts)
        ▼
  OS credential store: Keychain / Windows Credential Manager / encrypted file
        │
        ▼
  auth.store.ts (features/auth) hydrates session from store,
  registerTokenGetter(apiClient) — bearer on every API call,
  validateSession() / refreshToken() on 401 → logout
```

- Secure credential storage is a native capability — renderer never sees
  the raw token except transiently for requests.
- `secure-store.ts` in `apps/desktop/electron/main/services/`.

### Mobile (Expo / React Native)

```
App launch
  └─ expo-secure-store (Keychain/Keystore) — createSessionStore adapter
        ▼
  Session restored → hydrate auth store → performSync()
  Biometrics available via expo-local-authentication (dependency installed)
```

- `expo-secure-store` keeps the JWT off plain AsyncStorage.
- `packages/api/src/storage` — mobile registers a SecureStore adapter.

## Token Handling Rules

- Bearer JWT on every API call; `tokenProvider.ts` singleton supplies the
  current token without circular deps.
- Desktop decodes the JWT payload **only** to fill gaps in a sparse
  `user` object from `/auth/login`; the server remains the source of truth.
- 401 handling: `setOnUnauthorized` → clear session → redirect to login.

## Desktop IPC Hardening (context isolation)

- Preload whitelists channels; main parses every payload with Zod
  (`electron/shared/ipc-contract.ts`) before touching DB/OS.
- Writable column allow-lists (`WRITABLE_COLUMNS`) — renderer cannot smuggle
  unexpected shapes.
- `window:control`, `app:info`, `app:checkUpdates` for window/app lifecycle.

## Backend Enforcement

- JWT verify per request (`auth.middleware.ts`).
- Workspace filter on every query (`workspace_id`); `user_id` columns for
  RLS-style row filtering.
- Arcjet bot/abuse + rate limiting on auth routes.
- CORS via `@fastify/cors`.

## Not Verified from Repository

- Exact Supabase project/keys and JWT expiry (env-only).
- Whether RLS policies exist on `public.*` tables or filtering is purely
  in-application (migrations show no RLS policy DDL — policies may live in
  Supabase dashboard).
- Workspace membership table (members/invites) is Supabase-managed or
  ad-hoc; no Drizzle table found — members are resolved via
  `workspace.service` against Supabase tables (`workspace_members`).
- Onboarding/accept-invite role assignment logic details.
