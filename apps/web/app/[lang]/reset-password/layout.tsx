import type { ReactNode } from 'react'
import { FullMessagesLayout } from '../scoped-messages'

// Full message catalogue for this route tree — the root layout ships only the
// core namespaces (see scoped-messages.tsx).
export default function Layout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ lang: string }>
}) {
  return <FullMessagesLayout params={params}>{children}</FullMessagesLayout>
}
