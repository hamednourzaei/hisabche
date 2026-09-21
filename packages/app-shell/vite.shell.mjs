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
//
// ⚠️ PLAIN JAVASCRIPT ON PURPOSE, AND .mjs ON PURPOSE.
//
// This was `.ts`. Vite loads a config by handing it to Node, and whether Node
// can read TypeScript depends on its VERSION — 22.22 strips types, 22.13 does
// not. The EAS build machine runs the version pinned in `eas.json`, so the
// mobile build died in `eas-build-post-install` with `SyntaxError: Unexpected
// token {` while the identical command succeeded on this laptop.
//
// A build config that only works on some Node versions is a build that only
// works on some machines. The types are kept through JSDoc, so the desktop's
// TypeScript still checks every call site.
// ============================================

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import autoprefixer from 'autoprefixer'
import tailwindcss from 'tailwindcss'

const here = dirname(fileURLToPath(import.meta.url))

export const shellRoot = resolve(here, 'src')
const shims = resolve(shellRoot, 'shims')

/**
 * Remove `crossorigin` from the built HTML.
 *
 * ⚠️ UNDER `file://`, `crossorigin` BLOCKS THE STYLESHEET.
 *
 * Vite adds the attribute so a CDN-hosted build reports useful errors. Both
 * hosts here load from `file://` instead, where the origin is `null`: the
 * stylesheet becomes a CORS request that can never succeed, the browser drops
 * it WITHOUT logging anything, and the app renders — correctly, completely —
 * with no styles at all.
 *
 * What that looks like is not a broken page. It looks like a working page
 * that someone forgot to design: a 1536px logo at its natural size, the
 * navigation as plain text in the corner, and a console reporting «No
 * Issues». That is why this is worth a plugin rather than a note.
 */
function stripCrossorigin() {
  return {
    name: 'hisabche-strip-crossorigin',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue
        file.source = String(file.source).replace(/\s+crossorigin(?==|\s|>)/g, '')
      }
    },
  }
}

/**
 * Folds the built script and stylesheet into `index.html` and drops the
 * originals, so the whole UI is one file.
 *
 * Written here rather than pulled from a plugin package: it is fifteen lines,
 * it runs against the build this file already configures, and a dependency
 * whose job is `readFile` + `replace` is a dependency that can break a build
 * on a version bump.
 */
/** @returns {import('vite').Plugin} */
function inlineEverything() {
  return {
    name: 'hisabche-inline-shell',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (file) => file.type === 'asset' && file.fileName.endsWith('.html'),
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

/**
 * What a host contributes to the shared build.
 *
 * @typedef {object} ShellBuildOptions
 *
 * @property {string} outDir Where the built files go, absolute.
 *
 * @property {string} [base] How the page will reference its own assets.
 *   ⚠️ Electron and a WebView both load from `file://`, where an absolute
 *   `/assets/app.js` means the ROOT OF THE DRIVE and silently 404s. Both hosts
 *   use the './' default; only a server-hosted build would pass '/'.
 *
 * @property {boolean} [singleFile] Emit ONE self-contained `index.html`, with
 *   every script, stylesheet and font inlined.
 *
 *   ⚠️ REQUIRED WHEN THE HOST SHIPS THE UI AS A BUNDLER ASSET. Metro copies
 *   the files it is told to import — nothing else. A normal Vite build puts 45
 *   files beside `index.html`; importing only the HTML shipped the page and
 *   none of its code, so the WebView rendered an empty body and 404'd every
 *   script, silently. Electron has a real filesystem and does not need this.
 */

/**
 * @param {ShellBuildOptions} options
 * @returns {import('vite').UserConfig}
 */
export function shellRendererConfig({ outDir, base = './', singleFile = false }) {
  return {
    root: shellRoot,
    base,

    // ══════════════════════════════════════════════════════════════════════
    // ⚠️ `localhost` IS NOT ONE ADDRESS ON WINDOWS.
    //
    // Vite binds 127.0.0.1 and prints «http://localhost:5173/»; Chromium
    // resolves that name to `::1` first and gets nothing. The dev window
    // then opens on ERR_CONNECTION_REFUSED while the terminal insists the
    // server is running — and before the renderer failure listeners existed
    // it showed as a blank page with an empty console.
    //
    // Binding the literal address makes ELECTRON_RENDERER_URL carry
    // 127.0.0.1, so no name is left for the two stacks to resolve
    // differently.
    // ══════════════════════════════════════════════════════════════════════
    server: { host: '127.0.0.1' },

    // ══════════════════════════════════════════════════════════════════════
    // ⚠️ POSTCSS IS NAMED, NEVER SEARCHED FOR.
    //
    // Vite looks for `postcss.config.*` upward from `root`, and `root` here is
    // `packages/app-shell/src`. The config used to sit in `apps/desktop/`,
    // which is not on that path — so the search quietly found nothing,
    // `@tailwind base/components/utilities` reached the browser as three
    // unknown at-rules, and the app came up with its whole design system
    // present and not one utility class applied. Mobile never had a config at
    // all.
    //
    // Naming both files removes the search, and with it the difference
    // between the two hosts.
    // ══════════════════════════════════════════════════════════════════════
    css: {
      postcss: {
        plugins: [tailwindcss(resolve(here, 'tailwind.config.ts')), autoprefixer()],
      },
    },

    // The canonical UI references brand assets by absolute path
    // (`/logo-icon.png` in DashboardSidebar), which web serves from its
    // `public/`. Without the same directory those requests 404 and the sidebar
    // shows a broken image where the logo belongs.
    publicDir: resolve(shellRoot, 'public'),

    // ⚠️ `stripCrossorigin` runs for BOTH hosts. The mobile build inlines
    // everything so it has no external stylesheet to block — but Electron
    // loads its CSS from a file beside the HTML, and that is the one that
    // silently never arrived.
    plugins: [react(), stripCrossorigin(), ...(singleFile ? [inlineEverything()] : [])],

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
