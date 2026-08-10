'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   Label v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   ═══════════════════════════════════════════════════════════════════════════ */

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2',
        'text-sm font-medium leading-none',
        'text-[hsl(var(--fg-primary))]',
        'select-none',
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-40',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
