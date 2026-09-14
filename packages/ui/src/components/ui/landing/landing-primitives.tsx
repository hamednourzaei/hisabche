// ============================================
// packages/ui/src/components/ui/landing/landing-primitives.tsx
//
// Layout language of the landing page: centred section headers with a small
// outlined label, a faint dot-grid ground, and one content width.
//
// Adapted from the layout of shadcnstore/shadcn-dashboard-landing-template
// (MIT License, Copyright (c) 2025 ShadcnStore — see
// https://github.com/shadcnstore/shadcn-dashboard-landing-template/blob/main/License.md).
// Only structure and spacing were taken; colours are this project's tokens and
// every word on the page is Hisabche's own content.
// ============================================

import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'

/** One content width for every landing section. */
export const LANDING_CONTAINER = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

/** Vertical rhythm shared by the full sections. */
export const LANDING_SECTION = 'relative py-16 sm:py-24'

/**
 * A faint dot grid, faded out towards the edges. Pure CSS — no SVG, no image.
 * Decorative only: `aria-hidden`, never intercepts pointer events.
 */
export function DotPattern({
  className,
  fade = 'ellipse',
}: {
  className?: string | undefined
  fade?: 'ellipse' | 'top' | undefined
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0',
        'bg-[radial-gradient(hsl(var(--fg-primary)/0.13)_1px,transparent_1px)] [background-size:22px_22px]',
        fade === 'ellipse'
          ? '[mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]'
          : '[mask-image:linear-gradient(to_bottom,black,transparent_85%)]',
        className,
      )}
    />
  )
}

/** The small outlined label above a section title. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1',
        'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base)/0.6)]',
        'text-xs font-medium text-[hsl(var(--fg-secondary))]',
      )}
    >
      {children}
    </span>
  )
}

export function SectionHeader({
  label,
  title,
  description,
  className,
}: {
  label?: ReactNode
  title: ReactNode
  description?: ReactNode
  className?: string | undefined
}) {
  return (
    <div className={cn('mx-auto mb-12 max-w-2xl text-center sm:mb-16', className)}>
      {label ? (
        <div className="mb-4">
          <SectionLabel>{label}</SectionLabel>
        </div>
      ) : null}
      <h2 className="mb-4 text-balance text-3xl font-bold tracking-tight text-[hsl(var(--fg-primary))] sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="text-pretty text-base leading-relaxed text-[hsl(var(--fg-secondary))] sm:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  )
}
