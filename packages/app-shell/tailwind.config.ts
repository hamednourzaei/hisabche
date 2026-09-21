// ══════════════════════════════════════════════════════════════════════════
// ⚠️ THE TAILWIND CONFIG BELONGS TO THE SHELL, NOT TO A HOST.
//
// It used to live in `apps/desktop/`. Vite searches for PostCSS and Tailwind
// config upward from its `root`, and the shared root is
// `packages/app-shell/src` — a directory that has no path to `apps/desktop`.
// So the search found nothing, `@tailwind utilities` passed through
// untouched, and the app rendered with a full design system and not one
// utility class applied.
//
// The globs are absolute for the same reason: two hosts build this from two
// different working directories.
// ══════════════════════════════════════════════════════════════════════════

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Config } from 'tailwindcss'

import baseConfig from '../ui/tailwind.config'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../..')

const config: Config = {
  ...baseConfig,
  content: [resolve(here, 'src/**/*.{ts,tsx}'), resolve(repo, 'packages/ui/src/**/*.{ts,tsx}')],
}

export default config
