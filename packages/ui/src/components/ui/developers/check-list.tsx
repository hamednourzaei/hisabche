'use client'

// ============================================
// packages/ui/src/components/ui/developers/check-list.tsx
//
// A list of checkboxes over a closed set of values (scopes, events). Shared by
// the API-key, webhook and OAuth-app forms. `name` is the field the API knows,
// so a server error can point at it.
// ============================================

export function CheckList<V extends string>({
  values,
  selected,
  onChange,
  label,
  name,
}: {
  values: V[]
  selected: V[]
  onChange: (next: V[]) => void
  label: (value: V) => string
  name: string
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-field={name}>
      {values.map((value) => (
        <label key={value} className="flex items-start gap-2 text-sm text-[hsl(var(--fg-primary))]">
          <input
            type="checkbox"
            name={name}
            className="mt-1"
            checked={selected.includes(value)}
            onChange={(e) =>
              onChange(
                e.target.checked ? [...selected, value] : selected.filter((v) => v !== value),
              )
            }
          />
          <span>
            {label(value)}
            <code className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]" dir="ltr">
              {value}
            </code>
          </span>
        </label>
      ))}
    </div>
  )
}
