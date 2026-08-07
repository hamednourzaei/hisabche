import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const shims = resolve(__dirname, 'src/shims')

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

  renderer: {
    root: resolve(__dirname, 'src'),

    plugins: [react()],

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),

        'next/link': resolve(shims, 'next-link.tsx'),

        'next/navigation': resolve(shims, 'next-navigation.ts'),

        'next/image': resolve(shims, 'next-image.tsx'),
      },
    },

    build: {
      outDir: 'out/renderer',

      rollupOptions: {
        input: resolve(__dirname, 'src/index.html'),
      },

      chunkSizeWarningLimit: 900,
    },
  },
})
