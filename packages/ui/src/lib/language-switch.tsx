// ============================================
// The app's language — one switch, provided by the host, read by shared screens.
//
// ⚠️ ONE IMPLEMENTATION PER HOST, NOT ONE PER SCREEN. The web changes the
// path prefix and the NEXT_LOCALE cookie; Windows and Android store the choice
// and switch i18n (setDesktopLanguage). The header already called that host
// function; the shared Settings «زبان برنامه» section now reaches the SAME one
// through this context, so no screen grows a second way to change language.
// ============================================
'use client'

import { createContext, useContext, type ReactNode } from 'react'

export interface LanguageOption {
  code: string
  label: string
}

export interface LanguageSwitch {
  current: string
  options: readonly LanguageOption[]
  change: (code: string) => void
}

/** The web's three, in the order the header has always listed them. */
export const APP_LANGUAGES: readonly LanguageOption[] = [
  { code: 'af', label: 'دری' },
  { code: 'fa', label: 'فارسی' },
  { code: 'en', label: 'English' },
]

const LanguageSwitchContext = createContext<LanguageSwitch | null>(null)

export function LanguageSwitchProvider({
  value,
  children,
}: {
  value: LanguageSwitch
  children: ReactNode
}) {
  return <LanguageSwitchContext.Provider value={value}>{children}</LanguageSwitchContext.Provider>
}

/** Null outside a host that provides one — the section then does not render. */
export function useLanguageSwitch(): LanguageSwitch | null {
  return useContext(LanguageSwitchContext)
}
