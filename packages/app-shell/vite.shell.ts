// ============================================
// The shared UI's build, owned by the UI — not by a host.
//
// ⚠️ ONE UI MEANS ONE BUILD CONFIG TOO.
//
// Electron and the mobile WebView load the exact same bundle, so the aliases
// that make `@hisabche/ui` work outside Next.js (its `next/*` and `next-intl`
// imports) have to be declared in one place. Copied into each host they drift,
// and the two apps then render the same source differently — which is the
// three-UI problem again, one level down.
//
// A host passes only what is genuinely host-specific: where to write the
// build, and the base URL the assets are served from.
// ============================================

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import type { Plugin, UserConfig } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))

export const shellRoot = resolve(here, 'src')
const shims = resolve(shellRoot, 'shims')

/**
 * Folds the built script and stylesheet into `index.html` and drops the
 * originals, so the whole UI is one file.
 *
 * Written here rather than pulled from a plugin package: it is fifteen lines,
 * it runs against the build this file already configures, and a dependency
 * whose job is `readFile` + `replace` is a dependency that can break a build
 * on a version bump.
 */
function inlineEverything(): Plugin {
  return {
    name: 'hisabche-inline-shell',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (file): file is Extract<typeof file, { type: 'asset' }> =>
          file.type === 'asset' && file.fileName.endsWith('.html'),
      )
      if (!html) return

      let source = String(html.source)

      for (const file of Object.values(bundle)) {
        if (file === html) continue

        if (file.type === 'chunk') {
          // `</script>` — a bundle containing the literal characters
          // `</script>` inside a string would otherwise end the tag early and
          // truncate the app at that byte.
          const code = file.code.replace(/<\/script>/gi, '<\\/script>')
          source = source.replace(
            new RegExp(`<script[^>]*src="[^"]*${file.fileName}"[^>]*></script>`),
            `<script type="module">${code}</script>`,
          )
          delete bundle[file.fileName]
          continue
        }

        if (file.fileName.endsWith('.css')) {
          source = source.replace(
            new RegExp(`<link[^>]*href="[^"]*${file.fileName}"[^>]*>`),
            `<style>${String(file.source)}</style>`,
          )
          delete bundle[file.fileName]
        }
      }

      html.source = source
    },
  }
}

export interface ShellBuildOptions {
  /** Where the built files go, absolute. */
  outDir: string
  /**
   * How the page will reference its own assets.
   *
   * ⚠️ Electron and a WebView both load from `file://`, where an absolute
   * `/assets/app.js` means the ROOT OF THE DRIVE and silently 404s. Both hosts
   * pass './'; only a server-hosted build would pass '/'.
   */
  base?: string
  /**
   * Emit ONE self-contained `index.html`, with every script, stylesheet and
   * font inlined.
   *
   * ⚠️ REQUIRED WHEN THE HOST SHIPS THE UI AS A BUNDLER ASSET.
   *
   * Metro copies the files it is told to import — nothing else. A normal Vite
   * build puts 45 files beside `index.html`; importing only the HTML shipped
   * the page and none of its code, so the WebView would render an empty body
   * and 404 every script, silently. Electron has a real filesystem and does
   * not need this.
   */
  singleFile?: boolean
}

export function shellRendererConfig({
  outDir,
  base = './',
  singleFile = false,
}: ShellBuildOptions): UserConfig {
  return {
    root: shellRoot,
    base,

    // The canonical UI references brand assets by absolute path
    // (`/logo-icon.png` in DashboardSidebar), which web serves from its
    // `public/`. Without the same directory those requests 404 and the sidebar
    // shows a broken image where the logo belongs.
    publicDir: resolve(shellRoot, 'public'),

    plugins: [react(), ...(singleFile ? [inlineEverything()] : [])],

    resolve: {
      alias: {
        '@': shellRoot,
        'next/link': resolve(shims, 'next-link.tsx'),
        'next/navigation': resolve(shims, 'next-navigation.ts'),
        'next/image': resolve(shims, 'next-image.tsx'),
        'next/dynamic': resolve(shims, 'next-dynamic.tsx'),
        // `@hisabche/ui` is authored against next-intl; the shim maps it onto
        // the i18next instance so every host reads one message catalog.
        'next-intl': resolve(shims, 'next-intl.tsx'),
      },
    },

    build: {
      outDir,
      emptyOutDir: true,
      // Inlining only works if there is ONE chunk and ONE stylesheet to
      // inline: a lazy route left as a separate file is a file Metro never
      // ships, which is the 404 this flag exists to prevent.
      ...(singleFile
        ? {
            assetsInlineLimit: Number.MAX_SAFE_INTEGER,
            cssCodeSplit: false,
          }
        : {}),
      rollupOptions: {
        input: resolve(shellRoot, 'index.html'),
        ...(singleFile ? { output: { inlineDynamicImports: true } } : {}),
      },
      chunkSizeWarningLimit: 900,
    },
  }
}
