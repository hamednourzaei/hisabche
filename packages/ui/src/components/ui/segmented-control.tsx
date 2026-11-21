'use client'

// ============================================
// A segmented control — «همه | فروش | خرید».
//
// ONE component for «show me this part» inside a page: a few mutually exclusive
// choices, one always selected. The invoice table's type switch and the pricing
// tab's «تخفیف‌ها | فهرست‌های قیمت» are both this.
//
// It is not the hub's tab bar (`HubTabs`): that one moves between screens and
// lives in the address; this one changes what the screen you are on shows.
//
// Do not draw another one. Pass `options`, `value`, `onChange`.
//
// `branch` — this switch is the one that belongs to the hub tab it is under:
// it is placed in the middle of the page, right below the nearest `HubTabs`
// above it, with a line from the selected tab to each choice. With no tab bar
// above it the prop does nothing. ONE branch switch per tab.
//
// `overflowAfter` + `moreLabel` — a switch with more choices than a bar should
// carry keeps the first `overflowAfter` words on it and puts the rest in one
// menu under «بیشتر» (the warehouse's nine stock views: four daily ones, five
// under the button). Every value is still offered, still checked, and still in
// the address; only where it is drawn changes. The button borrows the selected
// hidden choice, so the hub's line can reach it and say where the person is.
//
// ⚠️ A choice never wraps. On a narrow screen the words and the padding get
// smaller (`clamp`) — «فهرست‌های قیمت» on two lines makes a row of pills into
// a ragged block. Under 560px the bar becomes four equal columns with «بیشتر»
// on its own row, and the menu opens in the page instead of over it.
// ============================================

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, MoreHorizontal, type LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'
import { useFitRow } from '../../lib/fit-row'
import { useNearestBranchSlot } from './hub-branch'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Drawn in the «بیشتر» menu only — the bar stays words. */
  icon?: LucideIcon | undefined
}

export interface SegmentedControlProps<T extends string> {
  /** What is being chosen, for a screen reader. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string | undefined
  /** The switch of the selected hub tab: drawn under the tabs, joined by lines. */
  branch?: boolean | undefined
  /** Choices kept on the bar; the rest go under «بیشتر». Omit for no menu. */
  overflowAfter?: number | undefined
  /** The word on the button — «بیشتر». With no word every choice stays on the bar. */
  moreLabel?: string | undefined
}

