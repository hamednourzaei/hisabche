'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   Checkbox v1 — Hisabche Design Language
   ✅ Built on @radix-ui/react-checkbox
   ✅ Zero hardcoded colors — all tokens from design system
   ✅ Focus ring & touch friendly
   ═══════════════════════════════════════════════════════════════════════════ */

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer h-4 w-4 shrink-0 rounded-md border border-[hsl(var(--border-default))]',
      'bg-[hsl(var(--surface-base))]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary)/0.5)] focus-visible:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'data-[state=checked]:bg-[hsl(var(--color-primary))] data-[state=checked]:border-[hsl(var(--color-primary))] data-[state=checked]:text-white',
      'transition-colors duration-150',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <Check className="size-3.5 stroke-[3]" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
