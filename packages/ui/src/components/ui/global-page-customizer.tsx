'use client'

import { useTranslations } from 'next-intl'
import { PageCustomizer } from './page-customizer'
import { useCustomizerStore } from '@hisabche/store'
import { useEffect, useState } from 'react'

export function GlobalPageCustomizer() {
  const t = useTranslations()
  const groups = useCustomizerStore((state) => state.pageGroups)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || groups.length === 0) return null

  return <PageCustomizer t={t} groups={groups} />
}
