import type { ReactNode } from 'react'
import { setRequestLocale } from 'next-intl/server'

import { resolveLocale } from '../i18n-config'
import { CORE_NAMESPACES, ScopedMessages } from '../scoped-messages'

// The customer portal reads `portal.*` and the order status words (`orders.status.*`).
// Without this layout the page had only the core namespaces, and the first
// t('portal.…') threw into the error boundary (BUG-079).
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
    <ScopedMessages lang={lang} namespaces={[...CORE_NAMESPACES, 'portal', 'orders']}>
      {children}
    </ScopedMessages>
  )
}
