'use client'

import React, { useEffect, useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'
import { useAdjustOnChange } from '../../hooks/use-adjust-on-change'

/** A number in [0, 1) for confetti piece `index`, channel `k` — fixed, but well spread. */
function spread(index: number, k: number): number {
  return ((index + 1) * 0.6180339887 + k * 0.4142135623) % 1
}

/* ═══════════════════════════════════════════════════════════════════════════
   Celebration v3 — i18n-ready
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CelebrationProps {
  show: boolean
  message: string
  emoji?: string
  duration?: number
  onComplete?: () => void
}

const CONFETTI_COLORS = [
  'bg-[hsl(var(--color-warning))]',
  'bg-[hsl(var(--color-destructive))]',
  'bg-[hsl(var(--color-success))]',
  'bg-[hsl(var(--color-primary))]',
  'bg-[hsl(var(--color-success)/0.7)]',
  'bg-[hsl(var(--color-warning)/0.7)]',
]

const CONFETTI_SIZES = ['size-1.5', 'size-2', 'size-2.5', 'size-1.5', 'size-2', 'size-2.5']

const Celebration: React.FC<CelebrationProps> = ({
  show,
  message,
  emoji = '🎉',
  duration = 3000,
  onComplete,
}) => {
  const [open, setOpen] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const handleComplete = useCallback(() => onComplete?.(), [onComplete])

  // Opens when `show` turns on — during render, not from an effect.
  useAdjustOnChange([show], () => {
    if (show) {
      setOpen(true)
      setIsLeaving(false)
    }
  })

  // While open: fade out after `duration`, then close and report.
  useEffect(() => {
    if (!open) return undefined
    let closing: ReturnType<typeof setTimeout> | undefined
    const leaving = setTimeout(() => {
      setIsLeaving(true)
      closing = setTimeout(() => {
        setOpen(false)
        handleComplete()
      }, 500)
    }, duration)
    return () => {
      clearTimeout(leaving)
      if (closing) clearTimeout(closing)
    }
  }, [open, duration, handleComplete])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50',
            'bg-[hsl(var(--fg-primary)/0.2)]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'motion-reduce:animate-none',
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed z-50 w-full max-w-sm',
            'start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'focus:outline-none',
            'transition-opacity duration-500',
            isLeaving ? 'opacity-0' : 'opacity-100',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2',
            'motion-reduce:animate-none motion-reduce:transition-none',
          )}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'absolute rounded-full',
                  CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  CONFETTI_SIZES[i % CONFETTI_SIZES.length],
                )}
                // A spread by the golden ratio, not Math.random(): render stays pure and the
                // pieces still look scattered.
                style={{
                  top: '-5%',
                  insetInlineStart: `${spread(i, 0) * 100}%`,
                  animation: `confettiFall ${spread(i, 1) * 2 + 2}s linear ${spread(i, 2) * 0.6}s forwards`,
                }}
              />
            ))}
          </div>
          <div className="pointer-events-auto relative z-10 animate-[scaleIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)_forwards] motion-reduce:animate-none">
            <div className="mb-4 text-center text-6xl motion-safe:animate-bounce motion-reduce:animate-none">
              {emoji}
            </div>
            <div
              className={cn(
                'rounded-2xl px-8 py-6',
                'border border-[hsl(var(--border-strong))]',
                'bg-[hsl(var(--surface-elevated))]',
                'shadow-lg',
              )}
            >
              <p className="text-center text-xl font-bold text-[hsl(var(--fg-primary))]">
                {message}
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export { Celebration }
