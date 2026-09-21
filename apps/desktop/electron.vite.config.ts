import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { shellRendererConfig } from '@hisabche/app-shell/vite.shell'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  main: {
    build: {
      target: 'node20',
      outDir: 'out/main',
      rollupOptions: {
        input: resolve(__dirname, 'electron/main/index.ts'),
        output: {
          format: 'cjs',
          entryFileNames: 'index.js',
        },
      },
    },

    plugins: [
      // ⚠️ EVERY WORKSPACE PACKAGE MUST BE BUNDLED IN, NOT EXTERNALISED.
      //
      // `externalizeDepsPlugin` leaves each dependency as a bare `require()`
      // and trusts it to exist in `node_modules` next to the packaged app.
      // That holds for anything published to npm; it does NOT hold for a
      // workspace package, which lives in this repository and is never copied
      // into the installer. The app then starts and dies immediately with:
      //
      //   A JavaScript error occurred in the main process
      //   Cannot find module '@hisabche/app-bridge'
      //
      // …which no test catches, because the failure only exists in the
      // PACKAGED build — `electron-vite dev` resolves it from the workspace
      // and works perfectly.
      //
      // `auth-core` was already excluded for exactly this reason. Adding a
      // second workspace import to main without adding it here is how this
      // came back.
      externalizeDepsPlugin({
        exclude: ['@hisabche/auth-core', '@hisabche/app-bridge'],
      }),
    ],
  },

  preload: {
    build: {
      target: 'node20',
      outDir: 'out/preload',
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload/index.ts'),
        output: {
          format: 'cjs',
          entryFileNames: 'index.js',
        },
      },
    },
    plugins: [
      // ⚠️ SAME RULE AS MAIN. `app-bridge` is a workspace package: left
      // external, the preload dies on `require()` and the renderer comes up
      // with NO BRIDGE AT ALL — which the shared UI reads as «there is no
      // host», i.e. a working-looking app that cannot print, cannot reach the
      // local cache and cannot queue a write.
      externalizeDepsPlugin({
        exclude: ['zod', '@hisabche/app-bridge'],
      }),
    ],
  },

  // ⚠️ THE RENDERER IS NOT THIS APP'S.
  //
  // It is `@hisabche/app-shell` — the same React UI the Android WebView loads
  // — and its build is declared there, so the two hosts cannot drift into two
  // different renderings of one source. Electron contributes the one genuinely
  // host-specific thing: where the output goes.
  renderer: shellRendererConfig({ outDir: resolve(__dirname, 'out/renderer') }),
})
