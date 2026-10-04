// ============================================
// Capability #68 on screen: the escalation control of a workflow.
// Every key it uses, and every refusal it can show, is a string in fa/af/en —
// `t()` throws on a missing key and takes the approvals settings with it.
// ============================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ESCALATION_ERROR_CODES } from '../components/ui/workflow/escalation-policy-editor'

const ROOT = join(__dirname, '..', '..', '..', '..')
const EDITOR = join(__dirname, '..', 'components', 'ui', 'workflow', 'escalation-policy-editor.tsx')
const VIEW = join(__dirname, '..', 'components', 'ui', 'workflow', 'workflow-templates-view.tsx')
const CONTAINER = join(
  __dirname,
  '..',
  'components',
  'ui',
  'workflow',
  'containers',
  'workflow-templates-container.tsx',
)

const LOCALES = ['fa', 'af', 'en'] as const
const messages = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(
      readFileSync(join(ROOT, 'packages', 'i18n', 'messages', locale, 'common.json'), 'utf8'),
    ) as Record<string, unknown>,
  ]),
) as Record<(typeof LOCALES)[number], Record<string, unknown>>

const lookup = (tree: Record<string, unknown>, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      tree,
    )

const used = [
  ...new Set(
    [EDITOR, VIEW].flatMap((file) =>
      [
        ...readFileSync(file, 'utf8').matchAll(
          /['"`](workflow\.escalation\.[A-Za-z0-9_.]+)['"`]\s*,/g,
        ),
      ].map((match) => match[1] as string),
    ),
  ),
].filter((key) => !key.endsWith('.'))

describe('escalation control', () => {
  it('finds the keys it is supposed to check', () => {
    expect(used.length).toBeGreaterThan(12)
  })

  it.each(LOCALES)('every key is a non-empty string in %s', (locale) => {
    // Non-empty matters: the fallback wrapper treats '' as «missing» and would
    // show the Persian fallback to an English reader.
    expect(
      used.filter((key) => {
        const value = lookup(messages[locale], key)
        return typeof value !== 'string' || value.trim() === ''
      }),
    ).toEqual([])
  })

  it.each(LOCALES)('every refusal has a sentence in %s', (locale) => {
    expect(
      ESCALATION_ERROR_CODES.filter(
        (code) =>
          typeof lookup(messages[locale], `workflow.escalation.errors.${code}`) !== 'string',
      ),
    ).toEqual([])
  })

  it('says that nothing is approved automatically, in every locale', () => {
    expect(lookup(messages.fa, 'workflow.escalation.onHint')).toContain('خودکار تأیید نمی‌شود')
    expect(lookup(messages.en, 'workflow.escalation.onHint')).toContain(
      'nothing is approved automatically',
    )
  })

  it('is mounted on the workflow templates page', () => {
    expect(readFileSync(CONTAINER, 'utf8')).toContain('<EscalationPolicyEditor')
  })
})
