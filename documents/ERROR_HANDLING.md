# Hisabche — Error Handling

> Contracts for surfacing failures consistently across backend (HTTP) and
> Electron (IPC) so every client — web, desktop, mobile — can map to a
> typed error and recover. Companion: `ApiError` shape in
> `packages/api/src/lib/client.ts`; `AUTH_AND_PERMISSION.md` for auth
> failures.

## 1. Backend (HTTP)

### Error classes (`backend/src/errors/`)

| Class               | Status | BaseError statusCode | Notes                                |
| ------------------- | ------ | -------------------- | ------------------------------------ |
| `AuthError`         | 401    | 401                  | Bad/missing credentials              |
| `TokenExpiredError` | 401    | 401                  | Expired JWT                          |
| `ForbiddenError`    | 403    | 403                  | Role/capability denied               |
| `NotFoundError`     | 404    | 404                  | `resource not found`                 |
| `ConflictError`     | 409    | 409                  | Duplicate (e.g. slug)                |
| `DatabaseError`     | 500    | 500                  | Holds `originalError`                |
| `BaseError` (root)  | —      | —                    | `statusCode`, `isOperational`, stack |

### Response shape (success)

```
{ data, message?, status }
```

### Failure response

```
{ message: string, code: string, status: number, details?: Record<string,string[]> }
```

- Zod validation failures (`z.ZodError`) → **400** (`details` per-field if
  emitted).
- Unexpected 500s are logged (server.log.error) and the response is
  sanitized (no stack/DB internals leaked).

## 2. Electron IPC — the desktop contract

### The `handle()` wrapper (source of truth)

`apps/desktop/electron/main/ipc/register.ts`:

```ts
handle(channel, schema, handler) {
  ipcMain.handle(channel, async (event, raw) => {
    try {
      return await handler(schema.parse(raw), event)   // Zod parse FIRST
    } catch (error) {
      console.error(`[ipc] ${channel} rejected:`, error)
      throw new Error(`IPC_REJECTED:${channel}`)       // TYPED, minimal
    }
  })
}
```

**Rules encoded in code:**

- Every handler **parses the payload with its Zod schema before acting**
  (`ipc-contract.ts`). A handler never trusts renderer input.
- All sensitive operations go through `authenticate` / `authorize`
  middleware (`UNAUTHORIZED:…`, `FORBIDDEN: …permission`) before the
  handler body.
- Any thrown error (parse fail, DB fail, unapproved channel) is rethrown as
  `IPC_REJECTED:<channel>` — a compact, greppable token, not a raw stack
  leak to the renderer.

### Renderer-side

The preload exposes a promise-based API; a rejected `ipcMain.handle`
fails the promise with the `IPC_REJECTED:<channel>` string. The renderer
**must not** treat it as a normal value — it should surface a localized,
non-fatal message and/or trigger session refresh on `UNAUTHORIZED`.

### Standard IPC error codes (canonical surface)

Use these across all `ipcMain.handle` so the renderer (and future webview
tests) can switch on a stable value:

```
AUTH_REQUIRED        // no valid session (UNAUTHORIZED)
PERMISSION_DENIED    // authorize(capability) failed (FORBIDDEN)
VALIDATION_FAILED    // schema.parse failed
STORAGE_FAILED       // local SQLite / secure-store I/O error
SYNC_FAILED          // sync queue / pull / push error
```

Current implementation throws free-form strings
(`UNAUTHORIZED: …`, `FORBIDDEN: …`, `IPC_REJECTED:<channel>`).
**Gap:** a formalized `IpcError` class with the codes above is the target
contract (see AI_RULES / API_REFERENCE docs-first practice — implement
before expanding IPC surface).

## 3. Where each platform maps errors

### Web (Next.js)

- API client (`@hisabche/api`) normalizes to `ApiError`
  `{ message, code, status, details? }`.
- React Query hooks surface them; 401 triggers
  `setOnUnauthorized` → logout.
- Zod form errors shown per-field (react-hook-form).

### Desktop

- HTTP: same `ApiError` via `@hisabche/api`.
- IPC: map `IPC_REJECTED:<channel>` / `UNAUTHORIZED:` /
  `FORBIDDEN:` → user-facing message; 401 → re-auth.

### Mobile

- HTTP `ApiError`; local offline queue failures surface via
  `sync_queue.last_error` in the sync UI.

## 5. Testing (see TESTING_STRATEGY.md)

- `apps/desktop/electron/shared/__tests__/ipc-contract.test.ts` verifies
  channel/schema parity (the exact harness for cross-main/preload drift).
- Add: an IPC test asserting a bad payload → `IPC_REJECTED:<channel>`
  and 401 → `UNAUTHORIZED`.
- Backend tests via supertest asserting 400/401/403/404 shapes.

## 6. Anti-patterns (forbidden)

- Throwing raw `Error` with the DB/stack detail over IPC.
- `console.error` without a typed channel context (keep greppable).
- Swallowing `catch {}` in the renderer without surfacing state.
- Using `any` in error mappers (breaks `ApiError` typing).

## Gap list (to implement)

- Typed `IpcError` class + `IPC_ERROR_CODES` enum not yet in code.
- Backend global error handler emitting the exact envelope shape not yet
  verified (`BaseError` exists; Fastify error response mapping is scattered
  per-route).
