// ============================================
// packages/ui/src/lib/persisted-bytes.ts
//
// How much this app keeps in the browser's key-value storage, in bytes.
// That is where the read cache lives (persisted-query-cache), and
// `navigator.storage.estimate()` does not count it — which is why «فضای این
// برنامه روی دستگاه» read «۰ بایت» with 160 answers on the device (owner,
// 18 Oct 2026). Reads only; it never removes anything.
// ============================================

/** UTF-16: two bytes per character. null when the storage cannot be read. */
export function persistedBytes(): number | null {
  try {
    const storage = window.localStorage
    let total = 0
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (key === null) continue
      total += (key.length + (storage.getItem(key)?.length ?? 0)) * 2
    }
    return total
  } catch {
    return null
  }
}
