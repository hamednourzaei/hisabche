'use client'

import * as React from 'react'
import { cn } from '../../../lib/utils'
import { ArrowLeftRight, PackageCheck, UserCircle, Wallet, Database } from 'lucide-react'

export interface BusinessFlowSceneProps {
  texts: {
    title: string
    subtitle: string
    saleTitle: string
    saleDesc: string
    inventoryTitle: string
    inventoryDesc: string
    customerTitle: string
    customerDesc: string
    cashTitle: string
    cashDesc: string
    ledgerTitle: string
    ledgerDesc: string
  }
}

const FLOW_STEPS = [
  {
    id: 'sale',
    icon: ArrowLeftRight,
    color: 'text-[hsl(var(--color-primary))]',
    bg: 'bg-[hsl(var(--color-primary)/0.1)]',
    border: 'border-[hsl(var(--color-primary)/0.3)]',
  },
  {
    id: 'inventory',
    icon: PackageCheck,
    color: 'text-[hsl(var(--color-warning))]',
    bg: 'bg-[hsl(var(--color-warning)/0.1)]',
    border: 'border-[hsl(var(--color-warning)/0.3)]',
  },
  {
    id: 'customer',
    icon: UserCircle,
    color: 'text-[hsl(var(--color-info))]',
    bg: 'bg-[hsl(var(--color-info)/0.1)]',
    border: 'border-[hsl(var(--color-info)/0.3)]',
  },
  {
    id: 'cash',
    icon: Wallet,
    color: 'text-[hsl(var(--color-success))]',
    bg: 'bg-[hsl(var(--color-success)/0.1)]',
    border: 'border-[hsl(var(--color-success)/0.3)]',
  },
  {
    id: 'ledger',
    icon: Database,
    color: 'text-[hsl(var(--fg-primary))]',
    bg: 'bg-[hsl(var(--surface-muted))]',
    border: 'border-[hsl(var(--border-default))]',
  },
]

export function BusinessFlowScene({ texts }: BusinessFlowSceneProps) {
  const [activeStep, setActiveStep] = React.useState(0)
  const observerRefs = React.useRef<(HTMLDivElement | null)[]>([])

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'))
            setActiveStep(index)
          }
        })
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    )

    observerRefs.current.forEach((ref) => ref && observer.observe(ref))
    return () => observer.disconnect()
  }, [])

  return (
    <section className="relative w-full bg-[hsl(var(--surface-base))] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="mb-16 text-center md:mb-24">
          <h2
            className="mb-6 font-bold text-[hsl(var(--fg-primary))] tracking-tight"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: '1.1' }}
          >
            {texts.title}
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-[hsl(var(--fg-secondary))] sm:text-xl">
            {texts.subtitle}
          </p>
        </div>

        {/* Sticky Layout */}
        <div className="flex flex-col-reverse items-start gap-12 lg:flex-row lg:gap-24">
          {/* Scrollable Text Columns */}
          <div className="flex w-full flex-col gap-[30vh] pb-[30vh] lg:w-1/2">
            {FLOW_STEPS.map((step, index) => {
              const Icon = step.icon
              const isActive = activeStep === index
              return (
                <div
                  key={step.id}
                  data-index={index}
                  ref={(el) => {
                    observerRefs.current[index] = el
                  }}
                  className={cn(
                    'flex flex-col items-start transition-opacity duration-700',
                    isActive ? 'opacity-100' : 'opacity-30 blur-[2px]',
                  )}
                >
                  <div
                    className={cn(
                      'mb-6 inline-flex rounded-2xl p-4 border shadow-sm',
                      step.bg,
                      step.border,
                    )}
                  >
                    <Icon className={cn('size-8', step.color)} />
                  </div>
                  <h3 className="mb-4 text-3xl font-bold text-[hsl(var(--fg-primary))]">
                    {texts[`${step.id}Title` as keyof typeof texts]}
                  </h3>
                  <p className="text-xl text-[hsl(var(--fg-secondary))] leading-relaxed">
                    {texts[`${step.id}Desc` as keyof typeof texts]}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Sticky Visualizer */}
          <div className="sticky top-24 w-full lg:w-1/2 h-[500px] rounded-[2.5rem] bg-[hsl(var(--surface-muted))] border border-[hsl(var(--border-default))] p-8 overflow-hidden shadow-2xl flex items-center justify-center">
            {/* Ambient Background Glow matching active step color */}
            <div
              className={cn(
                'absolute inset-0 opacity-20 transition-colors duration-1000',
                FLOW_STEPS[activeStep]?.bg,
              )}
            />

            {/* Central Node representing the LIVING LEDGER */}
            <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
              {/* Outer Orbit Rings */}
              <div className="absolute inset-4 rounded-full border border-[hsl(var(--border-default))] border-dashed animate-[spin_60s_linear_infinite]" />
              <div className="absolute inset-12 rounded-full border border-[hsl(var(--border-default))] animate-[spin_40s_linear_infinite_reverse]" />

              {/* Connected Nodes with Deterministic Coordinates (Fixes SSR Hydration Mismatch) */}
              {FLOW_STEPS.map((step, index) => {
                // Static pre-calculated 5-star positions on 140px radius circle
                const NODE_COORDS = [
                  { x: 140, y: 0 },
                  { x: 43.26, y: 133.15 },
                  { x: -113.26, y: 82.29 },
                  { x: -113.26, y: -82.29 },
                  { x: 43.26, y: -133.15 },
                ]
                const coord = NODE_COORDS[index] ?? { x: 0, y: 0 }
                const Icon = step.icon

                // If it's the active step, or a past step (to show accumulation)
                const isActiveOrPast = index <= activeStep

                return (
                  <div
                    key={`node-${step.id}`}
                    className={cn(
                      'absolute flex size-14 items-center justify-center rounded-2xl border transition-all duration-700 shadow-lg',
                      isActiveOrPast
                        ? cn('scale-110', step.bg, step.border)
                        : 'scale-90 bg-[hsl(var(--surface-base))] border-[hsl(var(--border-default))] grayscale opacity-50',
                    )}
                    style={{
                      transform: `translate(${coord.x}px, ${coord.y}px) scale(${isActiveOrPast ? 1.1 : 0.9})`,
                    }}
                  >
                    <Icon
                      className={cn(
                        'size-6',
                        isActiveOrPast ? step.color : 'text-[hsl(var(--fg-tertiary))]',
                      )}
                    />
                  </div>
                )
              })}

              {/* Core Ledger Hub */}
              <div className="relative flex size-24 items-center justify-center rounded-full bg-[hsl(var(--surface-base))] shadow-[0_0_40px_rgba(0,0,0,0.1)] ring-1 ring-[hsl(var(--border-default))] z-10">
                <Database
                  className={cn(
                    'size-10 transition-colors duration-700',
                    activeStep === FLOW_STEPS.length - 1
                      ? 'text-[hsl(var(--fg-primary))] animate-pulse'
                      : 'text-[hsl(var(--fg-secondary))]',
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
