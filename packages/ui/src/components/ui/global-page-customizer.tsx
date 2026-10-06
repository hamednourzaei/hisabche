'use client'

import { useTranslations } from 'next-intl'
import { PageCustomizer } from './page-customizer'
import { useCustomizerStore } from '@hisabche/store'
import { useCallback, useEffect, useState } from 'react'
import { usePageLook } from '../../lib/page-look'
import { NAV_ITEMS } from '../../lib/menu/nav-items'
import { isNavLocked } from '@hisabche/ui-contract'
import { useMyCapabilities } from '@hisabche/api'

export const MENU_ALWAYS: readonly string[] = ['/dashboard', '/settings']

export function GlobalPageCustomizer() {
  const tOriginal = useTranslations()
  const t = useCallback(
    (key: string, fallback?: string): string => {
      try {
        const v = tOriginal(key as any)
        return v && v !== key ? v : (fallback ?? key)
      } catch (err) {
        return fallback ?? key
      }
    },
    [tOriginal],
  )

  const pageGroups = useCustomizerStore((state) => state.pageGroups)
  const menuLook = usePageLook('menu')
  const { data: capabilities } = useMyCapabilities()
  const hiddenByRole = capabilities?.blockedModules ?? []

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const menuGroup = {
    title: t('pageLook.menu', 'منو'),
    look: menuLook,
    items: NAV_ITEMS.filter(
      (item) => !MENU_ALWAYS.includes(item.path) && !isNavLocked(item.path, hiddenByRole),
    ).map((item) => ({ id: item.path, label: t(item.labelKey, item.path) })),
  }

  // Combine page-specific groups (like dashboard parts, hub tabs) with the global menu group
  const allGroups = [...pageGroups, menuGroup]

  if (allGroups.length === 0) return null

  return <PageCustomizer t={t} groups={allGroups} />
}
