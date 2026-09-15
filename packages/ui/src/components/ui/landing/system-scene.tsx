// packages/ui/src/components/ui/landing/system-scene.tsx
//
// "One operation. One financial truth." — how an operation moves through the
// product, and how any number traces back to its source document.
//
// SERVER COMPONENT — no hooks, no handlers, never hydrated.
//
// ⚠️ EVERY STEP IS SHIPPED BEHAVIOUR:
//   flow  → a sale or purchase moves stock (stock_movements) and posts a
//           double-entry voucher in the same database function
//   trace → a ledger line carries sourceType/sourceId and links to its document
//           (accounting/components/JournalEntryRow.tsx → routeForEntity)
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDown,
  BarChart3,
  BookOpenCheck,
  FileText,
  HandCoins,
  Landmark,
  Package,
  ShoppingCart,
} from 'lucide-react'
import { Fragment } from 'react'

import { cn } from '../../../lib/utils'
import { StepChain } from './chapter-visuals'
import {
  ForwardArrow,
  LANDING_CONTAINER,
  LANDING_SECTION,
  LANDING_TYPE,
  SectionHeader,
} from './landing-primitives'

export interface SystemSceneProps {
  t: (key: string, fallback?: string) => string
}

const STEPS: Array<{ icon: LucideIcon; key: string }> = [
  { icon: ShoppingCart, key: 'sell' },
  { icon: FileText, key: 'invoice' },
  { icon: HandCoins, key: 'pay' },
  { icon: Landmark, key: 'cash' },
  { icon: Package, key: 'stock' },
  { icon: BookOpenCheck, key: 'post' },
  { icon: BarChart3, key: 'report' },
]

export default function SystemScene({ t }: SystemSceneProps) {
  return (
    <section id="system" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          label={t('landing.system.label')}
          title={t('landing.system.title')}
          description={t('landing.system.desc')}
        />

        {/* The flow: one row with arrows on desktop, a column with down-arrows
            below `lg` — the arrow always points at the next thing that happens.
            Arrows are decoration (aria-hidden); the <ol> carries the order. */}
        <ol className="mx-auto flex max-w-md flex-col items-stretch lg:max-w-none lg:flex-row lg:items-stretch">
          {STEPS.map(({ icon: Icon, key }, i) => (
            <Fragment key={key}>
              <li className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3.5 py-3 lg:min-w-0 lg:flex-1 lg:flex-col lg:items-start lg:gap-2 lg:p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold leading-snug text-[hsl(var(--fg-primary))]">
                    {t(`landing.system.step.${key}.title`)}
                  </h3>
                  <p className="text-xs leading-relaxed text-[hsl(var(--fg-tertiary))]">
                    {t(`landing.system.step.${key}.desc`)}
                  </p>
                </div>
              </li>
              {i < STEPS.length - 1 && (
                <li
                  aria-hidden="true"
                  className="flex shrink-0 items-center justify-center py-1 text-[hsl(var(--color-primary))] lg:px-1 lg:py-0"
                >
                  <ArrowDown className="size-4 lg:hidden" />
                  <span className="hidden lg:contents">
                    <ForwardArrow />
                  </span>
                </li>
              )}
            </Fragment>
          ))}
        </ol>

        {/* Every number has a story: from the dashboard back to the document. */}
        <div className="mt-10 rounded-2xl border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.06)] px-4 py-8 text-center sm:mt-14 sm:px-10 sm:py-10">
          <h3
            className={cn(
              'mb-2 text-balance font-bold tracking-tight text-[hsl(var(--fg-primary))]',
              LANDING_TYPE.h3,
            )}
          >
            {t('landing.system.trace.title')}
          </h3>
          <p
            className={cn(
              'mx-auto mb-6 max-w-xl text-pretty text-[hsl(var(--fg-secondary))]',
              LANDING_TYPE.body,
            )}
          >
            {t('landing.system.trace.desc')}
          </p>
          <StepChain t={t} prefix="landing.system.trace.step" count={6} />
        </div>
      </div>
    </section>
  )
}
