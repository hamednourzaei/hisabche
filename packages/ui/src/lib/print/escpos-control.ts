// ============================================
// ESC/POS for what it does well: the cash drawer and the paper cut. No text —
// Persian text goes through the HTML receipt (receipt-html.ts).
// ============================================

const ESC = 0x1b
const GS = 0x1d

/** Base64 of the control bytes, or null when nothing is asked for. */
export function escPosControl(options: { openDrawer: boolean; cutPaper: boolean }): string | null {
  const bytes: number[] = []
  if (options.openDrawer) {
    // ESC p m t1 t2 — pulse pin 2 (the usual drawer connector) for 50/500 ms.
    bytes.push(ESC, 0x70, 0x00, 0x19, 0xfa)
  }
  if (options.cutPaper) {
    // Feed three lines, then GS V 66 0: feed to the cutter and partial cut.
    bytes.push(0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00)
  }
  if (bytes.length === 0) return null
  let binary = ''
  for (const b of [ESC, 0x40, ...bytes]) binary += String.fromCharCode(b) // ESC @ = init first
  return btoa(binary)
}
