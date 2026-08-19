---
name: hisabche-debugging
description: Investigating a bug, a failing request, a 500, a crash, or behaviour that does not match expectations. Use before changing code in response to an error.
---

# Debugging

## Method

1. **Reproduce** — get the actual error, status code, stack or log line.
2. **Read around it** — the failing line is often not the cause.
3. **Confirm the cause** before editing. State it in one sentence; if you can't,
   you have not found it.
4. **Smallest fix** at the root.
5. **Regression test** that fails without the fix.
6. **Verify**: targeted test → `pnpm type-check` → `pnpm test` → the affected build.

Never mask an error with a fallback, a try/catch that swallows, or a UI guard
that hides a broken request.

## Cases from this codebase, and what they teach

**A 500 that is really a 404.** Workflow actions returned 500 for "instance not
found" because the service threw `DatabaseError` for client conditions, and the
route mapped everything else to 500. _When a status code looks wrong, check the
error class and the route's catch block._

**A route that could never resolve.** The admin panel redirected to
`/admin/login` while the page was at `/login` — `(admin)` is a Next.js route
group, so the parentheses keep it out of the URL. `next build` prints the real
routes. _Verify the URL a router actually produces._

**A client that lost its privileges.** `42501` on insert while the boot log said
`service_role`: `signInWithPassword` on the shared client had attached a user
session in memory. The tell was that reads succeeded and writes failed. _When
permissions differ between read and write on the same client, suspect the
identity the client is using._

**Text that would not translate.** Keys existed in the code but not in the
catalogue, so `t('key', 'فارسی')` returned the fallback forever. _Check the data
before changing the code._

**A crash from one row.** `Avatar` called `.length` on a name typed `string` but
absent at runtime, taking down the whole list. _Server data is optional whatever
the type says._

**A URL with `%20` in it.** Windows `set VAR=value && cmd` puts the space before
`&&` inside the value. _Print the value, don't assume it._

## Useful probes

```bash
# does this translation key exist?
node -e "const m=require('./packages/i18n/messages/en/common.json');console.log(m.some?.key ?? 'MISSING')"

# what routes does the app actually serve?
cd apps/web && npx next build | grep -E '^[├└]'

# is this module resolvable from mobile?
cd apps/mobile && node -e "console.log(require.resolve('some-package'))"

# what does the endpoint really return?
curl -s -i -X POST http://127.0.0.1:10000/api/... -H 'Content-Type: application/json' -d '{}'
```

## Reporting

Say what the cause was, not just what you changed. If you could not confirm the
cause, say that too and give the evidence you do have — a confident wrong
diagnosis costs more than an honest uncertain one.
