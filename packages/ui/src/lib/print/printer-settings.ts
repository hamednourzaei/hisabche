// ============================================
// Receipt printer settings — per DEVICE (which printer is attached to THIS
// till is a fact about this machine). Browser storage, every read falling back
// to explicit defaults (G4), every stored value coerced, never trusted.
// ============================================

export type PaperWidthMm = 58 | 80

export interface PrinterSettings {
  /** The system printer's name; null = ask with the print dialog. */
  deviceName: string | null
  widthMm: PaperWidthMm
  /** Print the receipt as soon as an invoice is issued. */
  autoPrint: boolean
  copies: number
  /** ESC/POS: pulse the cash drawer after a cash receipt. */
  openDrawer: boolean
  /** ESC/POS: cut the paper after the receipt. */
  cutPaper: boolean
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  deviceName: null,
  widthMm: 80,
  autoPrint: false,
  copies: 1,
  openDrawer: false,
  cutPaper: false,
}

const KEY = 'hisabche:receipt-printer:v1'
export const PRINTER_SETTINGS_EVENT = 'hisabche:receipt-printer'

export function sanitizePrinterSettings(raw: unknown): PrinterSettings {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_PRINTER_SETTINGS
  const copies = Number(v.copies)
  return {
    deviceName:
      typeof v.deviceName === 'string' && v.deviceName.trim() && v.deviceName.length <= 200
        ? v.deviceName
        : null,
    widthMm: v.widthMm === 58 ? 58 : 80,
    autoPrint: typeof v.autoPrint === 'boolean' ? v.autoPrint : d.autoPrint,
    copies: Number.isInteger(copies) ? Math.min(3, Math.max(1, copies)) : d.copies,
    openDrawer: typeof v.openDrawer === 'boolean' ? v.openDrawer : d.openDrawer,
    cutPaper: typeof v.cutPaper === 'boolean' ? v.cutPaper : d.cutPaper,
  }
}

export function loadPrinterSettings(): PrinterSettings {
  try {
    const raw = window.localStorage.getItem(KEY)
    return sanitizePrinterSettings(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_PRINTER_SETTINGS
  }
}

export function savePrinterSettings(settings: PrinterSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sanitizePrinterSettings(settings)))
    window.dispatchEvent(new Event(PRINTER_SETTINGS_EVENT))
  } catch {
    // Not persisted; the defaults still print (with the dialog).
  }
}
