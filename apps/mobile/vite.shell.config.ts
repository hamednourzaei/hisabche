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
export default defineConfig(
  shellRendererConfig({ outDir: resolve(here, 'assets/shell'), singleFile: true }),
)
