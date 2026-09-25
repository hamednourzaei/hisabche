// ============================================
// ⚠️ THE RELEASE APK MUST BE ABLE TO BUNDLE ITS OWN ENTRY ON WINDOWS.
//
// `createBundleReleaseJsAndAssets` gets an ABSOLUTE entry from the React
// Native Gradle plugin, and @expo/cli hands it to the resolver as
// `./C:/Users/…/apps/mobile/index.js` — a relative request for a folder named
// `C:`. The release build died with "None of these files exist" while listing
// the file that exists. Debug builds pass a relative entry and never see it,
// so only a release build on Windows could fail.
// ============================================

import { join } from 'node:path'

type ResolveRequest = (
  context: { originModulePath: string; resolveRequest: (c: unknown, name: string) => string },
  moduleName: string,
  platform: string,
) => string

// metro.config.js is CommonJS with no types; the real file, not a copy.
const config = require(join(__dirname, '..', '..', 'metro.config.js')) as {
  resolver: { resolveRequest: ResolveRequest }
}

const onWindows = process.platform === 'win32' ? it : it.skip

describe('metro resolves a drive-letter entry as a file, not a folder named C:', () => {
  const requested: string[] = []
  const context = {
    originModulePath: 'C:\\repo\\apps\\mobile/.',
    resolveRequest: (_c: unknown, name: string) => {
      requested.push(name)
      return name
    },
  }

  beforeEach(() => {
    requested.length = 0
  })

  onWindows('the form @expo/cli actually sends', () => {
    config.resolver.resolveRequest(context, './C:/repo/apps/mobile/index.js', 'android')
    expect(requested).toEqual(['./index.js'])
  })

  onWindows('without the ./ prefix', () => {
    config.resolver.resolveRequest(context, 'C:/repo/apps/mobile/src/app.tsx', 'android')
    expect(requested).toEqual(['./src/app.tsx'])
  })
})
