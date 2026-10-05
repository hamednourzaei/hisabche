// ============================================
// The lines from a hub's selected tab to the choices of its switch.
//
// What can go wrong: the switch drawn twice (in its row AND under the tabs);
// the switch moved in the React tree, losing its state; a hub drawing its own
// lines; the lines computed from counts instead of measured, so they miss in
// another language; a gap left under the tabs of a tab with no switch; the
// server and the first client render disagreeing; a choice wrapping onto two
// lines on a phone.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { branchPath } from '../components/ui/hub-branch'

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

const branch = ui('hub-branch.tsx')
const control = ui('segmented-control.tsx')
const tabs = ui('hub-tabs.tsx')

describe('the line', () => {
  it('leaves the tab and arrives at the choice vertically', () => {
    // Both control points share an x with their own end.
    expect(branchPath(100, 40, 28)).toBe('M 100 0 C 100 15 40 13 40 28')
  })

  it('straight down is a straight line', () => {
    expect(branchPath(60, 60, 28)).toBe('M 60 0 C 60 15 60 13 60 28')
  })
})

describe('measured, not computed', () => {
  it('starts at the SELECTED tab and ends on every choice in the slot', () => {
    // From the bar that drew the strip — never a tab bar further down the page.
    expect(branch).toContain(`bar.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')`)
    expect(tabs).toContain('<HubBranchStrip tabs={bar} />')
    expect(branch).toContain(`slot.querySelectorAll<HTMLElement>('[role="radio"]')`)
    expect(branch).toContain('box.left + box.width / 2 - origin')
  })

  it('is measured again when anything that moves a centre changes', () => {
    expect(branch).toContain('new ResizeObserver(schedule)')
    expect(branch).toContain('new MutationObserver(schedule)')
    expect(branch).toContain("attributeFilter: ['aria-selected', 'aria-checked']")
    // …and an unchanged measurement is not a render: the observer sees our own lines.
    expect(branch).toContain('setLines((current) => (sameLines(current, next) ? current : next))')
  })

  it('a tab with no switch leaves no gap under the tabs', () => {
    expect(branch).toContain('height={lines.length > 0 ? STRIP : 0}')
    expect(branch).toContain('empty:hidden')
  })

  it('the selected choice has the strong line, drawn over the others', () => {
    expect(branch).toContain('strokeWidth={line.selected ? 2 : 1.5}')
    expect(branch).toContain('.sort((a, b) => Number(a.line.selected) - Number(b.line.selected))')
    expect(branch).toContain('motion-reduce:[transition:none]')
  })
})

describe('the switch is placed, not moved', () => {
  it('a portal into the slot — the component stays where its screen wrote it', () => {
    expect(control).toContain('const { anchor, slot } = useNearestBranchSlot(branch)')
    expect(control).toContain('{slot ? createPortal(control, slot) : null}')
  })

  it('without `branch`, or with no tab bar above it, it renders in place', () => {
    expect(control).toContain('if (slot === undefined) return control')
    expect(branch).toContain('return { anchor, slot: enabled ? slot : undefined }')
  })

  it('before the slot is found only the anchor renders — on the server too', () => {
    expect(branch).toContain('useState<HTMLElement | null | undefined>(enabled ? null : undefined)')
    expect(control).toContain('<span ref={anchor} hidden data-branch-anchor="" />')
  })

  it('the slot is the NEAREST one above where the switch was written', () => {
    expect(branch).toContain(
      'for (let above = node.parentElement; above && !found; above = above.parentElement)',
    )
    // Unmounting the anchor is not news about the slot.
    expect(branch).toContain('if (!node) return')
  })

  it('the slot is the middle of the page', () => {
    expect(branch).toContain('<div ref={setSlot} className="flex justify-center empty:hidden"')
  })
})

describe('nothing wraps', () => {
  it('a choice is one line, and gets smaller on a narrow screen', () => {
    expect(control).toContain('whitespace-nowrap')
    expect(control).toContain('text-[clamp(0.6875rem,3vw,0.875rem)]')
    expect(control).toContain('px-[clamp(0.5rem,2.6vw,1rem)]')
  })

  it('a tab is one line, and gets smaller on a narrow screen', () => {
    expect(tabs).toContain('whitespace-nowrap')
    expect(tabs).toContain('text-[clamp(0.75rem,3.2vw,0.875rem)]')
  })
})

describe('every hub, with one word', () => {
  it('the tab bar draws the strip — no hub wraps anything or draws a line', () => {
    for (const hub of [
      'invoices/containers/sales-hub-container.tsx',
      'page-hub.tsx',
      'warehouse/containers/warehouse-tabs-container.tsx',
      'customers/containers/customers-hub-container.tsx',
    ]) {
      const source = ui(...hub.split('/'))
      expect(source, hub).toContain('<HubTabs')
      expect(source, hub).not.toContain('<svg')
      expect(source, hub).not.toContain('HubBranchStrip')
    }
  })

  // The switch that belongs to the selected tab, in every hub. One per tab:
  // two in one slot would be two rows of choices under the tabs.
  it.each([
    ['invoices/invoices-view.tsx', 1],
    ['promotions/promotions-container.tsx', 1],
    ['page-hub.tsx', 1],
    ['warehouse/containers/warehouse-tabs-container.tsx', 1],
    ['customers/containers/customers-hub-container.tsx', 1],
    ['customers/customer-detail-view.tsx', 1],
    ['team-and-payroll/containers/team-and-payroll-container.tsx', 2],
    ['governance/containers/governance-hub-container.tsx', 1],
    ['manufacturing/manufacturing-view.tsx', 1],
    ['analysis/analysis-container.tsx', 1],
    ['activity/ActivitiesPage.tsx', 1],
  ] as Array<[string, number]>)('%s', (file, count) => {
    const source = ui(...file.split('/'))
    const marked = source.split('<SegmentedControl branch').length - 1
    const viaProp = source.split('onChange={onChange} branch />').length - 1
    expect(marked + viaProp, file).toBe(count)
  })

  it('a screen under a hub that already has a switch keeps its own switch in place', () => {
    // These sit inside a tab whose hub draws the branch switch.
    for (const inner of [
      'crm/crm-view.tsx',
      'accounting/tabs/FinancingTab.tsx',
      'budgets/budgets-view.tsx',
      'inventory-ops/inventory-ops-view.tsx',
    ]) {
      expect(ui(...inner.split('/')), inner).not.toContain('<SegmentedControl branch')
    }
  })
})

describe('a comment is not page text', () => {
  // Wrapping the tab bar in an element left its `//` comment INSIDE the JSX,
  // where it is text: the sentence was printed above every hub.
  it.each(['hub-tabs.tsx', 'hub-branch.tsx', 'segmented-control.tsx', 'page-hub.tsx'])(
    '%s has no line comment directly inside an element',
    (file) => {
      const lines = read('packages', 'ui', 'src', 'components', 'ui', file).split('\n')
      const stray = lines.filter((line, index) => {
        if (!/^\s*\/\/ /.test(line)) return false
        let before = index - 1
        while (before >= 0 && /^\s*(\/\/.*)?$/.test(lines[before] ?? '')) before -= 1
        const previous = (lines[before] ?? '').trim()
        return previous.startsWith('<') && previous.endsWith('>') && !previous.endsWith('/>')
      })
      expect(stray).toEqual([])
    },
  )
})
