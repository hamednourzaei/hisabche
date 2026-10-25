// packages/ui/src/components/ui/landing/landing-primitives.tsx
//
// The landing's layout language. The page reads like a ledger:
//
//   ─────────────────────────────────────────────────────────────
//   01 ── یک سیستم                    همه ابزارهای کسب‌وکار…
//   (chapter number, a rule, the section name)
//
// One content width, one vertical rhythm, and a numbered masthead over every
// section. The number is the design's spine: it tells the visitor where they
// are in a long document and it lets the eye find a section again. It is set in
// the mono face on purpose — a folio number, not a word to translate.
//
// Depth comes from hairlines, not from blur: a card is a ruled box, a list is a
// ruled column, and the only shadow on the page is the header's. That is what
// keeps a dark page from turning into a field of glowing rectangles.
//
// RTL: every offset here is logical (`start-` / `end-` / `border-s`). The hover
// accent grows down the inline-start edge — right in fa/af, left in en — with no
// mirrored class and no `scale-x-[-1]`.
//
// ⚠️ Text never goes below `text-xs` (12px): the landing is read on a 360px
// phone first (`landing-i18n-keys.test.ts`, mobile-first guard).

import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

import { cn } from '../../../lib/utils'

/** One content width for every landing section. */
export const LANDING_CONTAINER = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10'

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
  'relative border-t border-[hsl(var(--border-default)/0.7)] py-12 sm:py-16 lg:py-24 [content-visibility:auto] [contain-intrinsic-size:auto_900px]'

/**
 * Type scale. Defaults are the phone sizes, chosen for Persian script at 360px
 * (a 30px h2 broke a four-word title over two lines); larger steps are opt-in.
 */
export const LANDING_TYPE = {
  h1: 'text-[2.125rem] leading-[1.12] sm:text-[3.25rem] sm:leading-[1.06] lg:text-[4.25rem]',
  h2: 'text-[1.5rem] leading-[1.2] sm:text-[2.125rem] lg:text-[2.75rem]',
  h3: 'text-base leading-snug sm:text-lg',
  lead: 'text-[0.9375rem] leading-7 sm:text-base sm:leading-8',
  body: 'text-sm leading-7 sm:text-[0.9375rem]',
} as const

/**
 * A ruled card. No shadow: the hairline is the surface. Pair it with `group`
 * and put `<CardAccent />` inside when the card is interactive.
 */
export const LANDING_CARD =
  'relative rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.55)]'

/** A ruled card that responds to the pointer without moving under it. */
export const LANDING_CARD_HOVER =
  'transition-colors duration-300 hover:border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-elevated))]'

/** A small ruled tag — a label, an item of a plan, a proof point. */
export const LANDING_CHIP =
  'inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base)/0.6)] px-2.5 py-1 text-xs font-medium text-[hsl(var(--fg-secondary))] transition-colors'

/** A rule that opens a section: a chapter number, a line, then the name. */
function SectionLabel({
  index,
  children,
}: {
  /** `01` … `09`. A folio number, not a translated word. */
  index?: string | undefined
  children: ReactNode
}) {
  return (
    <p className="flex items-center justify-center gap-3 text-xs font-semibold text-[hsl(var(--fg-tertiary))]">
      {index ? (
        <span className="font-mono text-xs tabular-nums tracking-widest text-[hsl(var(--color-primary))]">
          {index}
        </span>
      ) : null}
      <span aria-hidden="true" className="h-px w-8 bg-[hsl(var(--border-strong))]" />
      <span>{children}</span>
    </p>
  )
}

/**
 * The masthead of a section: number, name, title at display size, and the lead.
 *
 * ⚠️ TITLE AND LEAD SIT IN ONE COLUMN AT EVERY WIDTH. They used to be a
 * 12-column split on desktop (`lg:items-end`), so the lead dropped to the
 * bottom-left of the title's block — under a three-line title it read as a
 * separate paragraph floating away from its heading, and its position moved
 * from section to section with the length of the title. A masthead is a
 * caption: number, rule, name, title, then the sentence that explains it, all
 * starting on the same edge at 360px and at 1600px.
 *
 * Measured at 1440 / 768 / 390 / 360 in fa, af and en: every title on a page
 * starts on one edge, and no width scrolls sideways.
 */
export function SectionHeader({
  index,
  label,
  title,
  description,
  className,
}: {
  index?: string | undefined
  label?: ReactNode
  title: ReactNode
  description?: ReactNode
  className?: string | undefined
}) {
  return (
    <header
      className={cn(
        'mx-auto mb-8 flex max-w-4xl flex-col items-center text-center sm:mb-12 lg:mb-16',
        className,
      )}
    >
      {label ? <SectionLabel index={index}>{label}</SectionLabel> : null}
      <h2
        className={cn(
          'text-balance text-center font-black tracking-tight text-[hsl(var(--fg-primary))]',
          label ? 'mt-4' : undefined,
          LANDING_TYPE.h2,
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mx-auto mt-3 max-w-2xl text-pretty text-center text-[hsl(var(--fg-secondary))] sm:mt-4',
            LANDING_TYPE.lead,
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  )
}

/**
 * The hover accent of a ruled card: a 2px brand rule that grows down the
 * inline-start edge. Put it inside a `group relative` card.
 */
export function CardAccent() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-3 start-0 w-0.5 origin-top scale-y-0 rounded-full bg-[hsl(var(--color-primary))] transition-transform duration-300 group-hover:scale-y-100 group-focus-within:scale-y-100"
    />
  )
}

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
