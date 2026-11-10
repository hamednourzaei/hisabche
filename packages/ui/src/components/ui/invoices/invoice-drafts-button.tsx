'use client'

// ============================================
// «پیش‌نویس‌ها» on the invoices page (QA-005, 9 Nov 2026).
//
// The drafts this person saved from the invoice builder, kept on the server
// (user-state-01) so they show on every device. «ادامه» puts one back into
// the builder; «حذف» throws it away. A draft is not an invoice — it has no
// number and moved nothing — so it is listed apart from the invoices.
//
// Nothing is drawn while there is no draft, or before the migration runs.
// ============================================

import { useState } from 'react'
import { FilePen, Trash2 } from 'lucide-react'
import {
  apiErrorMessage,
  useDeleteInvoiceDraft,
  useInvoiceDrafts,
  type InvoiceDraftRecord,
} from '@hisabche/api'
import { useInvoiceDraftStore } from '@hisabche/store'

import { Button } from '../button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../dialog'
import { useToast } from '../toast-provider'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useLocalePush } from '../../../hooks/use-locale-push'

const KIND_KEY: Record<InvoiceDraftRecord['kind'], string> = {
  sale: 'invoices.drafts.kind.sale',
  purchase: 'invoices.drafts.kind.purchase',
  pre_sale: 'invoices.drafts.kind.pre_sale',
  pre_purchase: 'invoices.drafts.kind.pre_purchase',
}

export function InvoiceDraftsButton({ t }: { t: (key: string, fallback?: string) => string }) {
  const [open, setOpen] = useState(false)
  const query = useInvoiceDrafts()
  const { mutate: remove, isPending: removing } = useDeleteInvoiceDraft()
  const loadDraft = useInvoiceDraftStore((s) => s.loadDraft)
  const push = useLocalePush()
  const toast = useToast()
  const { dateTime } = useDateFormat()

  const drafts = query.data?.drafts ?? []
  if (!query.data?.configured || drafts.length === 0) return null

  const resume = (draft: InvoiceDraftRecord) => {
    loadDraft(draft.id, draft.payload)
    setOpen(false)
    push(`/invoices/new?type=${draft.kind}`)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-guide="invoices-drafts"
      >
        <FilePen className="h-4 w-4" aria-hidden />
        <span>
          {t('invoices.drafts.open', 'پیش‌نویس‌ها')} ({drafts.length})
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{t('invoices.drafts.title', 'پیش‌نویس‌های ذخیره‌شده')}</DialogTitle>
          <DialogDescription>
            {t(
              'invoices.drafts.description',
              'پیش‌نویس فاکتور نیست: شماره ندارد و چیزی را جابه‌جا نکرده. ادامه بده تا ثبتش کنی.',
            )}
          </DialogDescription>
          <ul className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[hsl(var(--fg-primary))]">
                    {draft.title || t('invoices.drafts.untitled', 'بدون عنوان')}
                  </p>
                  <p className="text-xs text-[hsl(var(--fg-secondary))]">
                    {t(KIND_KEY[draft.kind])} · {dateTime(draft.updatedAt)}
                  </p>
                </div>
                <Button size="sm" onClick={() => resume(draft)}>
                  {t('invoices.drafts.resume', 'ادامه')}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={removing}
                  aria-label={t('invoices.drafts.delete', 'حذف پیش‌نویس')}
                  onClick={() =>
                    remove(draft.id, {
                      onError: (error) =>
                        toast.error(
                          apiErrorMessage(
                            error,
                            t('invoices.drafts.deleteFailed', 'پیش‌نویس حذف نشد'),
                          ),
                        ),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
