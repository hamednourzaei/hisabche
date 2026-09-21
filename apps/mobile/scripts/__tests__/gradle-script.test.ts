// ============================================
// ⚠️ THREE THINGS A LOCAL ANDROID BUILD NEEDS, AND EACH ONE FAILS IN
// SOMEBODY ELSE'S WORDS.
//
//   Java 25         → «Unsupported class file major version 69»
//   no SDK path     → «SDK location not found»
//   no shell build  → an APK that opens on SHELL_MISSING_FROM_APK
//
// Not one of those sentences contains the word that would let you fix it.
// Each cost a round trip on this machine, where `JAVA_HOME` pointed at JDK 25
// while `java` on PATH resolved to a 1.8 shim — so both of the obvious places
// to look held an unusable answer.
//
// This is a source assertion because the script's real work is spawning
// Gradle, which a unit test cannot do. What it CAN hold still is the shape:
// that each check exists, and that none of them was quietly dropped when
// somebody simplified the file.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ⚠️ Comments first. Half this file is an explanation of the failure it
// prevents, and a `not.toContain` would otherwise fail on the comment
// describing the very bug it guards.
const source = readFileSync(join(__dirname, '..', 'gradle.mjs'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('the gradle runner finds what Gradle needs', () => {
  it('⚠️ refuses a JDK Gradle cannot read, and accepts 17 or 21', () => {
    // Gradle 8.8 supports up to Java 22; AGP 8.x wants 17. A list that grew a
    // newer entry would put the «major version 69» failure straight back.
    expect(source).toContain('const USABLE = [17, 21]')
  })

  it('⚠️ does not trust JAVA_HOME as the only answer', () => {
    // It was wrong on this machine. The script scans real install roots too.
    expect(source).toContain('candidateJdks')
    expect(source).toMatch(/Eclipse Adoptium/)
  })

  it('⚠️ hands JAVA_HOME to Gradle explicitly', () => {
    // Leaving it to the shell is what made the failure depend on which
    // terminal you happened to open.
    expect(source).toContain('JAVA_HOME: jdk.home')
  })

  it('⚠️ quotes the java path when probing', () => {
    // `C:\Program Files\...\bin\java` under `shell: true` is read as the
    // command `C:\Program`. Every probe failed, and the script then announced
    // that no JDK existed on a machine with three — a wrong answer delivered
    // confidently, which is worse than the error it replaced.
    expect(source).toContain("`\"${join(home, 'bin', 'java')}\"`")
  })

  it('⚠️ writes local.properties rather than demanding it', () => {
    // It is machine-specific, so it is not in git, so it does not exist on a
    // machine that has never opened the project in Android Studio.
    expect(source).toContain('local.properties')
    expect(source).toContain('sdk.dir=')
  })

  it('⚠️ escapes backslashes in the SDK path', () => {
    // A backslash is an escape character in a .properties file: an unescaped
    // Windows path silently becomes a different path.
    expect(source).toContain(String.raw`replace(/\\/g, '\\\\')`)
  })

  it('⚠️ still checks the shell was built', () => {
    // Without it the APK installs, opens, and shows SHELL_MISSING_FROM_APK —
    // which reads like a broken app rather than a skipped build step.
    expect(source).toContain('app/src/main/assets/shell/index.html')
    expect(source).toContain('existsSync(shell)')
  })

  it('⚠️ uses gradlew.bat on Windows, by absolute path', () => {
    // `./gradlew` is not a command in cmd.exe, and a bare `gradlew.bat` is
    // resolved against PATH rather than against cwd.
    expect(source).toContain("process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'")
    expect(source).toContain('join(androidDir,')
  })

  it.each([
    'winget install EclipseAdoptium.Temurin.17.JDK',
    'ANDROID_HOME',
    'pnpm run build:shell',
  ])('every refusal names the fix (%s)', (fix) => {
    // A precondition check that does not say what to do is just an earlier
    // version of the same confusing failure.
    expect(source).toContain(fix)
  })
})
