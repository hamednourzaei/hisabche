import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

// React, Vite and TypeScript come from the repository's own node_modules (one
// level up). lucide-react is only installed inside packages/ui, so it is
// pointed at there — no install, no download.
const lucide = fileURLToPath(new URL('../packages/ui/node_modules/lucide-react', import.meta.url))
const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * The preview's sound files, served as plain bytes.
 *
 * ⚠️ A download manager's browser extension (IDM on the owner's machine)
 * grabs every response that LOOKS like media — a URL ending in `.ogg` or an
 * `audio/*` content type — and, failing to take it over, opened an error
 * window for each of the ~46 sounds (17 Oct 2026). Here the file name travels
 * in the query and the body is `application/octet-stream`; Web Audio's
 * `decodeAudioData` decodes it the same. Only files inside `assets/` are
 * served — the path is resolved and checked, so `..` cannot escape.
 */
function soundData(): Plugin {
  const assets = path.join(root, 'assets')
  return {
    name: 'hisabche-sound-data',
    configureServer(server) {
      server.middlewares.use('/sound-data', async (req, res) => {
        const name = new URL(req.url ?? '', 'http://local').searchParams.get('f') ?? ''
        const file = path.resolve(assets, name)
        if (!name || !file.startsWith(assets + path.sep) || !/\.(ogg|mp3|wav)$/i.test(file)) {
          res.statusCode = 404
          res.end()
          return
        }
        try {
          const body = await readFile(file)
          res.setHeader('Content-Type', 'application/octet-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(body)
        } catch {
          res.statusCode = 404
          res.end()
        }
      })
    },
  }
}

export default defineConfig({
  // This folder, wherever vite is started from.
  root,
  plugins: [soundData()],
  resolve: {
    alias: { 'lucide-react': lucide },
    dedupe: ['react', 'react-dom'],
  },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  server: { port: 5190, open: false },
  build: { outDir: 'dist', emptyOutDir: true },
})
