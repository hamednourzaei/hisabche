// ============================================
// The mobile host's build of the shared UI.
//
// ⚠️ THIS FILE DECIDES NOTHING ABOUT THE UI.
//
// Every alias, plugin and entry point comes from `@hisabche/app-shell`, the
// same declaration Electron uses. If this file ever starts configuring the UI
// itself, the two hosts have begun rendering one source two ways — which is
// the three-UI problem this whole migration exists to end.
//
// Android serves the result from `file:///android_asset/...`, so the assets
// have to be referenced relatively; `base: './'` is the shell's default for
// exactly that reason and is not repeated here.
//
// ⚠️ .mjs, NOT .ts. Vite hands its config to Node, and whether Node can read
// TypeScript depends on its version: 22.22 strips types, the 22.13 pinned for
// the EAS build machine does not. As `.ts` this file built here and died in
// `eas-build-post-install` with `SyntaxError: Unexpected token {`.
// ============================================

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { defineConfig } from 'vite'
import { shellRendererConfig } from '@hisabche/app-shell/vite.shell'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Bundled INTO the app, not fetched.
 *
 * A WebView pointed at hisabche.com would be a browser with an app icon: no
 * app at all without a connection, and the offline outbox — the one thing the
 * mobile app exists for — would have nothing to render.
 */
/**
 * ⚠️ BUILT STRAIGHT INTO THE NATIVE ASSETS FOLDER.
 *
 * Android serves anything under `android/app/src/main/assets` at
 * `file:///android_asset/…` — a real path, with a real extension, so the
 * WebView infers `text/html` and renders the page.
 *
 * The previous output went through `expo-asset`, which packs files into the
 * APK under a HASHED NAME WITH NO EXTENSION. The WebView had nothing to infer
 * a MIME type from, fell back to `text/plain`, and displayed the app's
 * minified JavaScript as visible text — a screen full of source code, which
 * is exactly what the emulator showed.
 *
 * Going through the native folder removes the guessing entirely: no asset
 * registry, no copy at runtime, no hash — and it still works with no network,
 * which is the whole point of shipping the UI inside the app.
 */
export default defineConfig(
  shellRendererConfig({
    outDir: resolve(here, 'android/app/src/main/assets/shell'),
    singleFile: true,
  }),
)
