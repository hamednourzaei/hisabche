// ============================================
// Hisabche i18n — i18next Configuration
// ============================================

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import faAF from './locales/fa-AF.json'
import faIR from './locales/fa-IR.json'

// ============================================
// Types
// ============================================

export type SupportedLanguage = 'fa-IR' | 'fa-AF' | 'en'

export interface LanguageOption {
  code: SupportedLanguage
  name: string
  nativeName: string
  direction: 'rtl' | 'ltr'
}

export const supportedLanguages: LanguageOption[] = [
  {
    code: 'fa-IR',
    name: 'Persian',
    nativeName: 'فارسی',
    direction: 'rtl',
  },
  {
    code: 'fa-AF',
    name: 'Dari',
    nativeName: 'دری',
    direction: 'rtl',
  },
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
  },
]

// ============================================
// SSR SAFE HELPERS
// ============================================

function getStoredLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return 'fa-IR'
  }

  try {
    const stored = localStorage.getItem('hisabche-lang') as SupportedLanguage | null
    if (stored && supportedLanguages.some((l) => l.code === stored)) {
      return stored
    }
  } catch {
    // ignore
  }

  return 'fa-IR'
}

function getDirection(lang: SupportedLanguage): 'rtl' | 'ltr' {
  return supportedLanguages.find((l) => l.code === lang)?.direction ?? 'rtl'
}

// ============================================
// DEFAULTS
// ============================================

const DEFAULT_LANG: SupportedLanguage = 'fa-IR'

// ============================================
// RESOURCES
// ============================================

const resources = {
  'fa-IR': {
    translation: faIR,
  },
  'fa-AF': {
    translation: faAF,
  },
  'en': {
    translation: en,
  },
}

// ============================================
// INIT
// ============================================

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LANG,
    fallbackLng: 'fa-IR',
    interpolation: {
      escapeValue: false,
    },
    returnObjects: false,
    returnNull: false,
    react: {
      useSuspense: true,
    },
  })
}

// ============================================
// HELPERS
// ============================================

export function changeLanguage(lang: SupportedLanguage): void {
  i18n.changeLanguage(lang)

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('hisabche-lang', lang)
    } catch {
      // ignore
    }

    document.documentElement.dir = getDirection(lang)
    document.documentElement.lang = lang
  }
}

export function syncLanguageFromStorage(): void {
  const lang = getStoredLanguage()
  if (lang !== i18n.language) {
    changeLanguage(lang)
  }
}

export function getCurrentDirection(): 'rtl' | 'ltr' {
  return getDirection(i18n.language as SupportedLanguage)
}

export function isRTL(): boolean {
  return getCurrentDirection() === 'rtl'
}

export default i18n