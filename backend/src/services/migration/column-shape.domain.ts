// ============================================
// backend/src/services/migration/column-shape.domain.ts
//
// Connecting a column by what it HOLDS, when its name says nothing.
//
// Headers are matched by name first (`suggestMapping`). That fails on exactly
// the files people have: «ستون۱», «Column B», a header in a third language,
// or no header worth the name. But a column of phone numbers is a phone column
// whatever it is called, and three numeric columns where the first times the
// second equals the third are quantity, price and amount.
//
// ---------------------------------------------------------------------------
// ONLY WHEN THERE IS ONE ANSWER
//
// Every rule here fires only if exactly one free column fits. Two date columns
// are «invoice date» and «due date» and nothing in the cells says which is
// which — so neither is connected, and the person does it. A guess that is
// right four times in five is a wrong import one time in five.
//
// What is connected this way is also NAMED in the result, so the screen can
// say «this one was read from the contents — check it».
//
// Pure: headers, rows and the mapping so far in; additions out.
// ============================================

import {
  normalizePhone,
  parseDateIso,
  parseMoneyMinor,
  type MigrationEntity,
} from './migration.domain'
import { parseJalaliIso } from './jalali.domain'

type Shape = 'date' | 'phone' | 'email' | 'barcode' | 'number' | 'text' | 'mixed'

interface Profile {
  column: number
  shape: Shape
  /** Per sampled row: the cell as a number, or null when it is not one. */
  numbers: (number | null)[]
  distinct: number
  filled: number
}

/** Rows read to judge a column. Enough to see its habit; cheap. */
const SAMPLE = 200
/** How much of a column must fit a shape for the column to be called that. */
const MOSTLY = 0.8

const isDate = (cell: string): boolean => {
  if (parseJalaliIso(cell).ok) return true
  // A workbook date-time arrives as `2026-10-01 14:30`.
  return parseDateIso(cell.split(' ')[0] ?? cell).ok
}
const isPhone = (cell: string): boolean => {
  if (!/^[+0-9۰-۹٠-٩\s()-]+$/.test(cell)) return false
  const digits = normalizePhone(cell).replace(/\D/g, '')
  // Starts the way a phone does; a bare 10-digit amount does not.
  return digits.length >= 10 && digits.length <= 13 && /^(0|\+|00|93|98)/.test(normalizePhone(cell))
}
const isEmail = (cell: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell)
const isBarcode = (cell: string): boolean => /^[0-9]{8,14}$/.test(cell) && !isPhone(cell)
const hasLetters = (cell: string): boolean => /\p{L}/u.test(cell)

function profile(rows: readonly (readonly string[])[], column: number): Profile {
  const cells = rows.slice(0, SAMPLE).map((row) => (row[column] ?? '').trim())
  const filledCells = cells.filter((cell) => cell !== '')
  const share = (test: (cell: string) => boolean) =>
    filledCells.length === 0 ? 0 : filledCells.filter(test).length / filledCells.length

  const numbers = cells.map((cell) => {
    if (cell === '' || hasLetters(cell)) return null
    const parsed = parseMoneyMinor(cell)
    return parsed.ok ? parsed.minor! / 100 : null
  })

  let shape: Shape = 'mixed'
  // A column needs a few values before it has a habit at all.
  if (filledCells.length >= 3) {
    if (share(isDate) >= MOSTLY) shape = 'date'
    else if (share(isPhone) >= MOSTLY) shape = 'phone'
    else if (share(isEmail) >= MOSTLY) shape = 'email'
    else if (share(isBarcode) >= MOSTLY) shape = 'barcode'
    else if (numbers.filter((value) => value !== null).length / filledCells.length >= MOSTLY) {
      shape = 'number'
    } else if (share(hasLetters) >= MOSTLY) shape = 'text'
  }

  return {
    column,
    shape,
    numbers,
    distinct: new Set(filledCells).size,
    filled: filledCells.length,
  }
}

