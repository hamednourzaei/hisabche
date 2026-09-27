// ============================================
// What a scan could not settle on its own — said where the cashier is looking.
//
//   unknown   → the code is on no product. No line is guessed; the cashier
//               may define the product with this barcode already filled in.
//   ambiguous → the code is on several products. The cashier picks one —
//               never silently the first.
//   error     → the lookup itself failed (offline and not on this device, or
//               the server). Distinct from «unknown»: saying «unknown» here
//               would invite creating a product that already exists.
// ============================================
'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { Product } from '@hisabche/validation'

import { Button } from '../button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog'

export type ScanProblem =
  | { kind: 'unknown'; barcode: string }
  | { kind: 'ambiguous'; barcode: string; products: Product[] }
  | { kind: 'error'; barcode: string; offline: boolean }

interface BarcodeScanDialogProps {
  t: (key: string) => string
  problem: ScanProblem | null
  onPick: (product: Product) => void
  onRetry: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanDialog({
  t,
  problem,
  onPick,
  onRetry,
  onClose,
}: BarcodeScanDialogProps) {
  const params = useParams<{ lang?: string }>()
  const lang = params?.lang ?? 'fa'
  if (!problem) return null
  const code = problem.barcode

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-barcode-dialog={problem.kind}>
        <DialogHeader>
          <DialogTitle>
            {problem.kind === 'unknown'
              ? t('barcode.unknownTitle')
              : problem.kind === 'ambiguous'
                ? t('barcode.ambiguousTitle')
                : t('barcode.errorTitle')}
          </DialogTitle>
          <DialogDescription>
            <span dir="ltr" className="font-mono tabular-nums">
              {code}
            </span>
            {' — '}
            {problem.kind === 'unknown'
              ? t('barcode.unknownBody')
              : problem.kind === 'ambiguous'
                ? t('barcode.ambiguousBody')
                : problem.offline
                  ? t('barcode.errorOffline')
                  : t('barcode.errorBody')}
          </DialogDescription>
        </DialogHeader>

        {problem.kind === 'ambiguous' ? (
          <ul className="space-y-2">
            {problem.products.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onPick(product)}
                  className="flex w-full items-center justify-between rounded-lg border border-[hsl(var(--border-default))] px-3 py-2 text-start text-sm hover:bg-[hsl(var(--surface-muted))]"
                >
                  <span>{product.name}</span>
                  {product.sku ? (
                    <span dir="ltr" className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {product.sku}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter className="gap-2">
          {problem.kind === 'unknown' ? (
            <Button asChild>
              {/* The barcode is carried over; nothing about the product is guessed. */}
              <Link href={`/${lang}/warehouse?add=true&barcode=${encodeURIComponent(code)}`}>
                {t('barcode.createProduct')}
              </Link>
            </Button>
          ) : null}
          {problem.kind === 'error' ? (
            <Button type="button" onClick={() => onRetry(code)}>
              {t('common.retry')}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
