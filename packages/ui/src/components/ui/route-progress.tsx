// ============================================
// The thin bar across the top of the app during a navigation.
//
// `loading.tsx` covers a route whose data suspends. It does NOT cover the gap
// before that — the moment between the click and the new segment starting to
// render — and it does not cover a client-side transition that resolves from
// cache but still takes a beat. Those are exactly the cases that read as a
// dead click.
//
// This watches the pathname and shows a bar for as long as a change is
// settling. It is deliberately dumb: no router internals, no navigation API
// that differs between Next and react-router, so web and desktop both get it.
// ============================================
'use client'

import { memo, useEffect, useRef, useState } from 'react'

import { cn } from '../../lib/utils'

export interface RouteProgressProps {
  /** The current path. The caller supplies it from its own router. */
  pathname: string
}

export const RouteProgress = memo(function RouteProgress({ pathname }: RouteProgressProps) {
  const [visible, setVisible] = useState(false)
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname

    setVisible(true)
    // Long enough to be seen, short enough never to outlive the paint it is
    // covering. A bar that lingers after the page has arrived is worse than
    // no bar, because it implies something is still wrong.
    const timer = setTimeout(() => setVisible(false), 600)
    return () => clearTimeout(timer)
  }, [pathname])

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5',
        'transition-opacity duration-200 motion-reduce:transition-none',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div
        className={cn(
          'h-full w-full origin-[left] bg-[var(--gradient-brand)] rtl:origin-[right]',
          visible && 'animate-[route-progress_600ms_ease-out_forwards]',
          'motion-reduce:animate-none',
        )}
      />
    </div>
  )
})

RouteProgress.displayName = 'RouteProgress'
