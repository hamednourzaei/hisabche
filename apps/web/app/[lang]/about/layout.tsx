import type { ReactNode } from 'react'
import { PublicPageMessagesLayout } from '../scoped-messages'

// Full message catalogue for this route tree — the root layout ships only the
// core namespaces (see scoped-messages.tsx).
export default function Layout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  return <PublicPageMessagesLayout params={params}>{children}</PublicPageMessagesLayout>
}
