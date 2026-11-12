// ============================================
// Hisabche message catalogs — dynamic active-locale loader (V62 Slice 3).
//
// `packages/ui` is written against next-intl, whose keys are dotted paths into
// one flat `common.json` per locale. By loading each locale via dynamic
// `import()`, desktop/mobile bundles emit one lazy chunk per locale instead of
// bundling all three (2.26 MB) into the entry chunk.
// ============================================

/** Locale codes as the web app and the message directories name them. */
export type MessageLocale = 'fa' | 'af' | 'en'

export type MessageCatalog = Record<string, unknown>

/**
 * Web-only top-level namespaces excluded when loading catalogs for the
 * desktop/mobile shell (`shellOnly: true`). Source JSON files are never edited.
 */
export const SHELL_EXCLUDED_NAMESPACES = ['landing', 'docs', 'admin', 'blog', 'oauth'] as const

export const defaultMessageLocale: MessageLocale = 'fa'

const loadedCatalogs = new Map<MessageLocale, MessageCatalog>()
const inFlightLoads = new Map<MessageLocale, Promise<MessageCatalog>>()

const LOCALE_LOADERS: Record<MessageLocale, () => Promise<{ default: MessageCatalog }>> = {
  fa: () => import('../messages/fa/common.json') as Promise<{ default: MessageCatalog }>,
  af: () => import('../messages/af/common.json') as Promise<{ default: MessageCatalog }>,
  en: () => import('../messages/en/common.json') as Promise<{ default: MessageCatalog }>,
}

/**
 * Desktop and mobile identify languages as `fa-IR | fa-AF | en`; the catalogs
 * are keyed `fa | af | en`. Narrow rather than widen — Dari (`fa-AF`) has its
 * own catalog and must not silently fall back to Iranian Persian.
 */
export function toMessageLocale(lang: string | null | undefined): MessageLocale {
  switch (lang) {
    case 'fa-AF':
    case 'af':
      return 'af'
    case 'en':
      return 'en'
    case 'fa-IR':
    case 'fa':
      return 'fa'
    default:
      return defaultMessageLocale
  }
}

export function filterShellCatalog(
  catalog: MessageCatalog,
  excluded: readonly string[] = SHELL_EXCLUDED_NAMESPACES,
): MessageCatalog {
  const excludedSet = new Set(excluded)
  const filtered: MessageCatalog = {}
  for (const [key, value] of Object.entries(catalog)) {
    if (!excludedSet.has(key)) {
      filtered[key] = value
    }
  }
  return filtered
}

/** Dynamically load ONLY the active locale catalog and cache it in memory. */
export async function loadMessages(
  lang: string | null | undefined,
  options?: { shellOnly?: boolean },
): Promise<MessageCatalog> {
  const locale = toMessageLocale(lang)
  const cached = loadedCatalogs.get(locale)
  if (cached) return cached

  const existing = inFlightLoads.get(locale)
  if (existing) return existing

  const promise = LOCALE_LOADERS[locale]().then((mod) => {
    const raw = (mod.default ?? mod) as MessageCatalog
    const catalog = options?.shellOnly ? filterShellCatalog(raw) : raw
    loadedCatalogs.set(locale, catalog)
    inFlightLoads.delete(locale)
    return catalog
  })

  inFlightLoads.set(locale, promise)
  return promise
}

/** Which locales have actually been loaded into memory in this process. */
export function getLoadedLocales(): readonly MessageLocale[] {
  return [...loadedCatalogs.keys()]
}

/** Clear loaded locale cache (test helper). */
export function resetLoadedMessagesForTests(): void {
  loadedCatalogs.clear()
  inFlightLoads.clear()
}

/**
 * Synchronous read of a previously loaded locale catalog.
 * Call `await loadMessages(lang)` during app bootstrap or language switch first.
 */
export function getMessages(lang: string | null | undefined): MessageCatalog {
  return loadedCatalogs.get(toMessageLocale(lang)) ?? {}
}

/**
 * Resolve a dotted key against a catalog.
 *
 * Returns `undefined` when the path is missing or lands on a non-string node,
 * so callers can decide between a fallback and echoing the key. Mirrors
 * next-intl's behaviour, which the `safeT`/`st` wrappers across `packages/ui`
 * depend on: they compare the result to the full key path to detect a miss.
 */
export function resolveMessage(catalog: MessageCatalog, key: string): string | undefined {
  let node: unknown = catalog

  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[segment]
  }

  return typeof node === 'string' ? node : undefined
}

/** Strict key lookup that throws when a key is missing. */
export function requireMessage(
  catalog: MessageCatalog,
  key: string,
  values?: Record<string, string | number | undefined>,
): string {
  const template = resolveMessage(catalog, key)
  if (template === undefined) {
    throw new Error(`Missing i18n message key: ${key}`)
  }
  return formatMessage(template, values)
}

/** Substitute `{name}` placeholders the way next-intl's ICU subset does. */
export function formatMessage(
  template: string,
  values?: Record<string, string | number | undefined>,
): string {
  if (!values) return template

  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name]
    return value === undefined ? match : String(value)
  })
}
