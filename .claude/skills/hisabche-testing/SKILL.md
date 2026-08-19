---
name: hisabche-testing
description: Writing tests, running the suite, or deciding what to verify before finishing a change.
---

# Testing

Read `documents/TESTING_STRATEGY.md` for the layer model.

## Runners

| Where                         | Runner | Command          |
| ----------------------------- | ------ | ---------------- |
| `packages/*`, `backend`       | vitest | `npx vitest run` |
| `apps/mobile`, `apps/desktop` | jest   | `npx jest`       |
| everything                    | turbo  | `pnpm test`      |

They differ. **vitest's `expect(value, message)` second argument does not exist
in jest** — collect failures into an array and assert on that instead:

```ts
const missing = LOCALES.flatMap((l) => UNITS.filter((u) => !labels[l][u]).map((u) => `${l}.${u}`))
expect(missing).toEqual([])
```

`react-test-renderer@18` cannot render React 19. Extract pure logic and test
that instead of rendering — see `avatarPresentation` in
`packages/mobile-ui/src/components/avatar.tsx`.

## E2E

Playwright: `apps/web/e2e`, `apps/desktop/e2e` (`pnpm e2e`).
Detox: `apps/mobile/e2e` (`pnpm e2e:android` / `e2e:ios`).

## What deserves a test

Pin behaviour that would be silently wrong, not implementation detail:

- sale vs purchase never collapsing
- a legacy invoice with no type reading as a sale
- quantity, unit and weight staying distinct
- `0` weight versus absent weight
- locale mapping producing Latin digits for English
- a schema refusing a failure with no reason
- partial bulk failure reporting exactly which ids survived

Every real bug gets a regression test. Say in the test _why_ it exists — the
failure it prevents, not what the function does.

## Non-negotiable

Never weaken an assertion, `skip` a test, or delete a failing one to go green.
If a test fails, it is telling you something. Fix the cause.

## Known environment failure

`backend/src/__tests__/api.test.ts` fetches production over the network with a
5s timeout, so it fails offline and the count varies with latency. It is not
caused by your change. Do not "fix" it by deleting it — it needs mocking or a
local server.

## Before finishing

```bash
pnpm type-check     # 16 workspaces
pnpm test
```

Then the builds your change could plausibly break:

```bash
cd apps/web && npx next build
cd apps/desktop && npx electron-vite build
```

After deleting a web route: `rm -rf apps/web/.next/types` first, or type-check
fails on a stale generated file.

## Common mistakes

- vitest's two-argument `expect` in a jest test.
- Rendering components in mobile/desktop tests (React 19 mismatch).
- Testing the implementation rather than the invariant.
- Reporting "tests pass" without running the full suite.
