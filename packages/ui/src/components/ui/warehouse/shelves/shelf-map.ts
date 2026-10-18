// ============================================
// packages/ui/src/components/ui/warehouse/shelves/shelf-map.ts
//
// «نقشه قفسه‌ها» (owner, 18 Oct 2026): the shelves of one warehouse drawn as
// aisles, each aisle with an odd and an even side — the way a person walks a
// warehouse. Nothing here is a floor plan (no x/y): the aisle is read from the
// shelf's own code, the code people already write on the label.
//
//   «A-1», «A-02», «A3»   → aisle A, bay 1 / 2 / 3
//   «R02-S04»             → aisle R, bay 2 (the first number)
//   «روغن»                → no letter/number shape → the «other» aisle
//
// Pure: exported for the tests.
// ============================================

export interface MapShelf {
  id: string
  code: string
  capacityUsed: number | null
}

export type FillBand = 'none' | 'empty' | 'low' | 'mid' | 'full' | 'over'

export interface ShelfAisle<T extends MapShelf> {
  /** `''` = codes that do not read as «letters + number». */
  aisle: string
  odd: T[]
  even: T[]
}

const DIGITS: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
}

/** Aisle letters and bay number of a shelf code; `null` when it has no such shape. */
export function readShelfCode(code: string): { aisle: string; bay: number } | null {
  const latin = code.trim().replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d)
  const match = /^([^\d\s\-_./]+)[\s\-_./]*0*(\d+)/u.exec(latin)
  if (!match) return null
  return { aisle: match[1]!.toUpperCase(), bay: Number(match[2]) }
}

/** Aisles in code order; inside each, odd bays on one side and even on the other. */
export function groupIntoAisles<T extends MapShelf>(shelves: readonly T[]): ShelfAisle<T>[] {
  const aisles = new Map<string, Array<{ shelf: T; bay: number }>>()
  for (const shelf of shelves) {
    const read = readShelfCode(shelf.code)
    const key = read?.aisle ?? ''
    const list = aisles.get(key) ?? []
    list.push({ shelf, bay: read?.bay ?? 0 })
    aisles.set(key, list)
  }
  return [...aisles.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([aisle, list]) => {
      const sorted = [...list].sort(
        (a, b) => a.bay - b.bay || a.shelf.code.localeCompare(b.shelf.code),
      )
      // A code without a number is on no side: it goes with the odd row.
      return {
        aisle,
        odd: sorted.filter((row) => row.bay % 2 === 1 || row.bay === 0).map((row) => row.shelf),
        even: sorted.filter((row) => row.bay !== 0 && row.bay % 2 === 0).map((row) => row.shelf),
      }
    })
}

/** How full a shelf is. `none` = no capacity recorded — never drawn as «empty». */
export function fillBand(capacityUsed: number | null, productCount: number): FillBand {
  if (capacityUsed === null) return 'none'
  if (capacityUsed > 1) return 'over'
  if (capacityUsed === 0 && productCount === 0) return 'empty'
  if (capacityUsed < 0.5) return 'low'
  if (capacityUsed < 0.9) return 'mid'
  return 'full'
}

/** One page of rows; `page` is clamped to what exists. */
export function pageOf<T>(rows: readonly T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(Math.max(1, page), pageCount)
  return { rows: rows.slice((current - 1) * size, current * size), page: current, pageCount }
}
