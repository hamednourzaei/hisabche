'use client'

import * as React from 'react'
import { cn } from '../../../lib/utils'
import { Wifi, WifiOff, CloudSync, CheckCircle2 } from 'lucide-react'

export interface OfflineSyncSceneProps {
  texts: {
    title: string
    subtitle: string
    step1: string
    step2: string
    desc2: string
    step3: string
    step4: string
  }
}

export function OfflineSyncScene({ texts }: OfflineSyncSceneProps) {
  const [isInView, setIsInView] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true)
        }
      },
      { threshold: 0.3 },
    )
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={containerRef}
      className="relative w-full bg-[hsl(var(--surface-base))] py-24 sm:py-32 overflow-hidden"
    >
      {/* Dynamic Background: goes dark when offline is simulated */}
      <div
        className={cn(
          'absolute inset-0 transition-colors duration-2000',
          isInView ? 'bg-[hsl(var(--surface-muted))]' : 'bg-transparent',
        )}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h2
          className="mb-6 font-bold text-[hsl(var(--fg-primary))] tracking-tight"
          style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: '1.1' }}
        >
          {texts.title}
        </h2>
        <p className="mx-auto mb-16 max-w-2xl text-lg text-[hsl(var(--fg-secondary))] sm:text-xl">
          {texts.subtitle}
        </p>

        {/* Cinematic Status Visualization */}
        <div className="mx-auto max-w-4xl rounded-3xl bg-[hsl(var(--surface-muted))] border border-[hsl(var(--border-default))] p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
            {/* Step 1: Online */}
            <div
              className={cn(
                'flex flex-col items-center gap-4 transition-all duration-1000',
                isInView ? 'opacity-30' : 'opacity-100',
              )}
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]">
                <Wifi className="size-8" />
              </div>
              <div className="text-sm font-semibold">{texts.step1}</div>
            </div>

            {/* Connecting Line */}
            <div className="hidden sm:block h-px w-full max-w-[100px] bg-gradient-to-r from-[hsl(var(--color-success))] to-[hsl(var(--color-destructive))] opacity-50" />

            {/* Step 2: Connection Lost */}
            <div
              className={cn(
                'flex flex-col items-center gap-4 transition-all duration-1000 delay-500',
                isInView ? 'opacity-100 scale-110' : 'opacity-30 scale-90',
              )}
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-[hsl(var(--color-destructive)/0.1)] text-[hsl(var(--color-destructive))] relative">
                {isInView && (
                  <span className="absolute inset-0 rounded-full border border-[hsl(var(--color-destructive))] animate-ping" />
                )}
                <WifiOff className="size-8 relative z-10" />
              </div>
              <div className="text-sm font-semibold">{texts.step2}</div>
              <div className="absolute top-full mt-2 text-xs text-[hsl(var(--fg-tertiary))] whitespace-nowrap">
                {texts.desc2}
              </div>
            </div>

            {/* Connecting Line */}
            <div className="hidden sm:block h-px w-full max-w-[100px] bg-gradient-to-r from-[hsl(var(--color-destructive))] to-[hsl(var(--color-warning))] opacity-50" />

            {/* Step 3: Cloud Sync */}
            <div
              className={cn(
                'flex flex-col items-center gap-4 transition-all duration-1000 delay-1000',
                isInView ? 'opacity-100' : 'opacity-30',
              )}
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-[hsl(var(--color-warning)/0.1)] text-[hsl(var(--color-warning))]">
                <CloudSync className={cn('size-8', isInView && 'animate-spin-slow')} />
              </div>
              <div className="text-sm font-semibold">{texts.step3}</div>
            </div>

            {/* Connecting Line */}
            <div className="hidden sm:block h-px w-full max-w-[100px] bg-gradient-to-r from-[hsl(var(--color-warning))] to-[hsl(var(--color-success))] opacity-50" />

            {/* Step 4: Synced */}
            <div
              className={cn(
                'flex flex-col items-center gap-4 transition-all duration-1000 delay-[3000ms]',
                isInView ? 'opacity-100' : 'opacity-30',
              )}
            >
              <div className="flex size-16 items-center justify-center rounded-full bg-[hsl(var(--color-success)/0.1)] text-[hsl(var(--color-success))]">
                <CheckCircle2 className="size-8" />
              </div>
              <div className="text-sm font-semibold">{texts.step4}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
