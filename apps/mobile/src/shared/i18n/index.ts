// ============================================
// Mobile i18n bootstrap
//
// Reuses the shared i18next instance (@hisabche/i18n) and its locale
// files, then layers two more namespaces on top:
//
//   `mobile` — mobile-only copy
//   `common` — the *same* catalogs web and desktop render through next-intl
//
// `common` is what makes navigation copy portable: the shared navigation
// contract names keys like `nav.today`, and registering the catalogs here means
// mobile resolves them from the same file web does instead of keeping a second
// spelling of every destination. It is registered on mobile rather than inside
// `@hisabche/i18n` so web does not ship the catalogs twice.
//
// The shared `changeLanguage()` helper touches `document`, which does not
// exist on device — so language switching is handled here instead.
// ============================================

import { I18nManager } from 'react-native'
import { getLocales } from 'expo-localization'
import { readStorage, writeStorage, STORAGE_KEYS } from '@hisabche/api'
import i18n, { supportedLanguages, type SupportedLanguage } from '@hisabche/i18n'
import { getMessages } from '@hisabche/i18n/messages'

import { mobileStrings } from './mobile-strings'

const NAMESPACE = 'mobile'

/** Navigation and other copy shared verbatim with web/desktop. */
export const COMMON_NAMESPACE = 'common'

supportedLanguages.forEach(({ code }) => {
  i18n.addResourceBundle(code, NAMESPACE, mobileStrings[code], true, true)
  i18n.addResourceBundle(code, COMMON_NAMESPACE, getMessages(code), true, true)
})

export function directionOf(lang: SupportedLanguage): 'rtl' | 'ltr' {
  return supportedLanguages.find((l) => l.code === lang)?.direction ?? 'rtl'
}

function isSupported(value: string | null | undefined): value is SupportedLanguage {
  return typeof value === 'string' && supportedLanguages.some((l) => l.code === value)
}

function detectDeviceLanguage(): SupportedLanguage {
  const tags = getLocales().map((locale) => locale.languageTag)
  const exact = tags.find(isSupported)
  if (exact) return exact
  if (tags.some((tag) => tag.startsWith('fa') || tag.startsWith('prs'))) return 'fa-AF'
  if (tags.some((tag) => tag.startsWith('en'))) return 'en'
  return 'fa-IR'
}

/**
 * Resolve the startup language and align native layout direction.
 * Requires initStorage() to have run so the persisted value is readable.
 */
export async function initMobileI18n(): Promise<SupportedLanguage> {
  const stored = readStorage(STORAGE_KEYS.language)
  const lang = isSupported(stored) ? stored : detectDeviceLanguage()

  await i18n.changeLanguage(lang)
  writeStorage(STORAGE_KEYS.language, lang)
  applyDirection(lang)
  return lang
}

/** Persist a language choice. Returns true when a native reload is required. */
export async function setMobileLanguage(lang: SupportedLanguage): Promise<boolean> {
  writeStorage(STORAGE_KEYS.language, lang)
  await i18n.changeLanguage(lang)
  return applyDirection(lang)
}

function applyDirection(lang: SupportedLanguage): boolean {
  const shouldBeRTL = directionOf(lang) === 'rtl'
  if (I18nManager.isRTL === shouldBeRTL) return false

  I18nManager.allowRTL(shouldBeRTL)
  I18nManager.forceRTL(shouldBeRTL)
  return true
}

export { i18n, supportedLanguages, type SupportedLanguage }
