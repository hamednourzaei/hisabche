// packages/ui/src/components/ui/navigation/navigation-registry.tsx
'use client'

import { useEffect, useRef, memo } from 'react'
import { registerSectionRef } from '../../../lib/menu/navigation-core'
import { isSectionId, queueSetActiveSection } from '../landing/use-scroll-narrative-store'

/* ═══════════════════════════════════════════════════════════════════════════
   NavigationRegistry v3

   Registers a landing section for the section menu AND marks it active while it
   is in view. That second job used to live in each scene (`useSceneObserver`),
   which forced every scene to be a client component; the scenes are now server
   components and this one small wrapper does the observing for all of them.

   ⚠️ NO `id` ON THE WRAPPER. The section inside already carries the anchor id
   (`<section id="features">`); the wrapper repeating it produced two elements
   with the same id on the page.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface NavigationRegistryProps {
  id: string
  children: React.ReactNode
}

export const NavigationRegistry = memo(function NavigationRegistry({
  id,
  children,
}: NavigationRegistryProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    registerSectionRef(id, element)

    let observer: IntersectionObserver | null = null
    if (isSectionId(id)) {
      // A section is active while it crosses a thin band in the middle of the
      // viewport. A ratio threshold (0.25) never fires for a section taller
      // than four screens — the offline chapter on a phone — so the menu stuck.
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) queueSetActiveSection(id)
        },
        { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
      )
      observer.observe(element)
    }

    return () => {
      observer?.disconnect()
      registerSectionRef(id, null)
    }
  }, [id])

  return <div ref={ref}>{children}</div>
})

NavigationRegistry.displayName = 'NavigationRegistry'
