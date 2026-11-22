---
name: hisabche-offline
description: Anything touching offline behaviour, the local write queue, synchronisation, conflict handling, or local persistence on mobile and desktop.
---

# Offline-first

Read `documents/OFFLINE_SYNC.md` before changing sync behaviour.

Shops lose connectivity routinely. Recording a sale must never fail because the
network or our database is unavailable. **Never remove or weaken offline
support to simplify something.**

## Where it lives

```
packages/offline                          shared queue and sync primitives
packages/store/src/slices/                sync + backup client state
apps/mobile/src/features/offline/         outbox, usePendingInvoices
apps/desktop/electron/                    SQLite + IPC local layer
packages/ui/src/components/ui/sync-center shared sync UI
```

## Rules

- A queued write is real to the user. Show it in lists immediately — see how
  `usePendingInvoices` merges the outbox with server results in the mobile
  invoice list.
- A filter applied server-side must also be applied locally to queued items, or
  a pending record disappears when the user filters.
- Never silently drop a record on conflict. Reconcile, and keep enough
  information (timestamp, origin) to explain what happened.
- A queued item needs a stable local id before the server assigns one; list keys
  must tolerate it (`item.id ?? \`pending-${index}\``).
- Sync failures are normal, not exceptional. Report them without treating the
  app as broken.
- Redis being unavailable falls back to an in-memory cache by design — that is
  not an error state.

## Validation

```bash
cd apps/mobile && npx jest src/features/offline
cd apps/desktop && npx jest
```

## Common mistakes

- Filtering server data but not the outbox.
- Assuming a record has a server id.
- Treating "offline" as an error screen rather than a working state.
- Clearing the queue on a failed sync.
