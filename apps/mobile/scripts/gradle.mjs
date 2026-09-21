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
// ⚠️ GRADLE 8.8 CANNOT READ JAVA 25's CLASS FILES.
//
// It fails with `Unsupported class file major version 69` — a message that
// names neither Java nor the version anybody has installed, and sends people
// looking at their project instead of at `JAVA_HOME`.
//
// Android Gradle Plugin 8.x wants JDK 17, which is what EAS uses. Checking
// here turns four minutes of Gradle followed by a cryptic failure into one
// sentence.
const CLASS_FILE_VERSIONS = { 17: 61, 21: 65, 22: 66 }

function javaMajor() {
  const probe = spawnSync('java', ['-version'], { encoding: 'utf8', shell: true })
  const text = `${probe.stderr ?? ''}${probe.stdout ?? ''}`
  // `openjdk version "25.0.3"` and `java version "1.8.0_503"` both appear.
  const match = /version "(\d+)(?:\.(\d+))?/.exec(text)
  if (!match) return null
  const first = Number(match[1])
  return first === 1 ? Number(match[2]) : first
}

const major = javaMajor()
if (major !== null && !(major in CLASS_FILE_VERSIONS)) {
  console.error(
    `[gradle] Java ${major} is not usable with the Gradle version this project pins.\n` +
      `Gradle 8.8 supports up to Java 22, and Android Gradle Plugin 8.x wants JDK 17 —\n` +
      `which is also what EAS builds with.\n\n` +
      `Point JAVA_HOME at a JDK 17 for this shell, then run again:\n` +
      `  set JAVA_HOME=C:\\Program Files\\Eclipse Adoptium\\jdk-17...\n\n` +
      `Or build on EAS instead:\n` +
      `  npx eas-cli build --platform android --profile preview`,
  )
  process.exit(1)
}

const wrapper = join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')

const result = spawnSync(`"${wrapper}"`, [task], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
})

process.exit(result.status ?? 1)
