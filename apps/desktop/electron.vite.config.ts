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
      externalizeDepsPlugin({
        exclude: ['@hisabche/auth-core'],
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
      externalizeDepsPlugin({
        exclude: ['zod'],
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
