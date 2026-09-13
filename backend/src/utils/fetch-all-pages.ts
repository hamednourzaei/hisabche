// ============================================
// backend/src/utils/fetch-all-pages.ts
//
// Read EVERY row of a query, in ordered 1000-row pages.
//
// PostgREST applies `max-rows` (1000 on this project) to every response and
// says nothing about the rows it dropped. A `.limit(5_000)` therefore returns
// at most 1000 rows, and a balance or total summed over that is silently wrong.
//
// Rules for callers:
//   - `page(from, to)` MUST apply a deterministic `.order(...)` ending in a
//     unique column (usually `id`), then `.range(from, to)`. Without it
//     PostgreSQL may return rows in any order and a row is seen twice or never.
//   - An error on ANY page throws. A partial set is never returned (§7 #3).
//
// `PAGE_SIZE` must not exceed PostgREST's max-rows, or every page comes back
// short, the loop stops after the first, and the truncation returns silently.
// ============================================

import { DatabaseError } from '../errors/database.error'

export const PAGE_SIZE = 1000

interface PageResult<T> {
  data: T[] | null
  error: { message: string } | null
}

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  errorMessage: string,
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new DatabaseError(errorMessage, error)

    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
}
