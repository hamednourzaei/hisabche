// packages/ui/src/components/ui/landing/compare-scene.tsx
//
// "From scattered methods to one real system": the old way of keeping books
// beside what the product does instead. SERVER COMPONENT — never hydrated.
//
// No competitor is named, and every end-hand cell is a shipped capability
// (connected posting, offline apps, role permissions, audit trail).
// Rendered as a two-column grid, not a <table>: it must fit a 360px phone
// without scrolling sideways (landing-i18n-keys.test.ts, mobile-first guard).
//
// The two columns are read as one ruled sheet: the left (start) column is the
// past — quiet, struck through by an em dash — and the end column is the
// product, tinted and ticked. No rounded frame: a comparison is a table of
// facts, and the page's hairlines already draw it.

import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

export interface CompareSceneProps {
  t: (key: string, fallback?: string) => string
  /** Chapter number of this section on the page (`06`). */
  index?: string | undefined
}

const ROWS = ['books', 'reentry', 'internet', 'lateReports', 'access', 'changes'] as const

export default function CompareScene({ t, index }: CompareSceneProps) {
  return (
    <section id="compare" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          index={index}
          label={t('landing.compare.label')}
          title={t('landing.compare.title')}
          description={t('landing.compare.desc')}
        />

        <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-[hsl(var(--border-default))]">
          <div className="grid grid-cols-2 border-b border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted)/0.5)] text-xs font-semibold sm:text-sm">
            <p className="px-4 py-3 text-[hsl(var(--fg-tertiary))] sm:px-6">
              {t('landing.compare.old')}
            </p>
            <p className="border-s border-[hsl(var(--border-default))] px-4 py-3 text-[hsl(var(--color-primary))] sm:px-6">
              {t('landing.compare.new')}
            </p>
          </div>

          <ul>
            {ROWS.map((row, i) => (
              <li
                key={row}
                className="grid grid-cols-2 border-t border-[hsl(var(--border-default)/0.7)] text-sm first:border-t-0 sm:text-[0.9375rem]"
              >
                {/* The tick is ::before text, not an icon (DOM budget). The
                    folio number lets a reader point at a row: «ردیف ۳». */}
                <span className="flex items-start gap-2 px-4 py-4 text-pretty text-[hsl(var(--fg-secondary))] sm:px-6">
                  <span
                    aria-hidden="true"
                    className="pt-0.5 font-mono text-xs tabular-nums text-[hsl(var(--fg-tertiary))]"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {t(`landing.compare.row.${row}.old`)}
                </span>
                <span className="flex items-start gap-2 border-s border-[hsl(var(--border-default)/0.7)] bg-[hsl(var(--color-primary)/0.05)] px-4 py-4 text-pretty font-medium text-[hsl(var(--fg-primary))] before:font-bold before:text-[hsl(var(--color-success))] before:content-['✓'] sm:px-6">
                  {t(`landing.compare.row.${row}.new`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
