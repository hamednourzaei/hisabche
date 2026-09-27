// ============================================
// Settings → «صندوق و سخت‌افزار»: the barcode scanner and the receipt printer
// of THIS device (both are facts about the machine, kept in its storage).
//
// The scanner test is the point of the panel: a cashier scans one product
// before opening the shop and sees the code, how long the burst took and what
// it resolved to. A wrong suffix or a slow Bluetooth scanner shows up here,
// not in the middle of a sale.
// ============================================
'use client'

import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Printer, ScanBarcode } from 'lucide-react'
import { lookupProductByBarcode, type BarcodeLookup } from '@hisabche/api'

import { Switch } from '../switch'
import { SelectField } from '../select-field'
import { useBarcodeScanner } from '../../../hooks/use-barcode-scanner'
import type { BarcodeScan, ScannerConfig } from '../../../lib/barcode/scan-detector'
import { loadScannerConfig, saveScannerConfig } from '../../../lib/barcode/scanner-settings'
import { getReceiptPrinterHost, type HostPrinter } from '../../../lib/print/printer-host'
import { printReceipt } from '../../../lib/print/print-receipt'
import {
  loadPrinterSettings,
  savePrinterSettings,
  type PrinterSettings,
} from '../../../lib/print/printer-settings'
import { renderReceiptHtml } from '../../../lib/print/receipt-html'
import { useToast } from '../toast-provider'

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const numberInput =
  'h-9 w-24 rounded-lg border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-2 text-sm tabular-nums'

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string | undefined
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">{label}</p>
        {hint ? <p className="text-xs text-[hsl(var(--fg-tertiary))]">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

export const HardwareSection = memo(function HardwareSection() {
  const t = useTranslations()
  const toast = useToast()

  // Device settings are read after mount — never during render (hydration).
  const [scanner, setScanner] = useState<ScannerConfig | null>(null)
  const [printer, setPrinter] = useState<PrinterSettings | null>(null)
  const [printers, setPrinters] = useState<HostPrinter[] | null>(null)
  const [hasHost, setHasHost] = useState(false)

  useEffect(() => {
    setScanner(loadScannerConfig())
    setPrinter(loadPrinterSettings())
    const host = getReceiptPrinterHost()
    setHasHost(host !== null)
    if (host) {
      host.listPrinters().then(setPrinters, () => setPrinters([]))
    }
  }, [])

  const updateScanner = useCallback((patch: Partial<ScannerConfig>) => {
    setScanner((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      saveScannerConfig(next)
      return next
    })
  }, [])

  const updatePrinter = useCallback((patch: Partial<PrinterSettings>) => {
    setPrinter((current) => {
      if (!current) return current
      const next = { ...current, ...patch }
      savePrinterSettings(next)
      return next
    })
  }, [])

  // ── scanner test ─────────────────────────────────────────────────────────
  const [lastScan, setLastScan] = useState<BarcodeScan | null>(null)
  const [lastLookup, setLastLookup] = useState<BarcodeLookup | null>(null)
  useBarcodeScanner(
    (scan) => {
      setLastScan(scan)
      setLastLookup(null)
      void lookupProductByBarcode(scan.value).then(setLastLookup)
    },
    { enabled: scanner?.enabled !== false },
  )

  const lookupText = (lookup: BarcodeLookup | null): string => {
    if (!lookup) return '…'
    if (lookup.status === 'found')
      return `${lookup.product.name} (${t(lookup.source === 'device' ? 'hardware.fromDevice' : 'hardware.fromServer')})`
    if (lookup.status === 'ambiguous') return t('barcode.ambiguousTitle')
    if (lookup.status === 'unknown') return t('barcode.unknownTitle')
    return t('barcode.errorTitle')
  }

  // ── test print ───────────────────────────────────────────────────────────
  const testPrint = useCallback(async () => {
    if (!printer) return
    const html = renderReceiptHtml(
      {
        businessName: t('hardware.testReceiptTitle'),
        invoiceNumber: 'TEST',
        date: new Date().toLocaleString(),
        lines: [{ name: t('hardware.testReceiptLine'), quantity: '1', unitPrice: '0', total: '0' }],
        subtotal: '0',
        total: '0',
        paid: '0',
        remaining: '0',
        currency: '',
        footer: t('hardware.testReceiptFooter'),
      },
      {
        invoice: t('receipt.invoice'),
        date: t('receipt.date'),
        customer: t('receipt.customer'),
        item: t('receipt.item'),
        quantity: t('receipt.quantity'),
        price: t('receipt.price'),
        amount: t('receipt.amount'),
        subtotal: t('receipt.subtotal'),
        discount: t('receipt.discount'),
        tax: t('receipt.tax'),
        total: t('receipt.total'),
        paid: t('receipt.paid'),
        remaining: t('receipt.remaining'),
      },
      {
        widthMm: printer.widthMm,
        direction: document.documentElement.dir === 'ltr' ? 'ltr' : 'rtl',
        lang: document.documentElement.lang || 'fa',
      },
    )
    const outcome = await printReceipt(html, printer)
    if (outcome.status === 'printed') toast.success(t('receipt.printed'))
    if (outcome.status === 'failed') {
      toast.error(
        outcome.reason === 'drawer' ? t('receipt.drawerFailed') : t('receipt.printFailed'),
        t('receipt.printFailedHint'),
      )
    }
  }, [printer, t, toast])

  if (!scanner || !printer) return null

  return (
    <div className={card} data-hardware-settings="">
      <div className="space-y-8 p-6">
        {/* ── Scanner ───────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ScanBarcode className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {t('hardware.scannerTitle')}
            </h2>
          </div>
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('hardware.scannerIntro')}</p>

          <Row label={t('hardware.scannerEnabled')}>
            <Switch
              checked={scanner.enabled}
              onCheckedChange={(enabled) => updateScanner({ enabled })}
            />
          </Row>
          <Row label={t('hardware.suffix')} hint={t('hardware.suffixHint')}>
            <SelectField
              value={scanner.suffix}
              onChange={(suffix) => updateScanner({ suffix: suffix as ScannerConfig['suffix'] })}
              options={[
                { value: 'Enter', label: 'Enter' },
                { value: 'Tab', label: 'Tab' },
                { value: 'none', label: t('hardware.suffixNone') },
              ]}
              aria-label={t('hardware.suffix')}
            />
          </Row>
          <Row label={t('hardware.length')}>
            <div className="flex items-center gap-2 text-sm">
              <input
                type="number"
                min={1}
                max={64}
                aria-label={t('hardware.minLength')}
                value={scanner.minLength}
                onChange={(e) => updateScanner({ minLength: Number(e.target.value) })}
                className={numberInput}
              />
              <span>–</span>
              <input
                type="number"
                min={1}
                max={128}
                aria-label={t('hardware.maxLength')}
                value={scanner.maxLength}
                onChange={(e) => updateScanner({ maxLength: Number(e.target.value) })}
                className={numberInput}
              />
            </div>
          </Row>
          <Row label={t('hardware.speed')} hint={t('hardware.speedHint')}>
            <input
              type="number"
              min={5}
              max={300}
              aria-label={t('hardware.speed')}
              value={scanner.maxInterKeyMs}
              onChange={(e) => updateScanner({ maxInterKeyMs: Number(e.target.value) })}
              className={numberInput}
            />
          </Row>

          <div
            className="rounded-xl border border-dashed border-[hsl(var(--border-default))] p-4 text-sm"
            aria-live="polite"
            data-scanner-test=""
          >
            <p className="font-medium text-[hsl(var(--fg-primary))]">{t('hardware.testTitle')}</p>
            {lastScan ? (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-[hsl(var(--fg-tertiary))]">{t('hardware.detected')}</dt>
                <dd dir="ltr" className="font-mono">
                  {lastScan.value}
                </dd>
                <dt className="text-[hsl(var(--fg-tertiary))]">{t('hardware.duration')}</dt>
                <dd className="tabular-nums">{Math.round(lastScan.durationMs)} ms</dd>
                <dt className="text-[hsl(var(--fg-tertiary))]">{t('hardware.product')}</dt>
                <dd>{lookupText(lastLookup)}</dd>
              </dl>
            ) : (
              <p className="mt-1 text-[hsl(var(--fg-tertiary))]">{t('hardware.testWaiting')}</p>
            )}
          </div>
        </section>

        {/* ── Receipt printer ───────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Printer className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
            <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))]">
              {t('hardware.printerTitle')}
            </h2>
          </div>

          {hasHost ? (
            <Row label={t('hardware.printer')} hint={t('hardware.printerHint')}>
              <SelectField
                value={printer.deviceName ?? ''}
                onChange={(name) => updatePrinter({ deviceName: name || null })}
                options={[
                  { value: '', label: t('hardware.askEachTime') },
                  ...(printers ?? []).map((p) => ({
                    value: p.name,
                    label: p.isDefault
                      ? `${p.displayName} — ${t('hardware.default')}`
                      : p.displayName,
                  })),
                ]}
                aria-label={t('hardware.printer')}
              />
            </Row>
          ) : (
            <p className="rounded-lg bg-[hsl(var(--surface-muted))] p-3 text-sm text-[hsl(var(--fg-secondary))]">
              {t('hardware.webNote')}
            </p>
          )}

          <Row label={t('hardware.paperWidth')}>
            <SelectField
              value={String(printer.widthMm)}
              onChange={(v) => updatePrinter({ widthMm: v === '58' ? 58 : 80 })}
              options={[
                { value: '80', label: '80 mm' },
                { value: '58', label: '58 mm' },
              ]}
              aria-label={t('hardware.paperWidth')}
            />
          </Row>
          <Row label={t('hardware.autoPrint')} hint={t('hardware.autoPrintHint')}>
            <Switch
              checked={printer.autoPrint}
              onCheckedChange={(autoPrint) => updatePrinter({ autoPrint })}
            />
          </Row>
          <Row label={t('hardware.copies')}>
            <SelectField
              value={String(printer.copies)}
              onChange={(v) => updatePrinter({ copies: Number(v) })}
              options={['1', '2', '3'].map((v) => ({ value: v, label: v }))}
              aria-label={t('hardware.copies')}
            />
          </Row>
          {hasHost ? (
            <>
              <Row label={t('hardware.openDrawer')} hint={t('hardware.escPosHint')}>
                <Switch
                  checked={printer.openDrawer}
                  onCheckedChange={(openDrawer) => updatePrinter({ openDrawer })}
                />
              </Row>
              <Row label={t('hardware.cutPaper')}>
                <Switch
                  checked={printer.cutPaper}
                  onCheckedChange={(cutPaper) => updatePrinter({ cutPaper })}
                />
              </Row>
            </>
          ) : null}

          <button
            type="button"
            onClick={() => void testPrint()}
            className="rounded-full border border-[hsl(var(--border-default))] px-4 py-2 text-sm hover:bg-[hsl(var(--surface-muted))]"
          >
            {t('hardware.testPrint')}
          </button>
        </section>
      </div>
    </div>
  )
})
HardwareSection.displayName = 'HardwareSection'
