// ============================================
// «انبار» › the stock switch: four daily views on the bar, five under «بیشتر».
//
// What can go wrong: a capability leaving with the words; a hidden view losing
// its `?view=` address; «بیشتر» not showing that it owns the selection; the
// connector line pointing into the second row on a phone; the guide no longer
// finding a hidden view; the bar reordering the DATA and moving the default
// screen; a new address parameter growing beside the old one.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  STOCK_SECTION_BAR_COUNT,
  STOCK_SECTION_BAR_ORDER,
  STOCK_SECTIONS,
} from '../components/ui/warehouse/containers/warehouse-tabs-container'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. Flattened: the formatter wraps. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

const hub = ui('warehouse', 'containers', 'warehouse-tabs-container.tsx')
const control = ui('segmented-control.tsx')
const branch = ui('hub-branch.tsx')

describe('four direct, five in the menu, nine alive', () => {
  it('the bar keeps the daily four, in the approved order', () => {
    expect(STOCK_SECTION_BAR_COUNT).toBe(4)
    expect(STOCK_SECTION_BAR_ORDER.slice(0, STOCK_SECTION_BAR_COUNT)).toEqual([
      'products',
      'warehouses',
      'shelfMap',
      'transfers',
    ])
  })

  it('the menu holds the periodic five, in the approved order', () => {
    expect(STOCK_SECTION_BAR_ORDER.slice(STOCK_SECTION_BAR_COUNT)).toEqual([
      'holds',
      'reorder',
      'deadStock',
      'rfqs',
      'consignments',
    ])
  })

  it('the bar order is the same nine values — nothing dropped, nothing invented', () => {
    expect(STOCK_SECTION_BAR_ORDER).toHaveLength(STOCK_SECTIONS.length)
    expect([...STOCK_SECTION_BAR_ORDER].sort()).toEqual([...STOCK_SECTIONS].sort())
  })

  it('the data order — and with it the default `?view` — is untouched', () => {
    // `useHubSection` takes the FIRST offered section as the page's own view;
    // putting the catalogue first on the bar must not move the default screen.
    expect([...STOCK_SECTIONS].slice(0, 2)).toEqual(['warehouses', 'products'])
    expect(hub).toContain('useHubSection(offeredStockSections, STOCK_SECTION_CLEARS)')
  })
})

describe('the word and the address', () => {
  it('the hub passes the four and the one existing word for «بیشتر»', () => {
    expect(hub).toContain('overflowAfter={STOCK_SECTION_BAR_COUNT}')
    expect(hub).toContain("moreLabel={t('nav.more')}")
    expect(hub).toContain('options={STOCK_SECTION_BAR_ORDER.map((value) => ({')
  })

  it('no second address mechanism: the switch still writes ?view=', () => {
    expect(hub).not.toContain('useAddressChoice(')
    expect(hub).toContain('useHubSection(')
  })

  it('every label and the word still exist in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      for (const section of STOCK_SECTION_BAR_ORDER) {
        expect(words.warehouseHub.sections[section], `${lang} ${section}`).toEqual(
          expect.any(String),
        )
      }
      expect(words.nav.more, `${lang} nav.more`).toEqual(expect.any(String))
    }
  })
})

describe('«بیشتر» says what it owns — and the line reaches it', () => {
  it('the trigger carries the choice and opens a real menu', () => {
    expect(control).toContain('data-branch-proxy=""')
    expect(control).toContain("data-branch-selected={currentHidden ? '' : undefined}")
    expect(control).toContain('aria-haspopup="menu"')
    expect(control).toContain('aria-expanded={open}')
    expect(control).toContain('aria-controls={open ? menuId : undefined}')
  })

  it('the menu is a menu of radios, closable from the keyboard', () => {
    expect(control).toContain('role="menu"')
    expect(control).toContain('role="menuitemradio"')
    expect(control).toContain('aria-checked={active}')
    expect(control).toContain("event.key === 'Escape'")
    expect(control).toContain('min-h-11')
  })

  it('the hub line ends on «بیشتر» only while it holds the choice, never from the row below', () => {
    expect(branch).toContain("slot.querySelector<HTMLElement>('[data-branch-proxy]')")
    expect(branch).toContain("proxy?.hasAttribute('data-branch-selected')")
    expect(branch).toContain('< 8')
  })

  it('a hidden view keeps the guide’s marker while the menu is closed', () => {
    expect(control).toContain('data-guide-view={option.value}')
    // The hidden marker, not the open menu row: the guide opens by address.
    expect(control).toContain("data-guide-active={option.value === value ? '' : undefined}")
  })
})

describe('the bar keeps its identity', () => {
  it('same surface, same radius, same padding, same fitted words', () => {
    expect(control).toContain('rounded-xl')
    expect(control).toContain('bg-[hsl(var(--surface-muted))]')
    expect(control).toContain('p-1')
    expect(control).toContain('var(--fit-font,')
    expect(control).not.toContain('flex-wrap')
  })

  it('under 560px: four equal columns, «بیشتر» on its own row, the menu in the page', () => {
    expect(control).toContain('repeat(${barOptions.length}, minmax(0, 1fr))')
    expect(control).toContain('min-[560px]:flex-row')
    expect(control).toContain('min-[560px]:absolute')
    expect(control).toContain('min-[560px]:w-[248px]')
  })
})
