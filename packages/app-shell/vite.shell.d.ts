// ============================================
// The shared build's types.
//
// ⚠️ THE IMPLEMENTATION IS `.mjs` ON PURPOSE — see its header: a TypeScript
// vite config only loads on Node versions that strip types, and the EAS build
// machine's does not. But a host importing it from TypeScript still has to be
// type-checked, and `allowJs` is off across this monorepo.
//
// So the types live here, beside the code, and are the contract both hosts
// compile against. They must stay in step with the JSDoc in `vite.shell.mjs`:
// if this file ever describes something that file does not do, TypeScript will
// cheerfully approve a build that fails on the machine.
// ============================================

import type { UserConfig } from 'vite'

/** What a host contributes to the shared build. */
export interface ShellBuildOptions {
  /** Where the built files go, absolute. */
  outDir: string
  /**
   * How the page references its own assets.
   *
   * ⚠️ Electron and a WebView both load from `file://`, where an absolute
   * `/assets/app.js` means the ROOT OF THE DRIVE and silently 404s. Both hosts
   * use the `'./'` default; only a server-hosted build would pass `'/'`.
   */
  base?: string
  /**
   * Emit ONE self-contained `index.html`, with every script, stylesheet and
   * font inlined.
   *
   * ⚠️ Required when the host ships the UI as a bundler asset: Metro copies
   * only what is imported, so the 45 files a normal build leaves beside the
   * HTML never reach the app and every script 404s in silence.
   */
  singleFile?: boolean
}

/** The absolute path of the shared UI's source root. */
export declare const shellRoot: string

/** The build, declared once and used by every host. */
export declare function shellRendererConfig(options: ShellBuildOptions): UserConfig
