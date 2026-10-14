// ============================================
// packages/ui/src/lib/translate-or.ts
//
// A message that may not exist, read safely in every shell.
//
// `t.has()` is next-intl's; the desktop shell's shim has no such method, and a
// missing key there either throws or comes back as the key itself. This asks
// once and answers `fallback` for all three.
// ============================================

export function translateOr(t: (key: never) => string, key: string, fallback: string): string {
  try {
    const value = (t as unknown as (k: string) => string)(key)
    return value && value !== key ? value : fallback
  } catch {
    return fallback
  }
}
