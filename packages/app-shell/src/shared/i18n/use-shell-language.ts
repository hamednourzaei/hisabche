// ============================================
// Windows and Android: the one language switch, for the header and Settings.
//
// Both read the current language from i18n and follow its «languageChanged»
// event, so a change made in either place shows in the other. The change
// itself is `setDesktopLanguage` — stored, then applied — and nothing else.
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LanguageSwitch } from '@hisabche/ui'

import { i18n, setDesktopLanguage, supportedLanguages, type SupportedLanguage } from './index'

function known(code: string | undefined): SupportedLanguage {
  return supportedLanguages.some((language) => language.code === code)
    ? (code as SupportedLanguage)
    : 'fa-IR'
}

export function useShellLanguage(): LanguageSwitch {
  const [current, setCurrent] = useState<SupportedLanguage>(() => known(i18n.language))

  useEffect(() => {
    const follow = (code: string) => setCurrent(known(code))
    i18n.on('languageChanged', follow)
    return () => {
      i18n.off('languageChanged', follow)
    }
  }, [])

  const change = useCallback((code: string) => {
    void setDesktopLanguage(known(code))
  }, [])

  return useMemo(
    () => ({
      current,
      options: supportedLanguages.map((language) => ({
        code: language.code,
        label: language.nativeName,
      })),
      change,
    }),
    [current, change],
  )
}
