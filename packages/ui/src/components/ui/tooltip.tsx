'use client'

// ============================================
// packages/ui/src/components/ui/tooltip.tsx
//
// `@radix-ui/react-tooltip` has been a dependency of this package for a while
// with no wrapper around it, so every surface that wanted a tooltip either did
// without or invented one. This is the shared primitive.
//
// It exists because the COLLAPSED sidebar has no labels: the only thing telling
// a person what an icon means is its tooltip, which makes this an
// accessibility requirement rather than a flourish.
// ============================================

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '../../lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-popover overflow-hidden rounded-lg px-2.5 py-1.5 text-xs',
        'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
        'text-[hsl(var(--fg-primary))] shadow-md',
        // 120ms, and nothing at all when the reader asked for less motion.
        'animate-in fade-in-0 zoom-in-95 duration-100 motion-reduce:animate-none',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
