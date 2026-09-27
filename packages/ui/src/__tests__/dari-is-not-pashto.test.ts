// The Dari locales (web `messages/af`, desktop `src/locales/fa-AF`) must be
// Dari. On 27 Sep 2026 they held 362 PASHTO strings between them — «تېروتنه»
// for «خطا», «ناسم پټ نوم», «ټول سوداګرۍ»… A Dari user read much of the admin
// panel and the desktop app in another language, and nothing failed: a
// Pashto string is a perfectly valid string.
//
// Pashto-only letters (ږ ښ ې ۍ ټ ډ ړ ڼ ګ) never occur in Dari words. Calendar
// keys are exempt: they hold month/weekday names, not sentences.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const I18N = join(__dirname, '..', '..', '..', 'i18n')
const PASHTO_ONLY = /[ږښېۍټډړڼګ]/
const CALENDAR = /^(months|weekdays|calendar\.(weekdays|weekdaysShort|months))(\.|$)/

function pashtoStrings(file: string): string[] {
  const out: string[] = []
  const walk = (o: Record<string, unknown>, path: string) => {
    for (const [k, v] of Object.entries(o)) {
      const key = path ? `${path}.${k}` : k
      if (v && typeof v === 'object') walk(v as Record<string, unknown>, key)
      else if (typeof v === 'string' && !CALENDAR.test(key) && PASHTO_ONLY.test(v))
        out.push(`${key} = ${v}`)
    }
  }
  walk(JSON.parse(readFileSync(join(I18N, file), 'utf8')) as Record<string, unknown>, '')
  return out
}

describe('Dari is not Pashto', () => {
  it.each(['messages/af/common.json', 'src/locales/fa-AF.json'])('%s', (file) => {
    expect(pashtoStrings(file)).toEqual([])
  })
})
