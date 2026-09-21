// ============================================
// `next/dynamic` for the Electron renderer.
//
// Shared screens in `@hisabche/ui` code-split their heavy leaves — recharts is
// ~830 kB, and the KPI tiles are the reason the user opened the app, so they
// must paint without waiting for chart code. That intent is worth keeping on
// desktop; only the mechanism is Next-specific.
//
// React.lazy + Suspense reproduces it. `ssr: false` is accepted and ignored:
// the renderer never server-renders, so every import is already client-only.
// ============================================

import React, { Suspense, lazy, type ComponentType } from 'react'

type Loader<P> = () => Promise<ComponentType<P> | { default: ComponentType<P> }>

interface DynamicOptions {
  ssr?: boolean
  loading?: () => React.ReactNode
}

/**
 * Callers use both shapes next/dynamic accepts — a bare module (`import('./x')`)
 * and a picked export (`import('./x').then((m) => m.Chart)`). React.lazy only
 * takes the first, so the pick is normalised back into a default export here.
 */
export default function dynamic<P extends object>(
  loader: Loader<P>,
  options: DynamicOptions = {},
): ComponentType<P> {
  const Lazy = lazy(async () => {
    const loaded = await loader()
    return 'default' in loaded ? (loaded as { default: ComponentType<P> }) : { default: loaded }
  })

  const Fallback = options.loading

  return function DynamicComponent(props: P) {
    return (
      <Suspense fallback={Fallback ? <>{Fallback()}</> : null}>
        <Lazy {...props} />
      </Suspense>
    )
  }
}
