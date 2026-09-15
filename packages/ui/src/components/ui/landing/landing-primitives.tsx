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
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { cn } from '../../../lib/utils'

/** One content width for every landing section. */
export const LANDING_CONTAINER = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

/**
 * Vertical rhythm shared by the full sections — MOBILE FIRST.
 * The default is the phone: 40px. Desktop gaps (96px) on a 360px screen only
 * add scrolling, so they arrive at `lg`, not by proportion.
 */
//
// `content-visibility: auto` lets the browser skip style, layout and paint for
// a section until it nears the viewport — every LANDING_SECTION is below the
// hero. PageSpeed measured ~1 s of "Other" + "Style & Layout" on load. The
// intrinsic size keeps the scrollbar honest before a section is rendered.
export const LANDING_SECTION =
  'relative py-10 sm:py-16 lg:py-24 [content-visibility:auto] [contain-intrinsic-size:auto_900px]'

/**
 * Type scale. Defaults are the phone sizes, chosen for Persian script at 360px
 * (a 30px h2 broke a four-word title over two lines); larger steps are opt-in.
 */
export const LANDING_TYPE = {
  h1: 'text-[1.875rem] leading-[1.25] sm:text-5xl sm:leading-[1.2] lg:text-6xl',
  h2: 'text-[1.5rem] leading-snug sm:text-3xl lg:text-4xl',
  h3: 'text-lg leading-snug sm:text-2xl lg:text-3xl',
  lead: 'text-base leading-relaxed sm:text-lg',
  body: 'text-sm leading-relaxed',
} as const

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
    <div className={cn('mx-auto mb-8 max-w-2xl text-center sm:mb-12 lg:mb-16', className)}>
      {label ? (
        <div className="mb-4">
          <SectionLabel>{label}</SectionLabel>
        </div>
      ) : null}
      <h2
        className={cn(
          'mb-3 text-balance font-bold tracking-tight text-[hsl(var(--fg-primary))] sm:mb-4',
          LANDING_TYPE.h2,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className={cn('text-pretty text-[hsl(var(--fg-secondary))]', LANDING_TYPE.lead)}>
          {description}
        </p>
      ) : null}
    </div>
  )
}

/**
 * An arrow that points FORWARD in the reading direction: ← in fa/af, → in en.
 * The icon is SELECTED by `dir`, not mirrored with a transform — a mirrored
 * glyph and a rotated one are different shapes.
 */
export function ForwardArrow({ className }: { className?: string | undefined }) {
  return (
    <>
      <ArrowLeft className={cn('size-4 ltr:hidden', className)} aria-hidden="true" />
      <ArrowRight className={cn('size-4 rtl:hidden', className)} aria-hidden="true" />
    </>
  )
}
