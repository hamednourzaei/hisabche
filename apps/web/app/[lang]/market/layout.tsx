import type { ReactNode } from 'react'
import { setRequestLocale } from 'next-intl/server'

import { resolveLocale } from '../i18n-config'
import { CORE_NAMESPACES, ScopedMessages } from '../scoped-messages'

// The marketplace pages are server-rendered with the server translator; the
// only client code on them is the shared site header, which reads the core
// namespaces and `blog` (its own nav labels). So the page ships those, not the
// full catalogue (BUG-079: a public page gets only what its layout provides).
export default async function MarketLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  setRequestLocale(resolveLocale(lang))
  return (
    <ScopedMessages lang={lang} namespaces={[...CORE_NAMESPACES, 'blog', 'market']}>
      {children}
    </ScopedMessages>
  )
}
