// ============================================
// backend/src/runtime/test-runtime.ts
//
// ONE definition of «this process is a test runner».
//
// ⚠️ WHY THIS FILE EXISTS (V63 · S-2)
//
// The admin guards used to bypass MFA on `process.env.NODE_ENV === 'test'`.
// A production deploy that inherited `NODE_ENV=test` from a copied env file
// would then silently drop platform-admin AAL2 for every operator — the one
// control that stands between a leaked admin session and every customer's
// data. Two middlewares made that decision independently, so they could also
// disagree.
//
// The rule now: a test runtime is true ONLY when
//   (a) the process was launched by Vitest (`VITEST` is set), AND
//   (b) the server was built through `buildServer({ testRuntime: true })`.
//
// A plain `VITEST` in the environment is not enough — a production process
// that somehow inherited it still refuses at startup (see `index.ts`).
// ============================================

let markedTestRuntime = false

/**
 * Called by `buildServer({ testRuntime: true })` only. A test that drives the
 * real application says so explicitly; nothing can flip it back off.
 */
export function markTestRuntime(): void {
  markedTestRuntime = true
}

/** True only for a Vitest process whose server was built as a test runtime. */
export function isTestRuntime(): boolean {
  return markedTestRuntime && Boolean(process.env.VITEST)
}

/** Test-only reset so a unit test can observe both states in one process. */
export function resetTestRuntimeForTesting(): void {
  markedTestRuntime = false
}

/**
 * Refuse to serve in production when any test marker is present.
 *
 * Called from `start()` — the same function that binds the port — so a
 * misconfigured deploy fails loudly instead of answering requests with MFA
 * switched off.
 */
export function assertNoTestMarkersInProduction(
  env: NodeJS.ProcessEnv = process.env,
): { ok: true } | { ok: false; reason: string } {
  if (env.NODE_ENV !== 'production') return { ok: true }
  if (env.VITEST) return { ok: false, reason: 'VITEST is set in a production process' }
  if (markedTestRuntime) return { ok: false, reason: 'the server was built as a test runtime' }
  const rawNodeEnv: string | undefined = env.NODE_ENV
  if (rawNodeEnv === 'test') return { ok: false, reason: 'NODE_ENV=test in a production process' }
  return { ok: true }
}
