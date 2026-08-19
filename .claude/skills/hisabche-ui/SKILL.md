---
name: hisabche-ui
description: Building or changing any screen, component, table, form or visual element in web, desktop or admin. Covers the shared UI package, design tokens, the shared DataTable and web/desktop parity.
---

# Shared UI and design system

## One implementation, three consumers

`packages/ui` is the UI for **web, desktop and admin**. None of them keeps a
copy. Before writing a screen, look for it:

```bash
ls packages/ui/src/components/ui/
```

Screens are container + view pairs. Containers own data and navigation; views
are presentational. Both are exported from `packages/ui/src/screens.ts`, which
is what desktop mounts.

Desktop's routes mirror web's paths exactly (`/invoices`, `/quick-invoice`,
`/warehouse/:id`), so a container can push `/customers/${id}` and work on both.
**Keep that alignment** — a new web route needs the matching desktop route in
`apps/desktop/src/app/app.tsx`.

`packages/ui` must stay self-contained: relative imports only, never `@/`. It
once imported `@/lib/utils`, which resolved into the _consuming app's_
directory, so shared components silently used web's stripped-down `cn`.

Mobile does not use this package. It has `packages/mobile-ui` and native
screens. Parity there means same words, same information hierarchy, same
states — adapted, not ported (table → cards, modal → bottom sheet).

## Tokens

`packages/design-tokens` is authoritative. Consume through CSS variables:

```tsx
className="bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]
           border-[hsl(var(--border-default))] rounded-[var(--radius-md)]"
```

Semantic names only — `--color-primary`, `--color-success`,
`--color-destructive`, `--fg-primary/secondary/tertiary`,
`--surface-base/elevated/muted`, `--border-default/strong`. No raw hex, no
literal px where a radius or spacing token exists.

Token parity between web and mobile is enforced by tests in
`packages/mobile-ui/src/tokens/__tests__/`. Never weaken them to land a change.

## Tables — always the shared one

Every list uses `DataTable` from `packages/ui/src/components/ui/data-table/`.
Do not build a new table.

It gives you column visibility, sorting, responsive hiding, a toolbar, and
opt-in selection:

```tsx
const selection = useRowSelection()
const bulkDelete = useBulkAction(useCallback(async (id) => onDelete(id), [onDelete]))

useEffect(() => { selection.prune(ids) }, [ids, selection])   // drop vanished rows

<DataTable
  tableId="invoices" t={t} rows={rows} columns={columns} rowKey={(r) => r.id}
  searchValue={search} onSearchChange={setSearch}
  selectedIds={selection.selectedIds}
  onToggleRow={selection.toggleRow}
  onToggleAll={selection.toggleAll}
  bulkBar={<BulkActionBar t={t} selectedCount={selection.selectedCount} … />}
/>
```

Omitting `selectedIds` leaves the table exactly as before — selection is opt-in.

There is no bulk API endpoint; `useBulkAction` runs the per-item mutation in
batches of 5 with `allSettled`, so partial failure is reported honestly. Any
destructive bulk action must go through `BulkActionBar`'s confirm step.

`TableColumn` needs `labelKey` + `labelFallback` — the header is translated.

## KPI cards

`BentoStats` renders the four-card row. Amounts are shown **in full** (never
abbreviated to millions) with no currency suffix — the user picked their
currency at onboarding. Long numbers shrink their font rather than overflow.

## Rules

- Reuse before creating. No second Button/Input/Card/Modal/Table.
- Radix for behaviour (dialog, dropdown, select, tabs, popover) — already a dependency.
- Icons from `lucide-react` on web/desktop, `@expo/vector-icons` on mobile.
- Logical properties for RTL (`ms-`, `pe-`, `start-`), never `ml-`/`left-`.
- `motion-reduce:` alongside every transition or animation.
- Never render a currency code next to a number in a table or KPI card.
- A leaf component rendering server data must tolerate missing fields. `Avatar`
  crashing on an absent name took down the whole invoice list.

## Validation

```bash
cd packages/ui && npx tsc --noEmit && npx vitest run
cd apps/web && npx next build
cd apps/desktop && npx electron-vite build     # catches shim/import breakage
```

## Common mistakes

- Building a page-specific table instead of using `DataTable`.
- `@/` imports inside `packages/ui`.
- Adding a web route without the desktop route.
- Hardcoded colors, or `text-gray-500` where a semantic token exists.
- Assuming a prop typed `string` is present at runtime — server data is optional.
