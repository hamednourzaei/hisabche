'use client'

import type { ReactNode } from 'react'

export interface ExpressCardProps {
  title: string
  children: ReactNode
}

export function ExpressCard({ title, children }: ExpressCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-4 text-start">
      <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{title}</h4>
      <div className="flex flex-1 flex-col gap-2.5">{children}</div>
    </div>
  )
}

export function ExpressResultBox({
  label,
  data,
  error,
}: {
  label: string
  data: unknown
  error?: string | null | undefined
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-[hsl(var(--color-destructive)/0.4)] bg-[hsl(var(--color-destructive)/0.08)] px-3 py-2 text-xs text-[hsl(var(--color-destructive))]"
      >
        {error}
      </p>
    )
  }
  if (data === undefined || data === null) return null
  return (
    <div className="rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-2.5 text-xs">
      <div className="mb-1 font-medium text-[hsl(var(--fg-secondary))]">{label}</div>
      <pre
        dir="ltr"
        className="max-h-36 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[hsl(var(--fg-primary))]"
      >
        {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
