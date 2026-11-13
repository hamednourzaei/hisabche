// scripts/lib/format-markdown.mjs
//
// Generated Markdown is committed through `prettier --write` (the repository
// formats every .md file), so a generator that writes raw template text does
// not reproduce the file it is supposed to own: the next `--check` reports
// STALE for a difference that is only whitespace. Formatting here keeps the
// generator, the committed file and the guard in agreement.
//
// Prettier is already a root devDependency; this adds no package.

import { format, resolveConfig } from 'prettier'

/**
 * Format generated Markdown the way `prettier --write` would, using the
 * repository's config for that path.
 *
 * @param {string} absolutePath destination file, used only to resolve config
 * @param {string} text raw generated Markdown
 * @returns {Promise<string>}
 */
export async function formatMarkdown(absolutePath, text) {
  const config = await resolveConfig(absolutePath)
  return format(text, { ...config, parser: 'markdown' })
}
