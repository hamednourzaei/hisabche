'use client'

import { useTranslations } from 'next-intl'
import { PageCustomizer, type CustomizerGroup } from './page-customizer'
import { useCustomizerStore } from '@hisabche/store'
import { useCallback, useEffect, useState } from 'react'
import { usePageLook } from '../../lib/page-look'
import { NAV_ITEMS } from '../../lib/menu/nav-items'
import { consumeCustomizeFlag } from '../../lib/customize-flag'
import { isNavLocked } from '@hisabche/ui-contract'
import { useMyCapabilities } from '@hisabche/api'
import { useDnaMenuSuggestion } from '../../hooks/use-dna-menu-suggestion'

export const MENU_ALWAYS: readonly string[] = ['/dashboard', '/settings']

/** A translator that answers with a fallback instead of the raw key. */
export function useCustomizerT(): (key: string, fallback?: string) => string {
  const tOriginal = useTranslations()
  return useCallback(
    (key: string, fallback?: string): string => {
      try {
        const v = tOriginal(key as Parameters<typeof tOriginal>[0])
        return v && v !== key ? v : (fallback ?? key)
      } catch {
        return fallback ?? key
      }
    },
    [tOriginal],
  )
}

/**
 * The menu as a customizer group — every page the person's role offers, less
 * the two that cannot be hidden. ONE definition, used by the wrench in the
 * header and by Settings → «صفحه‌ها و تب‌ها».
 */
export function useMenuCustomizerGroup(
  t: (key: string, fallback?: string) => string,
): CustomizerGroup {
  const menuLook = usePageLook('menu')
  const { data: capabilities } = useMyCapabilities()
  const hiddenByRole = capabilities?.blockedModules ?? []
  return {
    title: t('pageLook.menu', 'منو'),
    look: menuLook,
    items: NAV_ITEMS.filter(
      (item) => !MENU_ALWAYS.includes(item.path) && !isNavLocked(item.path, hiddenByRole),
    ).map((item) => ({ id: item.path, label: t(item.labelKey, item.path) })),
  }
}

export function GlobalPageCustomizer() {
  const t = useCustomizerT()
  const pageGroups = useCustomizerStore((state) => state.pageGroups)
  const menuGroup = useMenuCustomizerGroup(t)
  // V54 5.6: the business's starting menu, once, only while the person has
  // none of their own. Everything it hides stays one tap away here.
  useDnaMenuSuggestion()

  // null until mounted (the server knows no person); then whether a
  // `?customize=1` link from settings asked for the dialog on arrival — once.
  const [openOnArrival, setOpenOnArrival] = useState<boolean | null>(null)

  useEffect(() => {
    setOpenOnArrival(consumeCustomizeFlag())
  }, [])

  if (openOnArrival === null) return null

  // Combine page-specific groups (like dashboard parts, hub tabs) with the global menu group
  const allGroups = [...pageGroups, menuGroup]

  if (allGroups.length === 0) return null

  return <PageCustomizer t={t} groups={allGroups} initiallyOpen={openOnArrival} />
}
