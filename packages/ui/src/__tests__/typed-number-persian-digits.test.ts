// ============================================
// «ظرفیت را وارد می‌کنم، قفسه ساخته می‌شود ولی ظرفیت ثبت نمی‌شود» (owner,
// 18 Oct 2026). `<input type="number">` gives the value «» for Persian digits,
// so «۲۰۰» became `capacity: null` with no error. The warehouse dialogs read
// typed numbers as text through `typedNumber` instead.
// ============================================

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { typedNumber } from '../lib/typed-number'

describe('typedNumber', () => {
  it('reads Persian, Arabic-Indic and Latin digits alike', () => {
    expect(typedNumber('۲۰۰')).toBe(200)
    expect(typedNumber('٢٠٠')).toBe(200)
    expect(typedNumber('200')).toBe(200)
  })

  it('«٫» is the decimal point; «٬» and «,» are grouping', () => {
    expect(typedNumber('۲٫۵')).toBe(2.5)
    expect(typedNumber('۱٬۲۰۰')).toBe(1200)
    expect(typedNumber('1,200.5')).toBe(1200.5)
  })

  it('empty is «not recorded» (null), never 0', () => {
    expect(typedNumber('')).toBeNull()
    expect(typedNumber('   ')).toBeNull()
    expect(typedNumber('abc')).toBeNull()
  })
})

describe('the warehouse and shelf dialogs', () => {
  const dir = resolve(__dirname, '../components/ui/warehouse')
  const files = [
    join(dir, 'warehouse-dialogs.tsx'),
    ...readdirSync(join(dir, 'shelves'))
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => join(dir, 'shelves', f)),
  ]

  it('have no `type="number"` field — it drops Persian digits', () => {
    for (const file of files) {
      const code = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      expect(code, file).not.toContain('type="number"')
    }
  })

  it('read capacity and quantities through typedNumber', () => {
    const shelves = readFileSync(join(dir, 'shelves', 'shelf-dialogs.tsx'), 'utf8')
    expect(shelves).toContain(
      "const parsedCapacity = capacity.trim() === '' ? null : typedNumber(capacity)",
    )
    expect(shelves).toContain('const amount = typedNumber(quantity) ?? 0')
    const dialogs = readFileSync(join(dir, 'warehouse-dialogs.tsx'), 'utf8')
    expect(dialogs.split('const amount = typedNumber(quantity) ?? 0').length - 1).toBe(2)
  })
})
