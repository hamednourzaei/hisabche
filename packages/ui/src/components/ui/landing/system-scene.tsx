// packages/ui/src/components/ui/landing/system-scene.tsx
//
// "One system, not a stack of apps": how an operation moves through the
// product, and the single record every screen reads from.
//
// SERVER COMPONENT — no hooks, no handlers, never hydrated.
//
// ⚠️ EVERY STEP IS A SHIPPED MODULE. The flow is the real posting path:
// a sale or purchase moves stock (stock_movements) and posts a double-entry
// voucher in the same database function; reports read those rows. If a step
// is not built, it does not go in this list.
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

export default function SystemScene({ t }: SystemSceneProps) {
  return (
    <section id="system" className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <SectionHeader
          label={t('landing.system.label')}
          title={t('landing.system.title')}
          description={t('landing.system.desc')}
        />

        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-7">
          {STEPS.map(({ icon: Icon, key }) => (
            <li
              key={key}
              className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.6)] p-4 sm:p-5"
            >
              <span className="mb-3 flex size-9 items-center justify-center rounded-lg bg-[hsl(var(--color-primary)/0.1)] text-[hsl(var(--color-primary))] sm:size-10">
                <Icon className="size-[1.125rem] sm:size-5" aria-hidden="true" />
              </span>
              <h3 className="mb-1 font-semibold text-[hsl(var(--fg-primary))]">
                {t(`landing.system.step.${key}.title`)}
              </h3>
              <p className={cn('text-[hsl(var(--fg-secondary))]', LANDING_TYPE.body)}>
                {t(`landing.system.step.${key}.desc`)}
              </p>
            </li>
          ))}
        </ol>

        {/* One source of truth — the consequence of the flow above. */}
        <div className="mt-8 rounded-xl border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.06)] p-5 sm:mt-12 sm:p-8">
          <h3 className={cn('mb-2 font-semibold text-[hsl(var(--fg-primary))]', LANDING_TYPE.h3)}>
            {t('landing.system.truth.title')}
          </h3>
          <p className={cn('max-w-3xl text-[hsl(var(--fg-secondary))]', LANDING_TYPE.lead)}>
            {t('landing.system.truth.desc')}
          </p>
        </div>
      </div>
    </section>
  )
}
