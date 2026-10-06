'use client'

// ============================================
// packages/ui/src/components/ui/developers/check-list.tsx
//
// A list of choices over a closed set of values (scopes, events). Shared by
// the API-key, webhook and OAuth-app forms. `name` is the field the API knows,
// so a server error can point at it.
//
// `allLabel` / `noneLabel` add «همه» / «هیچ‌کدام» above the list. «همه» is
// every value THIS list offers — the server still decides what the person may
// actually grant, and says which ones it refused.
// ============================================

import { cn } from '../../../lib/utils'

export function CheckList<V extends string>({
  values,
  selected,
  onChange,
  label,
  name,
  allLabel,
  noneLabel,
}: {
  values: V[]
  selected: V[]
  onChange: (next: V[]) => void
  label: (value: V) => string
  name: string
  allLabel?: string | undefined
  noneLabel?: string | undefined
}) {
  const all = values.length > 0 && values.every((value) => selected.includes(value))

  return (
    <div className="space-y-2" data-field={name}>
      {allLabel ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={all}
            data-check-all=""
            onClick={() => onChange(all ? [] : [...values])}
            className={cn(
              'inline-flex min-h-9 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
              all
                ? 'border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
                : 'border-[hsl(var(--color-primary)/0.5)] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)]',
            )}
          >
            {allLabel}
          </button>
          {noneLabel && selected.length > 0 && !all ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 text-sm text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]"
            >
              {noneLabel}
            </button>
          ) : null}
          <span className="text-xs tabular-nums text-[hsl(var(--fg-tertiary))]">
            {selected.length} / {values.length}
          </span>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {values.map((value) => {
          const checked = selected.includes(value)
          return (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm text-[hsl(var(--fg-primary))] transition-colors',
                checked
                  ? 'border-[hsl(var(--color-primary)/0.6)] bg-[hsl(var(--color-primary)/0.08)]'
                  : 'border-[hsl(var(--border-default))] hover:bg-[hsl(var(--surface-muted))]',
              )}
            >
              <input
                type="checkbox"
                name={name}
                className="mt-1 accent-[hsl(var(--color-primary))]"
                checked={checked}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...selected, value] : selected.filter((v) => v !== value),
                  )
                }
              />
              <span className="min-w-0">
                <span className="block">{label(value)}</span>
                <code className="block text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
                  {value}
                </code>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
