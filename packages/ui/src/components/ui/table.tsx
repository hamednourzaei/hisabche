'use client'

import * as React from 'react'
import { cn } from '../../lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   Table v2 — Hisabche Design Language
   Zero hardcoded colors — all tokens from design system
   RTL via logical CSS (text-start, ps-/pe-)
   Dense for ERP data, responsive with horizontal scroll
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Table ─────────────────────────────────────────────────────────────────

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-xl border border-[hsl(var(--border-default))]"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
}

// ─── TableHeader ───────────────────────────────────────────────────────────

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b [&_tr]:border-[hsl(var(--border-default))]', className)}
      {...props}
    />
  )
}

// ─── TableBody ─────────────────────────────────────────────────────────────

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

// ─── TableFooter ───────────────────────────────────────────────────────────

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t border-[hsl(var(--border-strong))]',
        'bg-[hsl(var(--surface-muted)/0.6)]',
        'font-semibold',
        '[&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

// ─── TableRow ──────────────────────────────────────────────────────────────

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-[hsl(var(--border-default))]',
        'transition-colors duration-150',
        'hover:bg-[hsl(var(--color-primary)/0.04)]',
        'data-[state=selected]:bg-[hsl(var(--color-primary)/0.08)]',
        'motion-reduce:transition-none',
        className,
      )}
      {...props}
    />
  )
}

// ─── TableHead ─────────────────────────────────────────────────────────────

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-3 text-start align-middle font-semibold whitespace-nowrap',
        'text-[hsl(var(--fg-secondary))] text-xs uppercase tracking-wider',
        'bg-[hsl(var(--surface-muted)/0.4)]',
        '[&:has([role=checkbox])]:pe-0',
        className,
      )}
      {...props}
    />
  )
}

// ─── TableCell ─────────────────────────────────────────────────────────────

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'p-3 align-middle whitespace-nowrap',
        'text-[hsl(var(--fg-primary))]',
        '[&:has([role=checkbox])]:pe-0',
        className,
      )}
      {...props}
    />
  )
}

// ─── TableCaption ──────────────────────────────────────────────────────────

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-3 text-sm', 'text-[hsl(var(--fg-tertiary))]', className)}
      {...props}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
