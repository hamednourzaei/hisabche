// ============================================
// Where a receipt can be printed — registered by the HOST, like the offline
// queue (packages/api/src/lib/offline-queue.ts). This package must not import
// a host's bridge: the desktop registers its printers at start-up; a browser
// registers nothing and the receipt goes through the print dialog instead.
//
// ⚠️ SILENT PRINTING IS A DESKTOP CAPABILITY. A browser cannot pick a printer
// or skip the dialog, whatever a page asks. The settings screen says so rather
// than offering a switch that cannot work there.
// ============================================

export interface HostPrinter {
  name: string
  displayName: string
  isDefault: boolean
}

export interface ReceiptPrinterHost {
  listPrinters(): Promise<HostPrinter[]>
  /** Render HTML and print it — silently to `deviceName` when given. */
  printHtml(input: {
    html: string
    deviceName?: string | undefined
    silent: boolean
    pageWidthMm: number
    copies: number
  }): Promise<boolean>
  /** Raw ESC/POS bytes (base64) — for the cash drawer and the paper cut only. */
  printEscPos?(input: { data: string; deviceName?: string | undefined }): Promise<boolean>
}

let host: ReceiptPrinterHost | null = null

export function registerReceiptPrinterHost(next: ReceiptPrinterHost): void {
  host = next
}

export function getReceiptPrinterHost(): ReceiptPrinterHost | null {
  return host
}