const BAR =
  'flex w-fit max-w-full gap-1 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-muted))] p-1'

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  branch = false,
  overflowAfter,
  moreLabel,
}: SegmentedControlProps<T>) {
  const { anchor, slot } = useNearestBranchSlot(branch)
  const row = useRef<HTMLDivElement | null>(null)
  const wrap = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const menu = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const menuId = useId()

  const split =
    overflowAfter === undefined
      ? options.length
      : Math.max(0, Math.min(overflowAfter, options.length))
  const hidden = moreLabel === undefined ? [] : options.slice(split)
  const barOptions = hidden.length > 0 ? options.slice(0, split) : options
  const hasMenu = hidden.length > 0
  const currentHidden = hasMenu && hidden.some((option) => option.value === value)

  // Never a sideways scroll, in any language (see lib/fit-row). The button is
  // measured with the words: it is part of the same row.
  useFitRow(
    row,
    [...barOptions.map((option) => option.label), ...(hasMenu ? [moreLabel ?? ''] : [])].join('|') +
      (slot ? '|slot' : ''),
  )

  // A menu, not a dialog: focus goes to the row that is checked, Escape closes
  // and hands the focus back to the button.
  useEffect(() => {
    if (!open) return
    const rows = menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    const checked = rows
      ? [...rows].find((element) => element.getAttribute('aria-checked') === 'true')
      : undefined
    ;(checked ?? rows?.[0])?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open])

  const choose = (next: T) => {
    setOpen(false)
    onChange(next)
    trigger.current?.focus()
  }

  const onMenuKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const rows = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
    if (rows.length === 0) return
    const at = rows.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      rows[(at + step + rows.length) % rows.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      rows[event.key === 'Home' ? 0 : rows.length - 1]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
  }

  const tab = (option: SegmentedOption<T>) => {
    const active = value === option.value
    return (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={active}
        // The guide's marker for a section switch (guide-catalog.ts).
        data-guide-view={option.value}
        data-guide-active={active ? '' : undefined}
        onClick={() => {
          setOpen(false)
          onChange(option.value)
        }}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-[var(--fit-px,clamp(0.5rem,2.6vw,1rem))] py-1.5 text-[length:var(--fit-font,clamp(0.6875rem,3vw,0.875rem))] font-medium transition-colors motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
          active
            ? 'bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-fg))]'
            : 'text-[hsl(var(--fg-secondary))] hover:text-[hsl(var(--fg-primary))]',
        )}
      >
        {option.label}
      </button>
    )
  }

  const control = hasMenu ? (
    <div ref={wrap} className="relative w-full max-w-full min-[560px]:w-fit">
      <div
        ref={row}
        className={cn(
          BAR,
          'w-full flex-col gap-1 min-[560px]:w-fit min-[560px]:flex-row min-[560px]:items-center',
          className,
        )}
      >
        <div
          role="radiogroup"
          aria-label={label}
          className="grid gap-1 min-[560px]:flex min-[560px]:items-center"
          style={{ gridTemplateColumns: `repeat(${barOptions.length}, minmax(0, 1fr))` }}
        >
          {barOptions.map(tab)}
        </div>
        <span
          aria-hidden="true"
          className="my-1.5 hidden h-px w-full bg-[hsl(var(--border-strong))] min-[560px]:mx-0.5 min-[560px]:my-0 min-[560px]:block min-[560px]:h-[18px] min-[560px]:w-px"
        />
        <button
          ref={trigger}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          // `HubBranchStrip` reads this pair: the line reaches «بیشتر» only
          // while it is the one holding the selected hidden choice.
          data-branch-proxy=""
          data-branch-selected={currentHidden ? '' : undefined}
          onClick={() => setOpen((was) => !was)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
            }
          }}
          className={cn(
            'inline-flex min-h-[34px] w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border-t border-[hsl(var(--border-default))] px-2.5 text-[length:var(--fit-font,clamp(0.6875rem,3vw,0.875rem))] font-medium transition-colors motion-reduce:transition-none',
            'max-[559px]:rounded-t-none',
            'min-[560px]:w-auto min-[560px]:border-t-0',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
            'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--fg-primary))]',
            open && 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]',
            currentHidden &&
              'bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] hover:text-[hsl(var(--color-primary))]',
          )}
        >
          <MoreHorizontal className="size-4 shrink-0" aria-hidden="true" />
          <span>{moreLabel}</span>
          {currentHidden ? (
            <span className="inline-flex rounded-full bg-[hsl(var(--color-primary)/0.14)] px-1.5 py-0.5 text-[10px] font-bold leading-4 text-[hsl(var(--color-primary))] min-[560px]:hidden">
              {hidden.find((option) => option.value === value)?.label}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              'size-[5px] shrink-0 rounded-full bg-[hsl(var(--color-primary))] ring-[3px] ring-[hsl(var(--color-primary)/0.14)]',
              currentHidden ? 'inline-block max-[559px]:hidden' : 'hidden',
            )}
          />
          <ChevronDown
            className={cn(
              'size-[13px] shrink-0 opacity-85 transition-transform motion-reduce:transition-none',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      {/* The guide opens a section through the address and waits for its
          marker: a hidden choice keeps one even while the menu is closed. */}
      {hidden.map((option) => (
        <span
          key={option.value}
          hidden
          data-guide-view={option.value}
          data-guide-active={option.value === value ? '' : undefined}
        />
      ))}
      {open ? (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeys}
          className={cn(
            'mt-1 w-full overflow-hidden rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] shadow-lg',
            'animate-in fade-in slide-in-from-top-1 duration-150 motion-reduce:animate-none',
            'min-[560px]:absolute min-[560px]:end-1 min-[560px]:top-full min-[560px]:mt-1.5 min-[560px]:w-[248px]',
          )}
        >
          {hidden.map((option) => {
            const Icon = option.icon
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(option.value)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-start text-[12.5px] font-medium leading-tight transition-colors motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[hsl(var(--color-primary))]',
                  active
                    ? 'bg-[hsl(var(--color-primary)/0.08)] text-[hsl(var(--color-primary))]'
                    : 'text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]',
                )}
              >
                {Icon ? (
                  <span
                    className={cn(
                      'grid size-[18px] shrink-0 place-items-center',
                      active
                        ? 'text-[hsl(var(--color-primary))]'
                        : 'text-[hsl(var(--fg-secondary))]',
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">{option.label}</span>
                <Check
                  className={cn(
                    'size-[15px] shrink-0 text-[hsl(var(--color-primary))]',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  ) : (
    <div ref={row} role="radiogroup" aria-label={label} className={cn(BAR, className)}>
      {options.map(tab)}
    </div>
  )

  // Not the tab's own switch, or no tab bar above it: where it was written.
  if (slot === undefined) return control
  // The anchor marks where it was written; the switch itself is drawn under
  // the tabs. Before the slot is found only the anchor renders — on the
  // server too.
  return (
    <>
      <span ref={anchor} hidden data-branch-anchor="" />
      {slot ? createPortal(control, slot) : null}
    </>
  )
}
