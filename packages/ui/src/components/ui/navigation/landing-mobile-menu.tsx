// packages/ui/src/components/ui/navigation/landing-mobile-menu.tsx
'use client'

// The landing's phone drawer, split out of TopNav so its code — the project's
// Sheet on Radix Dialog, ~22 KiB gzip — is downloaded on the FIRST TAP of the
// menu button instead of with every page load. PageSpeed's mobile run counts
// every byte of parsed JavaScript toward Total Blocking Time.
import { useRef } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

import { cn } from '../../../lib/utils'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../sheet'

export interface LandingMobileMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dir: 'rtl' | 'ltr'
  title: string
  sections: ReadonlyArray<{ id: string; label: string }>
  activeSection: string | null | undefined
  /** Called after the drawer has closed — its scroll lock would stop a smooth scroll. */
  onSelectSection: (id: string) => void
  routePrefix: string
  labels: { open: string; close: string; signIn: string; signUp: string }
}

export default function LandingMobileMenu({
  open,
  onOpenChange,
  dir,
  title,
  sections,
  activeSection,
  onSelectSection,
  routePrefix,
  labels,
}: LandingMobileMenuProps) {
  const pendingSection = useRef<string | null>(null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="end"
        dir={dir}
        showCloseButton={false}
        className="flex w-[85%] flex-col p-0 md:hidden"
        onCloseAutoFocus={(event) => {
          const id = pendingSection.current
          if (!id) return
          pendingSection.current = null
          event.preventDefault()
          onSelectSection(id)
        }}
      >
        <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-[hsl(var(--border-default))] px-5 py-4">
          <SheetTitle className="text-lg font-bold">
            {title}
            <span className="text-[hsl(var(--color-primary))]" aria-hidden="true">
              .
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">{labels.open}</SheetDescription>
          <SheetClose
            aria-label={labels.close}
            className="flex size-10 items-center justify-center rounded-full text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            <X className="size-5" aria-hidden="true" />
          </SheetClose>
        </SheetHeader>

        <nav className="flex-1 px-5">
          <ul className="flex flex-col">
            {sections.map(({ id, label }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  aria-current={activeSection === id ? 'true' : undefined}
                  onClick={(event) => {
                    event.preventDefault()
                    pendingSection.current = id
                    onOpenChange(false)
                  }}
                  className={cn(
                    'flex min-h-12 items-center border-b border-[hsl(var(--border-default)/0.6)] text-base',
                    activeSection === id
                      ? 'font-semibold text-[hsl(var(--color-primary))]'
                      : 'text-[hsl(var(--fg-primary))]',
                  )}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-3 border-t border-[hsl(var(--border-default))] p-5">
          <Link
            prefetch={false}
            href={`${routePrefix}/login`}
            className="btn-secondary flex min-h-12 w-full items-center justify-center rounded-xl text-base"
          >
            {labels.signIn}
          </Link>
          <Link
            prefetch={false}
            href={`${routePrefix}/signup`}
            className="btn-primary flex min-h-12 w-full items-center justify-center rounded-xl text-base"
          >
            {labels.signUp}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
