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
// ⚠️ AND THE THREE THINGS GRADLE NEEDS ARE ALL FOUND BY SEARCHING.
//
// A local Android build needs a JDK Gradle can read, an Android SDK, and the
// built UI. Each one is discovered rather than declared, so each one can come
// up missing — and each failure names something other than what is wrong:
//
//   Java 25         → «Unsupported class file major version 69»
//   no SDK path     → «SDK location not found»
//   no shell build  → an APK that opens on SHELL_MISSING_FROM_APK
//
// None of those sentences contains the word that would let you fix it. So
// this script finds all three itself, and when it genuinely cannot, it says
// which one and what to do about it — before Gradle spends four minutes
// getting to the same place less clearly.
// ============================================

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
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

// ══════════════════════════════════════════════════════════════════════════
// The JDK.
//
// ⚠️ GRADLE 8.8 CANNOT READ JAVA 25's CLASS FILES, AND SAYS SO IN NUMBERS.
//
// `Unsupported class file major version 69` names neither Java nor a version
// anybody recognises, and sends people looking at their project instead of at
// `JAVA_HOME`. Android Gradle Plugin 8.x wants JDK 17 — the same one EAS
// builds with.
//
// `JAVA_HOME` is not consulted first on purpose: this machine had it pointing
// at JDK 25 while `java` on PATH resolved to a 1.8 shim, so BOTH of the
// obvious places to look held an unusable answer. Whatever is found here is
// handed to Gradle explicitly rather than left to the shell.
// ══════════════════════════════════════════════════════════════════════════

/** Gradle 8.8 runs on these; anything newer is a class-file version it refuses. */
const USABLE = [17, 21]

function javaMajorOf(home) {
  // ⚠️ QUOTED. `C:\Program Files\...\bin\java` under `shell: true` is read as
  // the command `C:\Program` with `Files\...` as an argument, so the probe
  // fails for every JDK on the machine — and the script then reports that no
  // JDK exists while three are installed. A wrong answer delivered
  // confidently is worse than the error it replaced.
  const probe = spawnSync(`"${join(home, 'bin', 'java')}"`, ['-version'], {
    encoding: 'utf8',
    shell: true,
  })
  const text = `${probe.stderr ?? ''}${probe.stdout ?? ''}`
  // `openjdk version "17.0.20"` and `java version "1.8.0_503"` both appear.
  const match = /version "(\d+)(?:\.(\d+))?/.exec(text)
  if (!match) return null
  const first = Number(match[1])
  return first === 1 ? Number(match[2]) : first
}

/** Everywhere a JDK plausibly lives on this platform, JAVA_HOME included. */
function candidateJdks() {
  const found = []
  if (process.env.JAVA_HOME) found.push(process.env.JAVA_HOME.replace(/[\\/]$/, ''))

  const roots =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Eclipse Adoptium',
          'C:\\Program Files\\Java',
          'C:\\Program Files\\Microsoft\\jdk',
          'C:\\Program Files\\Zulu',
        ]
      : ['/usr/lib/jvm', '/Library/Java/JavaVirtualMachines']

  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root)) {
      const home = join(root, entry)
      // macOS nests the real home one level down.
      const inner = join(home, 'Contents', 'Home')
      found.push(existsSync(inner) ? inner : home)
    }
  }

  // Android Studio ships its own runtime. It is a fallback, not a first
  // choice: which version it bundles changes with the IDE, not with us.
  const studio =
    process.platform === 'win32'
      ? 'C:\\Program Files\\Android\\Android Studio\\jbr'
      : '/Applications/Android Studio.app/Contents/jbr/Contents/Home'
  if (existsSync(studio)) found.push(studio)

  return [...new Set(found)]
}

function findJdk() {
  const seen = []
  for (const home of candidateJdks()) {
    if (!existsSync(join(androidDir, '..')) || !existsSync(home)) continue
    const major = javaMajorOf(home)
    if (major === null) continue
    seen.push(`${major} at ${home}`)
    if (USABLE.includes(major)) return { home, major }
  }
  return { home: null, seen }
}

const jdk = findJdk()
if (!jdk.home) {
  console.error(
    `[gradle] no JDK ${USABLE.join(' or ')} on this machine.\n\n` +
      `Gradle 8.8 supports up to Java 22 and Android Gradle Plugin 8.x wants JDK 17.\n` +
      (jdk.seen.length > 0
        ? `What is installed: ${jdk.seen.join(', ')}\n\n`
        : `No JDK was found at all.\n\n`) +
      `Install one, then run this again — nothing else needs changing:\n` +
      `  winget install EclipseAdoptium.Temurin.17.JDK`,
  )
  process.exit(1)
}

// ══════════════════════════════════════════════════════════════════════════
// The Android SDK.
//
// ⚠️ `local.properties` IS MACHINE-SPECIFIC AND THEREFORE NOT IN GIT.
//
// Which means it does not exist on a machine that has never opened this
// project in Android Studio, and Gradle stops with «SDK location not found» —
// a sentence that does not mention the file it wants. Android Studio installs
// the SDK in one predictable place, so write the file rather than ask for it.
// ══════════════════════════════════════════════════════════════════════════

function findAndroidSdk() {
  const declared = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
  if (declared && existsSync(declared)) return declared

  const usual =
    process.platform === 'win32'
      ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
      : process.platform === 'darwin'
        ? join(process.env.HOME ?? '', 'Library', 'Android', 'sdk')
        : join(process.env.HOME ?? '', 'Android', 'Sdk')

  return existsSync(usual) ? usual : null
}

const sdk = findAndroidSdk()
if (!sdk) {
  console.error(
    `[gradle] no Android SDK.\n\n` +
      `Install it through Android Studio (SDK Manager), or set ANDROID_HOME to\n` +
      `an existing SDK directory and run again.`,
  )
  process.exit(1)
}

const localProperties = join(androidDir, 'local.properties')
if (!existsSync(localProperties)) {
  // Backslashes are an escape character in a .properties file: an unescaped
  // Windows path silently becomes a different path.
  writeFileSync(localProperties, `sdk.dir=${sdk.replace(/\\/g, '\\\\')}\n`)
  console.log(`[gradle] wrote android/local.properties → ${sdk}`)
}

console.log(`[gradle] JDK ${jdk.major} — ${jdk.home}`)

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
  // Passed explicitly so the build does not depend on what this shell happens
  // to have exported — which is exactly what made the failure confusing.
  env: { ...process.env, JAVA_HOME: jdk.home, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
})

process.exit(result.status ?? 1)
