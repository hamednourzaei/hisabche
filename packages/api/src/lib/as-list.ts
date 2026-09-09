// ============================================
// packages/api/src/lib/as-list.ts
//
// A list from the network, or an empty one.
//
// ---------------------------------------------------------------------------
// ⚠️ WHY THIS EXISTS — A TYPE ANNOTATION IS NOT A RUNTIME CHECK
//
// Every list hook in this package was written one of three ways:
//
//     return data                        // with `Promise<X[]>` on the queryFn
//     return data as X[]
//     return (data as X[]) ?? []
//
// All three tell TypeScript the value is an array. None of them ASKS. And `??`
// substitutes only for `null` and `undefined`, so anything else the endpoint
// returns — an error envelope, a `{ data: … }` wrapper, an HTML page from a
// misrouted request, a 200 carrying an object — passes straight through
// wearing the type of an array.
//
// The first `.map` or `for…of` over it then throws:
//
//     TypeError: (boms ?? []).map is not a function
//     TypeError: (quotes ?? []) is not iterable
//
// and React Router's boundary replaces the whole screen with an error page.
// Two separate screens went down this way — the dashboard through
// `useExchangeRates`, manufacturing through `useBoms` — before it was clear
// this was one defect copied across twenty-seven call sites rather than two
// bugs.
//
// ---------------------------------------------------------------------------
// ⚠️ IT IS DELIBERATELY NOT A SILENT `[]`
//
// An empty list where an object arrived means "this endpoint returned
// something we cannot use", which is different from "there is nothing here" —
// and a screen that renders an empty state for a broken response is a lie that
// is harder to find than a crash. So the mismatch is reported once, to the
// console, with the shape that arrived. The UI still gets a usable value; the
// developer still gets told.
// ============================================

/** Logged shapes, so a failing poll does not fill the console. */
const reported = new Set<string>()

/**
 * `value` if it is an array, otherwise an empty one.
 *
 * @param label  Where it came from, for the warning. Usually the path.
 */
export function asList<T>(value: unknown, label?: string): T[] {
  if (Array.isArray(value)) return value as T[]

  // `null`/`undefined` is the ordinary "no body yet" case — a query that has
  // not resolved, or an endpoint that legitimately answers with nothing. Not
  // worth a warning.
  if (value != null && label && !reported.has(label)) {
    reported.add(label)
    console.warn(
      `[api] ${label} returned ${describe(value)} where a list was expected — rendering an empty list`,
    )
  }

  return []
}

function describe(value: unknown): string {
  if (typeof value !== 'object') return typeof value
  const keys = Object.keys(value as Record<string, unknown>).slice(0, 4)
  return keys.length > 0 ? `an object with keys [${keys.join(', ')}]` : 'an object'
}
