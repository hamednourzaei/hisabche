// ============================================
// ⚠️ THE APK MUST START ON THE ENGINE IT SHIPS.
//
// On 30 Oct 2026 `hermesEnabled` was set to false. Gradle still finished with
// BUILD SUCCESSFUL, every test stayed green, and the release APK closed on
// launch with:
//
//   java.lang.UnsatisfiedLinkError: couldn't find DSO to load: libjscexecutor.so
//
// React Native looked for the JSC engine that the APK does not carry. The
// local engine also relies on Hermes (atob/TextDecoder, lesson 222), and
// hermesc does work on Windows (CLAUDE.md, 6 Oct). Hermes stays on.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const androidRoot = join(__dirname, '..', '..', 'android')

describe('the Android app runs on Hermes', () => {
  it('⚠️ gradle.properties turns Hermes on', () => {
    const props = readFileSync(join(androidRoot, 'gradle.properties'), 'utf8')
    expect(props).toMatch(/^hermesEnabled=trues*$/m)
    expect(props).not.toMatch(/^hermesEnabled=false/m)
  })

  it('app/build.gradle picks the engine from that flag', () => {
    const gradle = readFileSync(join(androidRoot, 'app', 'build.gradle'), 'utf8')
    expect(gradle).toContain('if (hermesEnabled.toBoolean())')
    expect(gradle).toContain('implementation("com.facebook.react:hermes-android")')
  })
})
