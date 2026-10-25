// ============================================
// backend/src/__tests__/helpers/pg-temp-dir.ts
//
// A data directory an embedded Postgres can actually initialise.
//
// ⚠️ WHY THIS EXISTS.
//
// Every *.pg.test.ts used `mkdtempSync(join(tmpdir(), …))`. On this machine
// `initdb` then fails before any test runs:
//
//     initdb: error: could not change permissions of directory
//       "C:/Users/hamed/AppData/Local/Temp/hisabche-pg-…": Permission denied
//
// `initdb` chmods its data directory, and the sandboxed/ACL'd `%TEMP%` refuses
// it. That is why ~80 pg files report a suite failure with every test SKIPPED —
// an environment failure wearing a test failure's clothes, which is exactly the
// kind of red that teaches a team to ignore red.
//
// This helper prefers a directory the runner owns (inside the repo, git-ignored
// via `.pgtest/`), and falls back to the system temp dir only if the workspace
// is not writable. Verified: Postgres starts from `.pgtest/…` on the same
// machine where `%TEMP%` fails.
// ============================================

import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Set `HISABCHE_PG_TMP` to force a location (CI, or a network drive). */
export function pgTempDir(prefix: string): string {
  const forced = process.env.HISABCHE_PG_TMP
  if (forced) {
    mkdirSync(forced, { recursive: true })
    return mkdtempSync(join(forced, prefix))
  }

  // `.pgtest/` at the repo root: inside the project, so the process owns it and
  // `initdb`'s chmod succeeds. Git-ignored.
  const inRepo = join(__dirname, '..', '..', '..', '..', '.pgtest')
  try {
    mkdirSync(inRepo, { recursive: true })
    return mkdtempSync(join(inRepo, prefix))
  } catch {
    // A read-only checkout (some CI images). Fall back, and the caller will see
    // initdb's own error if this environment cannot do it either.
    return mkdtempSync(join(tmpdir(), prefix))
  }
}
