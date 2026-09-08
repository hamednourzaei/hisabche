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
export function DocsClient({ lang, slug }: { lang: string; slug: string }) {
  const translate = useTranslations()

  /**
   * ⚠️ NON-THROWING ON PURPOSE.
   *
   * `next-intl`'s `t()` THROWS when a key is missing. `DocsView` reads roughly
   * twenty keys per article, so one absent key — a language bundle that
   * shipped a build behind, a slug added before its text — took the whole page
   * down with a 500 rather than rendering the other nineteen.
   *
   * A docs page missing one heading is a defect worth fixing; a docs page
   * returning 500 is an outage. The guard test still fails on any missing key,
   * so this hides nothing from CI — it only stops a content gap becoming an
   * error page for a reader.
   */
  const t = (key: string): string => {
    try {
      return translate(key)
    } catch {
      return ''
    }
  }

  return (
    <DocsView
      t={t}
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
