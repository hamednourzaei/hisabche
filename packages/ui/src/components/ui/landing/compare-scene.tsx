// packages/ui/src/components/ui/landing/compare-scene.tsx
//
// "From scattered methods to one real system": the old way of keeping books
// beside what the product does instead. SERVER COMPONENT — never hydrated.
//
// No competitor is named, and every right-hand cell is a shipped capability
// (connected posting, offline apps, role permissions, audit trail).
// Rendered as a two-column grid, not a <table>: it must fit a 360px phone
// without scrolling sideways (landing-i18n-keys.test.ts, mobile-first guard).
import { Check, Minus } from 'lucide-react'

import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

export interface CompareSceneProps {
  t: (key: string, fallback?: string) => string
}

const ROWS = ['books', 'reentry', 'internet', 'lateReports', 'access', 'changes'] as const

export default function CompareScene({ t }: CompareSceneProps) {
  return (
    <section id="compare" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          label={t('landing.compare.label')}
          title={t('landing.compare.title')}
          description={t('landing.compare.desc')}
        />

        <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-[hsl(var(--border-default))]">
          <div className="grid grid-cols-2 bg-[hsl(var(--surface-muted)/0.6)] text-sm font-semibold">
            <p className="px-4 py-3 text-[hsl(var(--fg-secondary))] sm:px-6">
              {t('landing.compare.old')}
            </p>
            <p className="border-s border-[hsl(var(--border-default))] px-4 py-3 text-[hsl(var(--color-primary))] sm:px-6">
              {t('landing.compare.new')}
            </p>
          </div>
          <ul>
            {ROWS.map((row) => (
              <li
                key={row}
                className="grid grid-cols-2 border-t border-[hsl(var(--border-default))] text-sm sm:text-base"
              >
                <span className="flex items-start gap-2 px-4 py-3 text-[hsl(var(--fg-secondary))] sm:px-6">
                  <Minus
                    className="mt-1 size-4 shrink-0 text-[hsl(var(--fg-tertiary))]"
                    aria-hidden="true"
                  />
                  {t(`landing.compare.row.${row}.old`)}
                </span>
                <span className="flex items-start gap-2 border-s border-[hsl(var(--border-default))] bg-[hsl(var(--color-primary)/0.04)] px-4 py-3 font-medium text-[hsl(var(--fg-primary))] sm:px-6">
                  <Check
                    className="mt-1 size-4 shrink-0 text-[hsl(var(--color-success))]"
                    aria-hidden="true"
                  />
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
