import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// React, Vite and TypeScript come from the repository's own node_modules (one
// level up). lucide-react is only installed inside packages/ui, so it is
// pointed at there — no install, no download.
const lucide = fileURLToPath(new URL('../packages/ui/node_modules/lucide-react', import.meta.url))

export default defineConfig({
  // This folder, wherever vite is started from.
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {
    alias: { 'lucide-react': lucide },
    dedupe: ['react', 'react-dom'],
  },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  server: { port: 5190, open: false },
  build: { outDir: 'dist', emptyOutDir: true },
})
