// ============================================
// The same built UI, where iOS can find it.
//
// ⚠️ TWO HOSTS, TWO WAYS IN — ONE BUILD.
//
// Android serves `android/app/src/main/assets/shell/index.html` natively at
// `file:///android_asset/…`, so the Vite build writes there and nothing else
// is needed.
//
// iOS has no such folder. Its copy travels through Metro's asset registry,
// which only sees files inside the JS project — so the built file is copied
// to `assets/shell/` as well, purely so `import … from './assets/shell/…'`
// resolves and the file lands in the iOS bundle.
//
// Copying rather than building twice: two Vite runs of a 4.5 MB bundle is two
// chances for the hosts to receive different bytes.
// ============================================

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const built = resolve(here, '../android/app/src/main/assets/shell/index.html')
const forIos = resolve(here, '../assets/shell/index.html')

if (!existsSync(built)) {
  // A missing build is a build that failed — saying so is better than leaving
  // yesterday's copy in place and shipping it.
  console.error(`[shell] not found: ${built}\nDid \`vite build\` run?`)
  process.exit(1)
}

mkdirSync(dirname(forIos), { recursive: true })
copyFileSync(built, forIos)
console.log('[shell] copied to assets/shell/index.html for the iOS bundle')
