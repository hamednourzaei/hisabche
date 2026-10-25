// The offline gate is ONE component that asks the registry + the offline endpoint
// matrix. Screens do not branch on the edition themselves.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..', '..', '..', '..')
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8')
const code = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

describe('OfflineGate', () => {
  const gate = code(read('packages/ui/src/components/ui/offline-gate.tsx'))

  it('asks useActionAvailability before any return, and nothing else', () => {
    expect(gate.indexOf('useActionAvailability(feature)')).toBeGreaterThan(-1)
    expect(gate.indexOf('useActionAvailability(feature)')).toBeLessThan(gate.indexOf('return'))
    expect(gate).not.toContain('getAppEdition')
    expect(gate).not.toContain('isOffline')
  })

  it('words the notice from the matrix status', () => {
    expect(gate).toContain(
      "availability.offline === 'not_supported' ? 'not_supported' : 'online_required'",
    )
  })

  it('is what the team hub uses to refuse a section the device cannot run', () => {
    const hub = code(
      read(
        'packages/ui/src/components/ui/team-and-payroll/containers/team-and-payroll-container.tsx',
      ),
    )
    expect(hub).toContain('<OfflineGate feature={SECTION_FEATURE[')
    for (const feature of ['employee.list', 'branch.manage', 'hr.attendance', 'timesheet.manage']) {
      expect(hub).toContain(`'${feature}'`)
    }
  })

  it('has its words in all three locales', () => {
    for (const lang of ['fa', 'af', 'en']) {
      const json = JSON.parse(read(`packages/i18n/messages/${lang}/common.json`)) as {
        offline: { cloudRequired: Record<string, string> }
      }
      for (const key of [
        'unsupportedTitle',
        'unsupportedBadge',
        'unsupportedDescription',
        'unsupportedWhatToDo',
      ]) {
        expect(json.offline.cloudRequired[key], `${lang}.${key}`).toBeTruthy()
      }
    }
  })
})
