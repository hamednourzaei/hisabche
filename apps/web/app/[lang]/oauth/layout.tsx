import type { ReactNode } from 'react'
import { setRequestLocale } from 'next-intl/server'

import { resolveLocale } from '../i18n-config'
import { CORE_NAMESPACES, ScopedMessages } from '../scoped-messages'

// The consent screen reads `oauth.*`, the scope and event names (`developer.*`)
// and the disclosure words it shares with the listing (`marketplace.*`).
// Only these namespaces reach the browser, not the ~160 KB full catalogue.
// Guarded by public-page-namespaces.test.ts in packages/ui.
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  setRequestLocale(resolveLocale(lang))
  return (
    <ScopedMessages
      lang={lang}
      namespaces={[...CORE_NAMESPACES, 'oauth', 'developer', 'marketplace']}
    >
      {children}
    </ScopedMessages>
  )
}
