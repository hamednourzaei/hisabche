// ============================================
// Capability #81 — the disclosure before a destructive action.
//
//   · every command the SERVER can describe has a sentence on the client
//     (the two lists are kept in different packages; this is what ties them);
//   · «حذف» on an invoice row asks first, and shows the disclosure, instead of
//     acting on the press;
//   · the disclosure never renders nothing.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { UNDO_KINDS } from '../components/ui/undo-disclosure'

const ROOT = join(__dirname, '..', '..', '..', '..')
const code = (path: string) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')

describe('undo disclosure', () => {
  it('knows every command kind the server declares — no more, no fewer', () => {
    const domain = readFileSync(
      join(ROOT, 'backend', 'src', 'services', 'workflow', 'escalation.domain.ts'),
      'utf8',
    )
    const union = domain.slice(
      domain.indexOf('export type CommandKind ='),
      domain.indexOf('export interface CompensationPlan'),
    )
    const serverKinds = [...union.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort()
    expect(serverKinds.length).toBeGreaterThan(5)
    expect([...UNDO_KINDS].sort()).toEqual(serverKinds)
  })

  it('says something in every state: loading, failed or unknown, and known', () => {
    const source = code(join(__dirname, '..', 'components', 'ui', 'undo-disclosure.tsx'))
    expect(source).not.toMatch(/return null\b/)
    expect(source).toContain("'undo.unknown'")
    // The unknown branch covers a failed read, a null plan AND an unlisted kind.
    expect(source).toContain('answer.error || !plan || !KNOWN.has(plan.kind)')
  })

  it('deleting an invoice asks first and shows what it will do', () => {
    const actions = code(
      join(__dirname, '..', 'components', 'ui', 'invoices', 'invoice-row-actions.tsx'),
    )
    expect(actions).toContain('<UndoDisclosure t={t} route="DELETE /invoices/:id" />')
    // `onDelete` is called from exactly one place: the confirm button.
    expect(actions.match(/onDelete\(inv\.id\)/g) ?? []).toHaveLength(1)
    const confirm = actions.slice(actions.indexOf('<DialogFooter>'))
    expect(confirm).toContain('onDelete(inv.id)')
  })

  it('the route it asks about is one the server describes', () => {
    const table = readFileSync(
      join(ROOT, 'backend', 'src', 'services', 'workflow', 'compensation.service.ts'),
      'utf8',
    )
    expect(table).toContain("'DELETE /invoices/:id'")
  })
})
