# Verification log

Date: 26 Oct 2026
Status: IMPLEMENTED_NOT_LIVE_VERIFIED

## After the last code edit

| Command                                                                | Working directory       | Result                                                                                                |
| ---------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm exec vitest run`                                                 | `packages/validation`   | **530 passed / 35 files**                                                                             |
| `pnpm exec vitest run src/__tests__/industry-profile-registry.test.ts` | `packages/ui`           | **3 passed / 1 file**                                                                                 |
| `npx tsc --noEmit`                                                     | `packages/validation`   | passed, no output                                                                                     |
| `npx tsc --noEmit`                                                     | `packages/ui`           | passed, no output                                                                                     |
| `npx tsc --noEmit`                                                     | `packages/store`        | passed, no output                                                                                     |
| `npx tsc --noEmit`                                                     | `packages/app-shell`    | passed, no output                                                                                     |
| `npx tsc --noEmit`                                                     | `apps/web`              | passed, no output                                                                                     |
| `npx tsc --noEmit`                                                     | `apps/desktop`          | passed, no output                                                                                     |
| `npx tsc --noEmit`                                                     | `apps/mobile`           | passed, no output                                                                                     |
| `node check-json.cjs` (temporary)                                      | repo root               | `fa: OK`, `af: OK`, `en: OK`                                                                          |
| `node check-keys.cjs` (temporary)                                      | repo root               | `ALL_KEYS_PRESENT` for all new keys in all three locales                                              |
| `npx eslint` on every changed TS/TSX file                              | validation / ui / store | **0 errors** (warnings only: pre-existing unused `Select*`/`UNIT_OPTIONS` in `add-product-modal.tsx`) |

## Targeted evidence

| Command                                                                                             | Result              |
| --------------------------------------------------------------------------------------------------- | ------------------- |
| `pnpm exec vitest run industry-profiles.test.ts measurement.test.ts industry-profile-guard.test.ts` | 35 passed / 3 files |

## Red-then-green

- `measurement.test.ts` empty measured line was **red** (`33000000` vs `0`) before `rowQuantity`
  became unit-aware; green after.
- The AST guard was injection-tested: a temporary `packages/ui/src/__industry-guard-injection.ts`
  containing `businessType === 'jewellery'` turned the guard **red** naming that file and line;
  the file was deleted and the guard returned **green**.

## Final round (26 Oct 2026, after the last edit)

| Command                                                                 | Working directory     | Result                        |
| ----------------------------------------------------------------------- | --------------------- | ----------------------------- |
| `pnpm exec vitest run`                                                  | `packages/validation` | **535 passed / 36 files**     |
| `pnpm exec vitest run` (4 industry files)                               | `packages/validation` | **40 passed / 4 files**       |
| `pnpm exec vitest run src/__tests__/industry-profile-registry.test.ts`  | `packages/ui`         | **3 passed / 1 file**         |
| `pnpm exec vitest run src/__tests__/invoice-line-total-derived.test.ts` | `backend`             | **9 passed / 1 file**         |
| `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit`               | `backend`             | **passed, no output**         |
| `node scripts/industry/generate-industry-diff.mjs --check`              | repo root             | `OK: … matches the registry.` |

The earlier backend error
`warehouse-summary.domain.ts(61,25): Property 'category' does not exist on type 'WarehouseProduct'`
was a real contract mismatch: the mapper wrote `category`, the shared interface did not declare it.
`packages/validation/src/schemas/warehouse-overview.ts` now declares `category: string`; the backend
TypeScript check above is the proof.

## Not run / blocked

- `invoice-write-document.pg.test.ts` — 20 tests skipped: embedded Postgres failed with
  `could not create shared memory segment: error code 1314` (environment), after the earlier
  `initdb: could not change permissions` failure.
- Full `packages/ui` suite was not re-run; only the industry registry parity test was run.
- No build (`next build`, electron-builder, Gradle) was run.
- No live database, no live Electron/Hermes inspection, no production verification.
- Offline industry persistence, Settings industry editing and dashboard ordering remain
  unimplemented/blocked — see `FINAL-RESULTS.md` §2.
