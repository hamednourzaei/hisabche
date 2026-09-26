import type { ReactNode } from 'react'
import { setRequestLocale } from 'next-intl/server'

import { resolveLocale } from '../i18n-config'
import { CORE_NAMESPACES, ScopedMessages } from '../scoped-messages'

// The blog's only client island (likes, stars, comments) reads `blog.*`; the
// rest of the page is server-rendered with the server translator. So the page
// ships the core namespaces plus `blog`, not the ~160 KB full catalogue.
export default async function BlogLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  setRequestLocale(resolveLocale(lang))
  return (
    <ScopedMessages lang={lang} namespaces={[...CORE_NAMESPACES, 'blog']}>
      {children}
    </ScopedMessages>
  )
}