/**
 * The two columns whose product is a third — quantity × price = amount.
 *
 * Arithmetic is the strongest evidence a spreadsheet gives about itself: three
 * columns do not multiply out by accident across a whole file. Returned only
 * when ONE such triple exists, and only if some row has a quantity other than
 * one (when every quantity is 1, price and amount are the same column twice
 * and nothing tells them apart).
 */
function arithmeticTriple(
  numeric: Profile[],
): { quantity: number; unitPrice: number; lineTotal: number } | null {
  const found: Array<{ a: Profile; b: Profile; total: Profile }> = []

  for (let i = 0; i < numeric.length; i++) {
    for (let j = i + 1; j < numeric.length; j++) {
      for (const total of numeric) {
        const a = numeric[i] as Profile
        const b = numeric[j] as Profile
        if (total === a || total === b) continue

        let rows = 0
        let fits = 0
        let varied = false
        for (let row = 0; row < total.numbers.length; row++) {
          const x = a.numbers[row]
          const y = b.numbers[row]
          const z = total.numbers[row]
          if (x == null || y == null || z == null) continue
          rows++
          if (Math.abs(x * y - z) <= Math.max(0.01, Math.abs(z) * 0.005)) fits++
          if (x !== 1 && y !== 1) varied = true
        }
        if (rows >= 3 && fits / rows >= MOSTLY && varied) found.push({ a, b, total })
      }
    }
  }
  if (found.length !== 1) return null

  const { a, b, total } = found[0] as { a: Profile; b: Profile; total: Profile }
  const mean = (p: Profile) => {
    const values = p.numbers.filter((value): value is number => value !== null)
    return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
  }
  // Of the two factors, the smaller on average is the count and the larger the
  // price. Either way round the amount is the same; this decides the labels.
  const [quantity, unitPrice] = mean(a) <= mean(b) ? [a, b] : [b, a]
  return { quantity: quantity.column, unitPrice: unitPrice.column, lineTotal: total.column }
}

export interface InferredMapping {
  /** Field → column, for fields the header names did not connect. */
  mapping: Record<string, number>
  /** The same fields, so the screen can mark them as read from the contents. */
  inferred: string[]
}

export function inferMappingFromContent(
  entity: MigrationEntity,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  mapped: Readonly<Record<string, number>>,
): InferredMapping {
  const taken = new Set(Object.values(mapped))
  const free = headers
    .map((_header, column) => column)
    .filter((column) => !taken.has(column))
    .map((column) => profile(rows, column))

  const mapping: Record<string, number> = {}
  const used = new Set<number>()
  const sole = (shape: Shape): number | null => {
    const fits = free.filter(
      (candidate) => candidate.shape === shape && !used.has(candidate.column),
    )
    return fits.length === 1 ? (fits[0] as Profile).column : null
  }
  const give = (field: string, column: number | null) => {
    if (column === null || mapped[field] !== undefined || mapping[field] !== undefined) return
    mapping[field] = column
    used.add(column)
  }

  if (entity === 'invoice') {
    give('date', sole('date'))
    give('customerPhone', sole('phone'))

    const priced = ['quantity', 'unitPrice', 'lineTotal'].every(
      (field) => mapped[field] === undefined,
    )
    if (priced) {
      const numeric = free.filter((candidate) => candidate.shape === 'number').slice(0, 8)
      const triple = arithmeticTriple(numeric)
      if (triple) {
        give('quantity', triple.quantity)
        give('unitPrice', triple.unitPrice)
        give('lineTotal', triple.lineTotal)
      }
    }
  } else if (entity === 'customer') {
    give('phone', sole('phone'))
    give('email', sole('email'))
    give('fullName', sole('text'))
  } else {
    give('barcode', sole('barcode'))
    give('name', sole('text'))
  }

  return { mapping, inferred: Object.keys(mapping) }
}
