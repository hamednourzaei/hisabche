// ============================================
// «تأییدها» — the redesigned /approvals.
//
// What can go wrong: the hub drawing its own bar; a second implementation of
// the workflow screen; «define a workflow» leaving the page instead of opening
// the other tab; the requests kept as a stack of cards with no search; a
// request whose steps cannot be opened; the three figures popping in after the
// list arrives; the workflows table drawn by hand; «before» changed or lost.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { APPROVALS_HUB_TABS } from '../components/ui/workflow/containers/approvals-hub-container'
import {
  APPROVAL_STATUS_FILTERS,
  oldestWaitingDays,
} from '../components/ui/workflow/approvals-view'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) =>
  code(read('packages', 'ui', 'src', 'components', 'ui', 'workflow', ...parts))

const hub = ui('containers', 'approvals-hub-container.tsx')

describe('two tabs, built from shared parts', () => {
  it('requests and workflows — and nothing else', () => {
    expect([...APPROVALS_HUB_TABS]).toEqual(['requests', 'workflows'])
  })

  it('«تعریف گردش‌کار» opens the other tab — it does not leave the page', () => {
    expect(hub).toContain("<ApprovalsContainer onDefineWorkflow={() => select('workflows')} />")
    // …and on its own page it still goes where it always went.
    expect(ui('containers', 'approvals-container.tsx')).toContain(
      "onDefineWorkflow={onDefineWorkflow ?? (() => push('/approvals?tab=workflows'))}",
    )
  })
})

describe('the requests are the shared table', () => {
  const view = ui('approvals-view.tsx')

  it('one row per request; its steps and form open under the table', () => {
    expect(view).toContain('tableId="approvals"')
    expect(view).toContain(
      'onRowClick={(item) => setOpenId((current) => (current === item.id ? null : item.id))}',
    )
    expect(view).toContain('{open ? <div key={open.id}>{open.card}</div> : null}')
    // Not the old stack of every card at once.
    expect(view).not.toContain('{visible.map((item) => (')
  })

  it('the status filter is in the table’s toolbar and offers only real statuses', () => {
    expect(view).toContain('<TableFilterSelect')
    expect(view).not.toContain('<SegmentedFilter')
    expect([...APPROVAL_STATUS_FILTERS]).toEqual(['pending', 'in_progress'])
  })

  it('the three figures are always on screen — «…» while loading, «—» on failure', () => {
    expect(view).toContain(
      "const figure = (value: number) => (isLoading ? '…' : error ? '—' : value)",
    )
    expect(view).not.toContain('items.length > 0 ? (\n        <StatGrid>')
  })

  it('four figures, the fourth being how long the oldest request has waited', () => {
    expect((view.match(/<Stat\s/g) ?? []).length).toBe(4)
    const now = Date.parse('2026-10-05T12:00:00Z')
    expect(
      oldestWaitingDays(
        [{ startedAt: '2026-10-04T12:00:00Z' }, { startedAt: '2026-09-28T09:00:00Z' }],
        now,
      ),
    ).toBe(7)
    // Nothing waiting, or no start date recorded: «—», never zero days.
    expect(oldestWaitingDays([], now)).toBeNull()
    expect(oldestWaitingDays([{ startedAt: null }], now)).toBeNull()
    // A request started a few hours ago has waited 0 whole days.
    expect(oldestWaitingDays([{ startedAt: '2026-10-05T08:00:00Z' }], now)).toBe(0)
  })

  it('an empty page still says WHY it is empty', () => {
    expect(view).toContain('hasActiveWorkflow === false')
    expect(view).toContain('onClick: onDefineWorkflow,')
  })

  it('the row carries what the table shows', () => {
    const container = ui('containers', 'approvals-container.tsx')
    for (const field of [
      'entityType: instance.entity_type,',
      'currentStep: instance.current_step,',
      'totalSteps: instance.total_steps,',
    ]) {
      expect(container, field).toContain(field)
    }
  })
})

describe('the workflows are the shared table', () => {
  const templates = ui('workflow-templates-view.tsx')

  it('a DataTable with search and a status filter — not a hand-made table', () => {
    expect(templates).toContain('tableId="workflow-templates"')
    expect(templates).toContain('<TableFilterSelect')
    expect(templates).not.toContain('<table')
  })

  it('the escalation control is still a column when it is offered', () => {
    expect(templates).toContain('render: (workflow: Workflow) => renderEscalation(workflow),')
  })
})

describe('«قبل / بعد», menu, shells and words', () => {
  it('both shells mount the hub', () => {
    expect(read('apps', 'web', 'app', '[lang]', '(dashboard)', 'approvals', 'page.tsx')).toContain(
      '<ApprovalsHubContainer />',
    )
    expect(
      read('packages', 'app-shell', 'src', 'features', 'approvals', 'approvals-page.tsx'),
    ).toContain('ApprovalsHubContainer as default')
  })

  it('every label exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const all = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      expect(all.approvalsHub.label, lang).toEqual(expect.any(String))
      expect(all.approvalsHub.loading, lang).toEqual(expect.any(String))
      for (const tab of APPROVALS_HUB_TABS) {
        expect(all.approvalsHub.tabs[tab], `${lang} ${tab}`).toEqual(expect.any(String))
      }
      expect(all.workflow.step, lang).toEqual(expect.any(String))
      expect(all.workflow.started, lang).toEqual(expect.any(String))
      expect(all.workflow.oldest_waiting, lang).toEqual(expect.any(String))
      expect(all.workflow.days, lang).toEqual(expect.any(String))
      expect(all.workflow.templates.noMatch, lang).toEqual(expect.any(String))
    }
  })
})
