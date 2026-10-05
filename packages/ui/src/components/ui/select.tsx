'use client'

// ============================================
// packages/ui/src/components/ui/select.tsx
//
// THE select control. `select-field.tsx` wraps it for the common
// value/options case; `unit-select.tsx` and the pickers compose these
// primitives directly. There is no second implementation — see
// `src/__tests__/select-consistency.test.ts`.
//
// ---------------------------------------------------------------------------
// WHAT WAS WRONG, AND WHY IT FROZE THE DASHBOARD
//
// `SelectContent` carried no height bound at all, and the viewport carried
// `h-[var(--radix-select-trigger-height)]` — a FIXED height copied from
// shadcn, not a maximum. So the 25-item currency list (CURRENCY_CODES) behind
// «ثبت نرخ» rendered 25 x 44px of content with nowhere to scroll: the popup
// grew past the viewport and the page went with it.
//
// The bound now lives here, once:
//   - Content  -> `max-h-[var(--radix-select-content-available-height)]`
//                 (Radix measures the space between trigger and screen edge)
//   - Viewport -> `max-h-72 overflow-y-auto` and NO fixed height
//
// Both are single-token arbitrary values. A Tailwind v3 arbitrary value
// containing a comma (`max-h-[min(18rem,var(--x))]`) generates NO CSS at all,
// which is exactly how a bound like this gets silently lost again.
//
// ---------------------------------------------------------------------------
// SEARCH IS THIS COMPONENT'S DECISION, NOT THE CALLER'S
//
// Above `SEARCH_THRESHOLD` items the content grows a filter box. Callers pass
// nothing; that is the point — 25 currencies and every unit list become
// typeable everywhere at once, instead of in the two places someone
// remembered to wire it up.
// ============================================

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { useTranslations } from 'next-intl'
import { cn } from '../../lib/utils'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon } from 'lucide-react'

/**
 * The root of every select in the product.
 *
 * ⚠️ A SELECT IS A DROPDOWN, NOT A DIALOG — AND RADIX TREATS IT AS ONE.
 *
 * Radix locks the page while a select is open: it sets `overflow: hidden` and
 * `position: relative` on <body> and swallows every wheel and touch-move
 * outside the list. Two things followed, on every page:
 *
 *   1. the page froze — it could not be scrolled until the list was closed;
 *   2. if the page had been scrolled, the dashboard header VANISHED. The
 *      header is `position: sticky`; with `overflow: hidden` on <body>, body
 *      becomes its scroll container, body is not scrolled, so the header went
 *      back to the top of the document — off screen.
 *
 * So this root does two things while a select is open:
 *
 *   · marks <html data-select-open>, and `globals.css` undoes the body lock
 *     under that mark — the header stays where it is and nothing shifts;
 *   · closes the list on the first wheel or touch-move outside it, the way a
 *     native dropdown does, so the next movement scrolls the page.
 *
 * A dialog still locks the page: the mark is set by selects only.
 */
function Select({
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>) {
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen ?? false)
  const open = openProp ?? innerOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      setInnerOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange],
  )

  React.useEffect(() => {
    if (!open) return
    const root = document.documentElement
    // Counted, not a boolean: one select can open while another is closing.
    root.dataset.selectOpen = String(Number(root.dataset.selectOpen ?? '0') + 1)

    const closeOnScroll = (event: Event) => {
      const target = event.target
      // Scrolling the list itself is not scrolling the page.
      if (target instanceof Element && target.closest('[data-select-content]')) return
      setOpen(false)
    }
    window.addEventListener('wheel', closeOnScroll, { capture: true, passive: true })
    window.addEventListener('touchmove', closeOnScroll, { capture: true, passive: true })

    return () => {
      window.removeEventListener('wheel', closeOnScroll, { capture: true })
      window.removeEventListener('touchmove', closeOnScroll, { capture: true })
      const left = Number(root.dataset.selectOpen ?? '1') - 1
      if (left > 0) root.dataset.selectOpen = String(left)
      else delete root.dataset.selectOpen
    }
  }, [open, setOpen])

  return <SelectPrimitive.Root {...props} open={open} onOpenChange={setOpen} />
}
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

/** Below this a filter box is more chrome than help. */
const SEARCH_THRESHOLD = 8

/**
 * The repo-wide `safeT`. next-intl here is configured with a
 * `getMessageFallback` that returns the dotted key, and the desktop shim does
 * the same, so comparing against the key is how a component knows to show its
 * own copy rather than printing `select.searchPlaceholder` at the user.
 */
function useSafeT(): (key: string, fallback: string) => string {
  const t = useTranslations()
  return React.useCallback(
    (key: string, fallback: string) => {
      try {
        const value = t(key)
        return value === key ? fallback : value
      } catch {
        return fallback
      }
    },
    [t],
  )
}

