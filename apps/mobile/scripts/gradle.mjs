// ============================================
// Run a Gradle task, on whichever shell is in front of you.
//
// ⚠️ `./gradlew` IS NOT A COMMAND ON WINDOWS.
//
// `cd android && ./gradlew assembleDebug` works in bash and fails in cmd.exe
// with `'.' is not recognized as an internal or external command` — and the
// npm script that contained it therefore only worked for whoever wrote it.
// Windows needs `gradlew.bat`, and the leading `./` has to go.
//
// Node knows which platform it is on, so the script asks rather than assuming.
// ============================================

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const androidDir = resolve(here, '..', 'android')

const task = process.argv[2]
if (!task) {
  console.error('usage: node scripts/gradle.mjs <task>   e.g. assembleDebug')
  process.exit(1)
}

if (!existsSync(androidDir)) {
  console.error(
    `[gradle] no android/ directory.\n` +
      `Run \`npx expo prebuild --platform android\` first — it generates the native project.`,
  )
  process.exit(1)
}

// ⚠️ The UI has to be in the APK, and it is not Gradle's job to notice that it
// is missing. An APK built without `build:shell` opens to
// SHELL_MISSING_FROM_APK, which reads like a broken app rather than a missing
// build step.
const shell = join(androidDir, 'app/src/main/assets/shell/index.html')
if (!existsSync(shell)) {
  console.error(
    `[gradle] the shared UI is not built.\n` +
      `Run \`pnpm run build:shell\` first, or use \`pnpm run android:debug\`, which does both.`,
  )
  process.exit(1)
}

// ⚠️ AN ABSOLUTE PATH, NOT A NAME.
//
// `spawnSync('gradlew.bat', …, { cwd, shell: true })` fails with
// `'gradlew.bat' is not recognized` — under a shell, cmd.exe resolves the
// command against PATH, not against `cwd`, so the wrapper sitting right there
// is invisible. Quoted because the repository path may contain spaces.
const wrapper = join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')

const result = spawnSync(`"${wrapper}"`, [task], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
