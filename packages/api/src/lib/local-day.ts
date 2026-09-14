// packages/api/src/lib/local-day.ts
//
// Today as a LOCAL calendar day, `YYYY-MM-DD`. The same rule as `toIsoDay` in
// @hisabche/formatting, which this package does not depend on; a test keeps the
// two identical. Never `toISOString().slice(0, 10)`: that is the UTC day, which
// east of Greenwich is yesterday until local 03:30 / 04:30.

export function localDay(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