// ─── Trigger ───────────────────────────────────────────────────────────────

/**
 * FIXED height, and only two of them.
 *
 * `min-h-[44px]` was here before, which meant a caller writing `h-9` — the
 * height every sidebar row and header control uses — still got a 44px control,
 * because `min-height` beats `height`. Both dashboard pickers did exactly
 * that and both were silently wrong.
 */
const TRIGGER_SIZE = {
  default: 'h-9 px-3 text-sm',
  compact: 'h-8 px-2.5 text-xs',
} as const

export type SelectTriggerSize = keyof typeof TRIGGER_SIZE

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    size?: SelectTriggerSize | undefined
  }
>(({ className, children, size = 'default', ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex w-full items-center justify-between gap-2',
      TRIGGER_SIZE[size],
      'rounded-xl',
      'border border-[hsl(var(--border-default))]',
      'bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]',
      'hover:border-[hsl(var(--border-strong))] hover:bg-[hsl(var(--surface-muted))]',
      'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary)/0.4)] focus:ring-offset-1',
      'disabled:cursor-not-allowed disabled:opacity-40',
      'transition-colors duration-200',
      'motion-reduce:transition-none',
      // A long value must not push the arrow out of a fixed-height control.
      '[&>span]:truncate [&>span]:text-start',
      'text-start',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon className="size-4 shrink-0 text-[hsl(var(--fg-secondary))]" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

// ─── Filtering ─────────────────────────────────────────────────────────────

/**
 * The text a user would type to find this option.
 *
 * Items in this product are `<SelectItem>{label}</SelectItem>` where the label
 * is a string or a small fragment, so reading the children is enough; a caller
 * rendering something richer can say so with Radix's own `textValue`, which is
 * the prop screen readers already use for the same purpose.
 */
function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join(' ')
  if (React.isValidElement(node)) {
    const props = node.props as { textValue?: unknown; children?: React.ReactNode }
    if (typeof props.textValue === 'string') return props.textValue
    return nodeText(props.children)
  }
  return ''
}

// Deliberately NOT a type predicate. A predicate narrows the ELSE branch to
// `never` after the first check, and these are chained — the second `isType`
// call would then be a type error rather than a question.
const isType = (node: React.ReactNode, ...types: unknown[]): boolean =>
  React.isValidElement(node) && types.includes(node.type)

const childrenOf = (node: React.ReactNode): React.ReactNode =>
  React.isValidElement(node) ? (node.props as { children?: React.ReactNode }).children : undefined

function countItems(children: React.ReactNode): number {
  let total = 0
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (isType(child, SelectItem, SelectPrimitive.Item)) total += 1
    else if (isType(child, SelectGroup, SelectPrimitive.Group, React.Fragment)) {
      total += countItems(childrenOf(child))
    }
  })
  return total
}

/**
 * Keeps matching items, keeps a group only while it still has one, and leaves
 * everything else (separators, labels) alone.
 *
 * The empty query short-circuits so the untouched children — and therefore
 * Radix's own element identities — are handed straight through when nobody has
 * typed anything.
 */
function filterItems(children: React.ReactNode, query: string): React.ReactNode {
  if (query === '') return children
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') return children

  const out: React.ReactNode[] = []
  React.Children.forEach(children, (child) => {
    if (isType(child, SelectItem, SelectPrimitive.Item)) {
      if (nodeText(child).toLocaleLowerCase().includes(needle)) out.push(child)
      return
    }
    if (isType(child, SelectGroup, SelectPrimitive.Group, React.Fragment)) {
      const inner = filterItems(childrenOf(child), query)
      if (countItems(inner) > 0) {
        out.push(React.cloneElement(child as React.ReactElement, undefined, inner))
      }
      return
    }
    // A rule between two lists means nothing once the lists have been cut
    // down; a group's own label is kept, because it still says what the
    // surviving rows are.
    if (isType(child, SelectSeparator, SelectPrimitive.Separator)) return
    out.push(child)
  })
  return out
}

// ─── Content ───────────────────────────────────────────────────────────────

