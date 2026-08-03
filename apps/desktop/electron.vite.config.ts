import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const shims = resolve(__dirname, 'src/shims')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'electron/main/index.ts') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'electron/preload/index.ts') } },
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        // @hisabche/ui components written for Next.js resolve their routing and
        // image imports to desktop shims backed by react-router.
        'next/link': resolve(shims, 'next-link.tsx'),
        'next/navigation': resolve(shims, 'next-navigation.ts'),
        'next/image': resolve(shims, 'next-image.tsx'),
      },
    },
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/index.html') },
      // Feature routes are lazy — keep the initial chunk small for <2s startup.
      chunkSizeWarningLimit: 900,
    },
  },
})
