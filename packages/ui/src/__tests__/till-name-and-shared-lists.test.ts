// ============================================
// The till's name, and the lists that moved to the shared table (5 Oct 2026).
//
// What can go wrong: the till name read being part of the session read (one
// missing column would take the whole till page down); a name sent without
// the server checking the till is this workspace's; «edit» changing anything
// but the name; a list on the customer page, the follow-up screen or the
// campaign screen drawn by hand again; follow-up keeping its own tab bar.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
/** Comments describe the bugs; only code is asserted on. */
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
const ui = (...parts: string[]) => code(read('packages', 'ui', 'src', 'components', 'ui', ...parts))

describe('a till has a name — and only the name is editable', () => {
  const service = code(read('backend', 'src', 'services', 'pos', 'pos.service.ts'))
  const routes = code(read('backend', 'src', 'routes', 'pos.routes.ts'))
  const view = ui('till', 'till-view.tsx')
  const container = ui('till', 'containers', 'till-container.tsx')

  it('the name is read apart from the session, so a missing column breaks nothing else', () => {
    const columns = service.slice(
      service.indexOf('const SESSION_COLUMNS'),
      service.indexOf('const SESSION_COLUMNS') + 600,
    )
    expect(columns).not.toContain('label')
    expect(service).toContain(
      'if (isMissingLabelColumn(error)) return { configured: false, labels: {} }',
    )
    expect(service).toContain("return error.code === '42703' || error.code === 'PGRST204'")
  })

  it('naming checks the till belongs to this workspace, and says when the script is missing', () => {
    const setLabel = service.slice(service.indexOf('async setLabel('))
    expect(setLabel.indexOf('await this.getSession(ctx, sessionId)')).toBeLessThan(
      setLabel.indexOf('.update({ label })'),
    )
    expect(setLabel).toContain(".eq('workspace_id', ctx.workspaceId)")
    expect(service).toContain("throw new ConflictError('POS_LABEL_MIGRATION_REQUIRED')")
  })

  it('the route takes a name of 1–80 characters or null — nothing else', () => {
    expect(routes).toContain("'/sessions/:id/label'")
    expect(routes).toContain('.object({ label: z.string().trim().min(1).max(80).nullable() })')
    expect(routes).toContain('.strict()')
  })

  it('the migration, its VERIFY and its real-Postgres test exist', () => {
    for (const file of [
      ['docs', 'pos-session-label-01-migration.sql'],
      ['docs', 'VERIFY-pos-session-label-01.sql'],
      ['backend', 'src', '__tests__', 'pos-session-label.pg.test.ts'],
    ]) {
      expect(existsSync(join(ROOT, ...file)), file.join('/')).toBe(true)
    }
    const migration = read('docs', 'pos-session-label-01-migration.sql')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS label text')
    expect(migration).toContain('ROLLBACK')
    expect(migration).not.toMatch(/\bDROP TABLE\b/)
  })

  it('the list shows the name, searches it, and «ویرایش» opens a dialog', () => {
    expect(view).toContain("{tillLabels[item.sessionId] ?? t('till.unnamed', 'بدون نام')}")
    expect(view).toContain("tillLabels[item.sessionId] ?? '',")
    expect(view).toContain('data-rename-till=""')
    expect(view).toContain('await onRenameTill(renaming.sessionId, nameDraft.trim() || null)')
    expect(container).toContain('useTillLabels()')
    expect(container).toContain('useSetTillLabel()')
  })

  it('there is no delete: a till is retired by closing it', () => {
    expect(view).not.toMatch(/onDeleteTill|till\.delete/)
    expect(routes).not.toContain("fastify.delete(\n    '/sessions")
  })

  it('every new word exists in all three languages', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const words = JSON.parse(read('packages', 'i18n', 'messages', lang, 'common.json'))
      for (const key of [
        'unnamed',
        'rename',
        'name',
        'rename_hint',
        'error_POS_LABEL_MIGRATION_REQUIRED',
        'error_POS_LABEL_INVALID',
      ]) {
        expect(words.till[key], `${lang} till.${key}`).toEqual(expect.any(String))
      }
      expect(words.campaigns.noMatch, lang).toEqual(expect.any(String))
      expect(words.crm.interactions.noMatch, lang).toEqual(expect.any(String))
    }
  })
})

describe('lists that moved to the shared table', () => {
  it('the customer page: statement, invoices, payments and products', () => {
    const detail = ui('customers', 'customer-detail-view.tsx')
    for (const id of [
      'customer-statement',
      'customer-invoices',
      'customer-payments',
      'customer-products',
    ]) {
      expect(detail, id).toContain(`tableId="${id}"`)
    }
    expect(detail).not.toContain('<table')
    // The shared searchable table owns the search, so the four toolbars are
    // the same toolbar — and the page keeps no wrapper of its own.
    expect(detail.split('<SearchableTable').length - 1).toBe(4)
    expect(detail).not.toContain('function DetailTable')
  })

  it('a statement row from an invoice still opens that invoice', () => {
    expect(ui('customers', 'customer-detail-view.tsx')).toContain(
      "if (row.sourceType === 'invoice' && row.sourceId) props.onOpenInvoice(row.sourceId)",
    )
  })

  it('follow-up: one table, a status filter, and the shared switch instead of its own tabs', () => {
    const crm = ui('crm', 'crm-view.tsx')
    expect(crm).toContain('tableId="crm-tasks"')
    expect(crm).toContain('<TableFilterSelect')
    expect(crm).toContain('<SegmentedControl')
    expect(crm).toContain('onRowClick={(task) => setSelectedTaskId(task.id)}')
    expect(crm).not.toContain('<table')
    expect(crm).not.toContain('border-b-2 -mb-px')
  })

  it('campaigns: a row opens its campaign under the table', () => {
    const campaigns = ui('campaigns', 'campaigns-container.tsx')
    expect(campaigns).toContain('tableId="campaigns"')
    expect(campaigns).toContain('<TableFilterSelect')
    expect(campaigns).toContain(
      '<CampaignPanel campaign={open} emailReady={emailReady} errorText={errorText} />',
    )
    expect(campaigns).not.toContain('<ul className="space-y-2">')
  })
})
