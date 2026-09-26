// «{h} ساعت پیش» on /activities: the count was never passed to the message.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import fa from '../../../i18n/messages/fa/common.json'
import { timeAgo } from '../lib/time-ago'

const t = (key: string, values?: Record<string, number>) => {
  const template = key
    .split('.')
    .reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], fa) as string
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`))
}
const NOW = Date.parse('2026-09-26T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('timeAgo fills in the number', () => {
  it.each([
    [5 * 60_000, '5 دقیقه پیش'],
    [3 * 3_600_000, '3 ساعت پیش'],
    [2 * 86_400_000, '2 روز پیش'],
    [14 * 86_400_000, '2 هفته پیش'],
    [60 * 86_400_000, '2 ماه پیش'],
    [800 * 86_400_000, '2 سال پیش'],
  ])('%i ms → %s', (ms, expected) => {
    expect(timeAgo(ago(ms), NOW, t)).toBe(expected)
  })

  it('never leaves a placeholder', () => {
    for (const ms of [1, 61_000, 7_200_000, 90_000_000, 2e9, 4e10]) {
      expect(timeAgo(ago(ms), NOW, t)).not.toMatch(/\{\w+\}/)
    }
  })
})

describe('no private copies', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : []
    })
  it('every time.*Ago message goes through lib/time-ago', () => {
    const offenders = files(join(__dirname, '..', 'components')).filter((f) =>
      /t\('time\.(minutes|hours|days|weeks|months|years)Ago'\)/.test(readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
