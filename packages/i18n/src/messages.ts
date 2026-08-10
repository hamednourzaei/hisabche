// ============================================
// Hisabche message catalogs — the single source of UI copy.
//
// `packages/ui` is written against next-intl, whose keys are dotted paths into
// one flat `common.json` per locale. Web loads those catalogs through
// next-intl's request config; desktop loads them through its next-intl shim.
// Both read the files in `packages/i18n/messages`, so a string added for one
// renderer is immediately available to the others.
// ============================================

import af from '../messages/af/common.json'
import en from '../messages/en/common.json'
import fa from '../messages/fa/common.json'

/** Locale codes as the web app and the message directories name them. */
export type MessageLocale = 'fa' | 'af' | 'en'

export type MessageCatalog = Record<string, unknown>

export const messageCatalogs: Record<MessageLocale, MessageCatalog> = {
  fa: fa as MessageCatalog,
  af: af as MessageCatalog,
  en: en as MessageCatalog,
}

export const defaultMessageLocale: MessageLocale = 'fa'

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

export function getMessages(lang: string | null | undefined): MessageCatalog {
  return messageCatalogs[toMessageLocale(lang)]
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
