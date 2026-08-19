---
name: hisabche-backend
description: Adding or changing a backend route, service, validation schema, error handling or caching. Use for anything under backend/.
---

# Backend

Fastify + Supabase. `backend/` is a **separate workspace** — install with
`cd backend && pnpm install`.

Read `documents/API_REFERENCE.md` first. It is **docs-first**: update the
contract before writing a new route.

## Layers

```
backend/src/routes/     HTTP: parse, validate, map errors to status codes
backend/src/services/   business logic — the only place it lives
backend/src/middleware/ authenticate, platformAdminGuard, cache
backend/src/db.ts       the shared service_role Supabase client
backend/src/errors/     BaseError + DatabaseError/NotFound/Conflict/Validation
```

Routes stay thin. **Reuse the service** — never reimplement logic that a service
already owns.

## Route shape

```ts
fastify.post(
  '/api/things',
  {
    preHandler: [authenticate],
    schema: { body: toJsonSchema(createThingSchema) },
  },
  async (request, reply) => {
    try {
      const data = createThingSchema.parse(request.body)
      const result = await service.create(request.userId, data)
      await clearCache('things:*')
      return reply.code(201).send(result)
    } catch (e) {
      if (e instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation', details: e.errors })
      }
      fastify.log.error(e)
      if (e instanceof BaseError && e.isOperational) {
        return reply.code(e.statusCode).send({ error: e.message })
      }
      return reply.code(500).send({ error: 'Failed' })
    }
  },
)
```

The `isOperational` branch matters — without it, actionable messages ("run this
migration", "you cannot suspend your own account") reach the user as a bare 500.

## Validation

Schemas live in `packages/validation`, shared with the clients. Never define a
request shape inline in the backend.

**`.omit()` does not exist on a schema that has `.refine()`.** When a body needs
cross-field rules and the URL supplies another field, define the body schema
separately — see `createMemberDirectBodySchema` and the derived
`CreateMemberDirect` type.

## Errors

`BaseError(message, statusCode, isOperational)`. Pick the honest one:

| Situation                    | Error             |
| ---------------------------- | ----------------- |
| row absent / deleted         | `NotFoundError`   |
| wrong state for the action   | `ConflictError`   |
| broke a business rule        | `ValidationError` |
| lacks permission             | `ForbiddenError`  |
| the database actually failed | `DatabaseError`   |

Throwing `DatabaseError` for client conditions is why stale approval buttons
returned 500.

## Migration tolerance

Columns added by a `docs/*.sql` migration may not exist yet in production.
Follow the existing pattern: catch Postgres `42703` (undefined_column), retry
without the column, and tell the caller precisely what is missing rather than
succeeding silently.

## Cache

`cacheMiddleware({ ttl, keyPrefix })` on reads; `clearCache('prefix:*')` after
writes. Redis with an in-memory fallback — the fallback is normal in dev and
must never be treated as an error.

## Validation commands

```bash
cd backend && npx tsc --noEmit && npx vitest run
```

## Common mistakes

- Business logic in a route instead of a service.
- Inline request schema instead of `packages/validation`.
- `.omit()` on a refined schema.
- Swallowing an operational error message.
- `signInWithPassword` on the shared client — see the `hisabche-auth` skill.
- Forgetting `clearCache` after a write.
