'use client'

import { useTranslations } from 'next-intl'
import { DocsView, ROUTE_DOCS_MAP } from '@hisabche/ui'

/**
 * The docs, wired to next-intl.
 *
 * ⚠️ `t` is passed down rather than the view calling `useTranslations` itself,
 * so `packages/ui` stays free of a next-intl dependency — desktop mounts the
 * same components through its own shim.
 */
export function DocsClient({ lang, slug }: { lang: string; slug?: string }) {
  const t = useTranslations()

  return (
    <DocsView
      t={(key) => t(key)}
      hrefFor={(articleSlug) => `/${lang}/docs/${articleSlug}`}
      activeSlug={slug}
      // The reverse of the «?» in the dashboard. Built by inverting the same
      // table, so the two directions cannot point at different screens.
      appHrefFor={(articleSlug) => {
        const route = Object.entries(ROUTE_DOCS_MAP).find(([, s]) => s === articleSlug)?.[0]
        return route ? `/${lang}/${route}` : null
      }}
    />
  )
}
