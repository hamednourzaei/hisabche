// ============================================
// backend/src/utils/keyed-lock.ts
//
// One caller at a time per key, within this process.
//
// Used where a decision reads a figure and a write then changes it (the customer's credit limit): two
// requests for the same customer would both read the old figure and both pass. It orders the requests of
// ONE backend instance; it is not a database lock and does not order requests that reach different
// instances — that needs a lock in the database and is recorded as such where it is used.
// ============================================

const tails = new Map<string, Promise<unknown>>()

export async function serializeBy<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve()
  // The next caller waits for this one to finish, whether it succeeded or threw.
  const settled = previous.then(
    () => undefined,
    () => undefined,
  )
  const current = settled.then(run)
  tails.set(key, current)
  try {
    return await current
  } finally {
    // Only the last in line clears the entry, so the map does not grow with every customer.
    if (tails.get(key) === current) tails.delete(key)
  }
}
