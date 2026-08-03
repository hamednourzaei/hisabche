// ============================================
// Desktop i18n — reuses the shared i18next instance and locale files,
// then layers the `desktop` namespace on top.
// ============================================

import { readStorage, writeStorage, STORAGE_KEYS } from '@hisabche/api'
import i18n, { supportedLanguages, type SupportedLanguage } from '@hisabche/i18n'

import { desktopStrings } from './desktop-strings'

const NAMESPACE = 'desktop'

supportedLanguages.forEach(({ code }) => {
  i18n.addResourceBundle(code, NAMESPACE, desktopStrings[code], true, true)
})

function isSupported(value: string | null | undefined): value is SupportedLanguage {
  return typeof value === 'string' && supportedLanguages.some((l) => l.code === value)
}

export function directionOf(lang: SupportedLanguage): 'rtl' | 'ltr' {
  return supportedLanguages.find((l) => l.code === lang)?.direction ?? 'rtl'
}

function applyDirection(lang: SupportedLanguage): void {
  const root = document.documentElement
  root.dir = directionOf(lang)
  root.lang = lang
}

/** Resolve the startup language. Requires initStorage() to have run. */
export async function initDesktopI18n(osLocale: string): Promise<SupportedLanguage> {
  const stored = readStorage(STORAGE_KEYS.language)
  const detected = supportedLanguages.find((l) => osLocale.startsWith(l.code.slice(0, 2)))
  const lang: SupportedLanguage = isSupported(stored) ? stored : (detected?.code ?? 'fa-IR')

  await i18n.changeLanguage(lang)
  writeStorage(STORAGE_KEYS.language, lang)
  applyDirection(lang)
  return lang
}

export async function setDesktopLanguage(lang: SupportedLanguage): Promise<void> {
  writeStorage(STORAGE_KEYS.language, lang)
  await i18n.changeLanguage(lang)
  applyDirection(lang)
}

export { i18n, supportedLanguages, type SupportedLanguage }
