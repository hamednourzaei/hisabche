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
  BarChart3,
  BookOpenCheck,
  FileText,
  HandCoins,
  Landmark,
  Package,
  ShoppingCart,
} from 'lucide-react'

import { cn } from '../../../lib/utils'
import { StepChain } from './chapter-visuals'
import {
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

/**
 * The arrow to the next step is each card's ::after — ↓ in the phone column,
 * ← / → (by writing direction) in the desktop row. CSS text, no extra element.
 */
const STEP_ARROW = [
  "after:absolute after:inset-x-0 after:top-full after:text-center after:text-sm after:leading-6 after:text-[hsl(var(--color-primary))] after:content-['↓'] last:after:content-none",
  "lg:after:inset-x-auto lg:after:start-full lg:after:top-1/2 lg:after:w-5 lg:after:-translate-y-1/2 lg:after:leading-none lg:after:content-['←'] ltr:lg:after:content-['→'] lg:last:after:content-none",
].join(' ')

export default function SystemScene({ t }: SystemSceneProps) {
  return (
    <section id="system" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          label={t('landing.system.label')}
          title={t('landing.system.title')}
          description={t('landing.system.desc')}
        />

        <ol className="mx-auto flex max-w-md flex-col gap-6 lg:max-w-none lg:flex-row lg:gap-5">
          {STEPS.map(({ icon: Icon, key }) => (
            <li
              key={key}
              className={cn(
                'relative flex items-center gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3.5 py-3',
                'lg:min-w-0 lg:flex-1 lg:flex-col lg:items-start lg:gap-2 lg:p-3',
                STEP_ARROW,
              )}
            >
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
