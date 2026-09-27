// ============================================
// Print a receipt — and report what happened, separately from the invoice.
//
// ⚠️ ISSUING AND PRINTING ARE TWO STATES. The invoice is committed by the
// server before anything is printed; a jammed or unplugged printer is a
// failed PRINT, never a failed or repeated invoice. Reprinting is always
// allowed and never touches the invoice.
//
//   desktop (host registered) → silent to the chosen printer, or the dialog
//   browser (no host)         → a hidden frame with a receipt-sized page and
//                                the browser's print dialog (a browser cannot
//                                print silently — that is not a missing feature)
// ============================================

import { escPosControl } from './escpos-control'
import { getReceiptPrinterHost } from './printer-host'
import type { PrinterSettings } from './printer-settings'

export type PrintOutcome =
  | { status: 'printed' }
  /** The browser's dialog was shown; whether the person printed is theirs to say. */
  | { status: 'dialog' }
  | { status: 'failed'; reason: 'printer' | 'drawer' | 'unavailable' }

export async function printReceipt(html: string, settings: PrinterSettings): Promise<PrintOutcome> {
  const host = getReceiptPrinterHost()

  if (host) {
    let ok: boolean
    try {
      ok = await host.printHtml({
        html,
        deviceName: settings.deviceName ?? undefined,
        silent: settings.deviceName !== null,
        pageWidthMm: settings.widthMm,
        copies: settings.copies,
      })
    } catch {
      ok = false
    }
    if (!ok) return { status: 'failed', reason: 'printer' }

    const control = escPosControl(settings)
    if (control && host.printEscPos) {
      try {
        const kicked = await host.printEscPos({
          data: control,
          deviceName: settings.deviceName ?? undefined,
        })
        // The receipt DID print; only the drawer/cut failed — said as such.
        if (!kicked) return { status: 'failed', reason: 'drawer' }
      } catch {
        return { status: 'failed', reason: 'drawer' }
      }
    }
    return { status: 'printed' }
  }

  if (typeof document === 'undefined') return { status: 'failed', reason: 'unavailable' }
  return printInFrame(html)
}

function printInFrame(html: string): PrintOutcome {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText =
    'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  const win = frame.contentWindow
  if (!doc || !win) {
    frame.remove()
    return { status: 'failed', reason: 'unavailable' }
  }
  doc.open()
  doc.write(html)
  doc.close()
  const cleanup = () => setTimeout(() => frame.remove(), 1000)
  win.addEventListener('afterprint', cleanup, { once: true })
  win.focus()
  win.print()
  // Browsers that block until the dialog closes fire afterprint; others do not.
  setTimeout(cleanup, 60_000)
  return { status: 'dialog' }
}
