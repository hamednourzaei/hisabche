'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { ErrorBoundary } from '@hisabche/ui'

/**
 * This wrapper used to load ErrorBoundary through `next/dynamic` with
 * `{ ssr: false }`. Because it wraps the entire application in the root layout,
 * that single flag opted the whole page tree out of server rendering: every
 * public URL — home, /about, /contact, all 11 /legal/* pages — served
 * `<body><div hidden><!--$--><!--/$--></div></body>` and nothing else. No <h1>,
 * no body copy, no crawlable internal links; the content existed only inside
 * the RSC payload for the client to render.
 *
 * Metadata was unaffected (titles, canonicals, hreflang and JSON-LD come from
 * the Metadata API and the <head>), which is why the problem was invisible to a
 * source-level review and only showed up when inspecting the rendered HTML.
 *
 * `ErrorBoundary` is a plain class component that touches no browser API before
 * mount, so it server-renders correctly. Importing it directly keeps the same
 * runtime error handling while restoring real HTML for crawlers.
 */
export function ClientErrorBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // ⚠️ The pathname is passed as a reset key.
  //
  // Without it, a boundary that catches on one screen stays in its error state
  // for the rest of the session: the user navigates away, the new page renders
  // fine underneath, and they are still looking at a crash report for a screen
  // they have left. The only way out was a manual reload.
  //
  // Since this wraps the WHOLE application, that was every route.
  return <ErrorBoundary resetKeys={[pathname]}>{children}</ErrorBoundary>
}
