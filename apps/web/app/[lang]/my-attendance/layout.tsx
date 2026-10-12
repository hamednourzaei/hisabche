import type { ReactNode } from 'react'
import { setRequestLocale } from 'next-intl/server'

import { resolveLocale } from '../i18n-config'
import { CORE_NAMESPACES, ScopedMessages } from '../scoped-messages'

// An employee's own attendance page reads `attendanceSelf.*`, and the shared
// select it uses reads `select.*`. Without this layout the page had only the
// core namespaces and the first t('attendanceSelf.…') would throw into the
// error boundary (BUG-079). Guarded by public-page-namespaces.test.ts.
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
    <ScopedMessages lang={lang} namespaces={[...CORE_NAMESPACES, 'attendanceSelf', 'select']}>
      {children}
    </ScopedMessages>
  )
}
