import React, { type ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string | undefined
  children?: ReactNode
}

/** Dense per-page toolbar sitting under the global toolbar. */
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[hsl(var(--border-default))] px-4 py-2.5">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-bold">{title}</span>
        {subtitle ? (
          <span className="truncate text-xs text-[hsl(var(--fg-tertiary))]">{subtitle}</span>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">{children}</div>
    </div>
  )
}
