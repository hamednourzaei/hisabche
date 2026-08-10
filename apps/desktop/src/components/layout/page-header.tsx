import React, { type ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string | undefined
  children?: ReactNode
}

/**
 * Per-page header, matching the web page header.
 *
 * The title was `text-sm` (14px) against web's `text-xl sm:2xl lg:3xl` — at
 * desktop width the browser renders 30px, so the same page read as a toolbar
 * label here and as a page title there. Sizes now track web's responsive steps.
 */
export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[hsl(var(--border-default))] px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-xl font-bold sm:text-2xl lg:text-3xl text-[hsl(var(--fg-primary))]">
          {title}
        </h1>
        {subtitle ? (
          <p className="truncate text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">{children}</div>
    </div>
  )
}
