// ============================================
// backend/src/__tests__/helpers/pg-binaries.ts
//
// Where the `*.pg.test.ts` suites find their Postgres, and what to say when this
// machine cannot run it.
//
// ⚠️ WHY THIS EXISTS — TWO DIFFERENT REDS, BOTH OF THEM ENVIRONMENTAL.
//
// 1. MISSING EXECUTABLES. `embedded-postgres` spawns `initdb` out of its platform
//    package. In this workspace that package was once installed without its
//    executables — `native/bin` held 29 files, all DLLs, not one `.exe` — so the
//    spawn never came up and every pg file waited out the file timeout and closed
//    with «all tests skipped».
//
// 2. NO PRIVILEGE TO CREATE THE SHARED MEMORY. The executables restored, Postgres
//    still cannot start from an ordinary session on Windows: it maps its shared
//    memory as `Global/PostgreSQL:<data dir>`, and creating a page-file backed
//    section in the global namespace needs SeCreateGlobalPrivilege. Without it
//    `postgres.exe` prints `FATAL: could not create shared memory segment: error
//    code 1314` and exits — but `pg.start()` does not reject, so the file hangs:
//    measured here at 65.7 s for one file (60 s hook timeout in beforeAll, then
//    the same again in afterAll), × 166 pg files ≈ three hours for zero evidence.
//
// Both are environment failures wearing a test failure's clothes. The guards
// below turn each into one line of text in milliseconds and repair nothing: they
// do not download, install, elevate or touch the machine.
//
// They are called from `pg-preflight.setup.ts`, a setup file of the `pg` project
// only, so the unit project pays nothing.
// ============================================

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

/** The three executables `embedded-postgres` resolves for every platform. */
const EXECUTABLES =
  process.platform === 'win32'
    ? ['initdb.exe', 'postgres.exe', 'pg_ctl.exe']
    : ['initdb', 'postgres', 'pg_ctl']

/**
 * Mirrors the switch in `embedded-postgres/dist/binary.js`: the npm package name
 * is not simply `${platform}-${arch}` (win32 publishes as `windows-x64`).
 */
function platformPackageName(): string {
  const os = process.platform === 'win32' ? 'windows' : process.platform
  return `@embedded-postgres/${os}-${process.arch}`
}

/** The directory holding this platform's executables. */
function binaryDirectory(): string {
  const pkg = platformPackageName()
  const resolveFromHere = createRequire(import.meta.url)

  // ⚠️ Resolve from INSIDE `embedded-postgres`, not from this file. With pnpm the
  // platform package is not a dependency of the backend — it sits beside
  // `embedded-postgres` in the store — so a bare resolve from here walks out of
  // the repo and can land on an unrelated copy under `C:\Users\<user>\node_modules`
  // that has nothing to do with the runner. That copy had the executables; the
  // one the suite actually uses did not, and the first version of this guard
  // passed while every pg file still hung.
  const embedded = resolveFromHere.resolve('embedded-postgres')
  const resolveFromEmbedded = createRequire(embedded)

  try {
    // The package's main entry is `dist/index.js`; the binaries sit one level up.
    return resolve(dirname(resolveFromEmbedded.resolve(pkg)), '..', 'native', 'bin')
  } catch {
    throw new Error(
      `Postgres cannot start: the platform package "${pkg}" is not installed beside ` +
        `embedded-postgres (${dirname(embedded)}). Every *.pg.test.ts would wait out the ` +
        'file timeout and then skip every test. Install it (pnpm install) before running ' +
        'the pg project.',
    )
  }
}

/** Throws when an executable `embedded-postgres` spawns is not there. */
export function assertPostgresExecutables(): void {
  const binDirectory = binaryDirectory()
  const missing = EXECUTABLES.filter((name) => !existsSync(join(binDirectory, name)))
  if (missing.length === 0) return

  throw new Error(
    `Postgres cannot start: ${missing.join(', ')} missing from ${binDirectory}. ` +
      `The "${platformPackageName()}" package is installed without its executables — ` +
      'an incomplete install, or an antivirus quarantine of the .exe files. ' +
      'Every *.pg.test.ts would otherwise wait out the file timeout (180–240 s per file) ' +
      'and then report a failure with every test skipped. ' +
      'Repair that package (pnpm install --force) before running the pg project.',
  )
}

/**
 * The question Windows answers for us: can this logon token create a page-file
 * backed mapping in the global namespace? That is the exact operation Postgres
 * performs for its shared memory, so the answer is the same one `postgres.exe`
 * gets — without starting Postgres, which is the part that hangs.
 *
 * A named `Mutex` under `Global\` is NOT a substitute: only file-mapping
 * (section) objects are gated by SeCreateGlobalPrivilege. Measured here, a global
 * mutex succeeds in the very session where a global mapping is refused.
 */
const WINDOWS_PROBE = `
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  'elevated'
  exit 0
}
$name = 'Global\\hisabche-pg-preflight-' + $PID + '-' + [DateTime]::UtcNow.Ticks
try {
  $mapping = [System.IO.MemoryMappedFiles.MemoryMappedFile]::CreateNew($name, 4096)
  $mapping.Dispose()
  'ok'
} catch {
  $inner = $_.Exception
  while ($inner.InnerException) { $inner = $inner.InnerException }
  'refused: ' + $inner.GetType().FullName + ': ' + $inner.Message
}
`

/**
 * The probe's answer, or null when PowerShell itself could not run — which is
 * not evidence that Postgres cannot start, so the caller lets Postgres try.
 */
function windowsStartProbe(): string | null {
  try {
    const answer = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_PROBE],
      { encoding: 'utf8', timeout: 20_000, windowsHide: true },
    )
    return answer.trim()
  } catch {
    return null
  }
}

/** Throws, in milliseconds, when this session cannot start Postgres at all. */
export function assertPostgresCanStart(): void {
  // Only Windows needs the global-namespace privilege; the Linux and macOS suites
  // have never seen either failure.
  if (process.platform !== 'win32') return

  const answer = windowsStartProbe()
  if (answer === null) {
    console.warn(
      '[pg-preflight] Could not run the Windows start probe; letting Postgres try. ' +
        'If every pg file hangs for a minute, the cause is one of the two below.',
    )
    return
  }

  if (answer === 'ok') return

  if (answer === 'elevated') {
    throw new Error(
      'Postgres cannot start: this shell is elevated (an administrator token). ' +
        'Postgres refuses to run that way — "Execution of PostgreSQL by a user with ' +
        'administrative permissions is not permitted" — so every *.pg.test.ts would ' +
        'hang until its hook timeout. Open a normal, non-elevated terminal and run the ' +
        'pg project from there.',
    )
  }

  throw new Error(
    'Postgres cannot start: Windows refused to create a page-file backed section in ' +
      'the global namespace, which is exactly what postgres.exe does for its shared ' +
      `memory (it reports "could not create shared memory segment: error code 1314"). ` +
      `Probe answer — ${answer}. ` +
      'Because the failure happens before the server is ready, pg.start() never ' +
      'rejects: each pg file waits out the 60 s hook timeout and then ~6 s more in ' +
      'afterAll (measured: 65.7 s per file, 166 files, ~3 hours for zero evidence). ' +
      'Grant «Create global objects» (SeCreateGlobalPrivilege) to this account under ' +
      'secpol.msc → Local Policies → User Rights Assignment, then SIGN OUT AND SIGN IN: ' +
      'the privilege is baked into the logon token, so a new terminal window keeps the ' +
      'old one and still fails.',
  )
}
