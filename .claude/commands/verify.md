---
description: Full verification — type-check, tests, and the builds a change could break
---

Run the repository's verification in order and report results honestly.

1. `pnpm type-check` — all 16 workspaces must pass.
2. `pnpm test` — vitest (packages, backend) + jest (mobile, desktop).
3. Only the builds the current change could plausibly break:
   - `packages/ui`, `packages/api`, `packages/store` changed → `cd apps/web && npx next build` **and** `cd apps/desktop && npx electron-vite build`
   - `apps/admin` changed → `cd apps/admin && npx next build`
   - `apps/mobile` changed → `cd apps/mobile && npx tsc --noEmit`

If a web route was deleted, `rm -rf apps/web/.next/types` first — type-check
otherwise fails on a stale generated file.

Report the actual numbers. If something fails, show the output and say whether
it is caused by the current change. `backend/src/__tests__/api.test.ts` fetches
production over the network and fails offline — that one is environmental.