export interface SelectContentOwnProps {
  /**
   * Force the filter box on or off. Left alone it appears above
   * `SEARCH_THRESHOLD` options, which is the behaviour every caller should
   * want and none of them should have to ask for.
   */
  searchable?: boolean | undefined
}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & SelectContentOwnProps
>(({ className, children, position = 'popper', searchable, ...props }, ref) => {
  const t = useSafeT()
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const total = React.useMemo(() => countItems(children), [children])
  const showSearch = searchable ?? total >= SEARCH_THRESHOLD
  const visible = React.useMemo(
    () => (showSearch ? filterItems(children, query) : children),
    [children, query, showSearch],
  )
  const empty = showSearch && query.trim() !== '' && countItems(visible) === 0

  // Radix moves focus to the checked item when the content opens. Claiming it
  // back has to happen AFTER that, and in an effect — never during render.
  React.useEffect(() => {
    if (!showSearch) return
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [showSearch])

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        // The mark `Select` looks for: a wheel inside the list scrolls the list.
        data-select-content=""
        ref={ref}
        position={position}
        className={cn(
          'relative z-50 flex min-w-[180px] flex-col overflow-hidden rounded-xl',
          'p-1.5',
          // THE BOUND. Radix publishes the distance from the trigger to the
          // edge of the screen; without it the popup is as tall as its list.
          'max-h-[var(--radix-select-content-available-height)]',
          'border border-[hsl(var(--border-strong))]',
          'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--fg-primary))]',
          'shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2',
          'data-[side=start]:slide-in-from-end-2',
          'data-[side=end]:slide-in-from-start-2',
          'data-[side=top]:slide-in-from-bottom-2',
          'motion-reduce:animate-none',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=start]:-translate-x-1 data-[side=end]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        {...props}
      >
        {showSearch ? (
          <div className="relative shrink-0 pb-1.5">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--fg-tertiary))]"
              // `start` in a logical property, so it lands on the right in
              // Persian and Dari without a second rule.
              style={{ insetInlineStart: '0.625rem' }}
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('select.searchPlaceholder', 'جستجو…')}
              aria-label={t('select.searchPlaceholder', 'جستجو…')}
              autoComplete="off"
              // Radix owns keyboard handling inside the content: its typeahead
              // would swallow every letter, and its pointer handlers would
              // treat a click in here as a click on an option. Arrows, Enter,
              // Tab and Escape are deliberately let through so the list stays
              // reachable from the box.
              onKeyDown={(event) => {
                if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
                  event.stopPropagation()
                }
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              className={cn(
                'h-8 w-full rounded-lg text-xs text-start',
                'border border-[hsl(var(--border-default))]',
                'bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))]',
                'placeholder:text-[hsl(var(--fg-tertiary))]',
                'outline-none focus:border-[hsl(var(--color-primary))]',
              )}
              style={{ paddingInlineStart: '2rem', paddingInlineEnd: '0.625rem' }}
            />
          </div>
        ) : null}

        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'p-1',
            // The scroller. NOT `h-[…]` — that was the fixed height that made
            // the list unscrollable and let the popup push the page.
            'max-h-72 overflow-y-auto',
            position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]',
          )}
        >
          {visible}
        </SelectPrimitive.Viewport>
        {empty ? (
          <p className="px-3 py-2 text-xs text-start text-[hsl(var(--fg-tertiary))]">
            {t('select.noResults', 'موردی یافت نشد')}
          </p>
        ) : null}
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
SelectContent.displayName = 'SelectContent'

// ─── Label ─────────────────────────────────────────────────────────────────

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'px-3 py-2 text-xs font-semibold text-start',
      'text-[hsl(var(--fg-tertiary))]',
      'uppercase tracking-wider',
      className,
    )}
    {...props}
  />
))
SelectLabel.displayName = 'SelectLabel'

// ─── Item ──────────────────────────────────────────────────────────────────

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center',
      'min-h-9 ps-3 pe-10 py-2 rounded-lg text-sm text-start',
      'text-[hsl(var(--fg-primary))]',
      'data-[highlighted]:bg-[hsl(var(--color-primary)/0.12)]',
      'data-[highlighted]:text-[hsl(var(--fg-primary))]',
      'data-[state=checked]:bg-[hsl(var(--color-success)/0.1)]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-30',
      'transition-colors duration-150',
      'motion-reduce:transition-none',
      className,
    )}
    {...props}
  >
    <span className="absolute end-3 flex size-5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="size-4 text-[hsl(var(--color-success))]" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

// ─── Separator ─────────────────────────────────────────────────────────────

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1.5 h-px', 'bg-[hsl(var(--border-default))]', className)}
    {...props}
  />
))
SelectSeparator.displayName = 'SelectSeparator'

// ─── Scroll Buttons ────────────────────────────────────────────────────────

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1.5',
      'text-[hsl(var(--fg-secondary))]',
      'hover:text-[hsl(var(--fg-primary))]',
      className,
    )}
    {...props}
  >
    <ChevronUpIcon className="size-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = 'SelectScrollUpButton'

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1.5',
      'text-[hsl(var(--fg-secondary))]',
      'hover:text-[hsl(var(--fg-primary))]',
      className,
    )}
    {...props}
  >
    <ChevronDownIcon className="size-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = 'SelectScrollDownButton'

// ═══════════════════════════════════════════════════════════════════════════

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
  SEARCH_THRESHOLD,
}
