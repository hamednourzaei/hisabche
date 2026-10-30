// packages/ui/src/lib/localize-notification.ts

type TranslateFn = (key: string, values?: Record<string, string | number>) => string

export interface LocalizableNotification {
  title: string
  body?: string | null | undefined
  metadata?: Record<string, unknown> | null | undefined
}

/**
 * Primary translation engine: Uses structured backend keys from `metadata.title_key` and
 * `metadata.body_key` when available, and falls back to regex matching for historical
 * records stored in the live database before backend keys were added.
 */
export function localizeNotification(
  notification: LocalizableNotification,
  t: TranslateFn,
): { title: string; body: string } {
  const meta = notification.metadata || {}
  const params = (meta.params as Record<string, string | number>) || {}

  // 1. Structured backend title_key
  const title =
    meta.title_key && typeof meta.title_key === 'string'
      ? (() => {
          try {
            return t(meta.title_key, params)
          } catch {
            return notification.title
          }
        })()
      : localizeNotificationText(notification.title, t)

  // 2. Structured backend body_key
  let body = notification.body || ''
  if (notification.body) {
    if (meta.body_key && typeof meta.body_key === 'string') {
      try {
        body = t(meta.body_key, params)
      } catch {
        body = notification.body
      }
    } else {
      body = localizeNotificationText(notification.body, t)
    }
  }

  return { title, body }
}

/**
 * Fallback parser for historical/legacy notification records that were persisted
 * in the database as raw Persian strings without i18n keys.
 */
export function localizeNotificationText(raw: string | null | undefined, t: TranslateFn): string {
  if (!raw) return ''
  const trimmed = raw.trim()

  // 1. Invoice created title
  // E.g. "✅ صورت‌حساب جدید ایجاد شد" or "صورت‌حساب جدید ایجاد شد" or "بل جدید ایجاد شد"
  if (/^(?:✅\s*)?(?:صورت‌حساب|بل|invoice)\s*(?:جدید\s*ایجاد\s*شد|created)$/i.test(trimmed)) {
    return t('notifications.invoiceCreated')
  }
  if (/^(?:sales invoice registered|(?:فاکتور|بل)\s*فروش\s*ثبت\s*شد)$/i.test(trimmed)) {
    return t('notifications.saleInvoiceCreated')
  }
  if (/^(?:purchase invoice registered|(?:فاکتور|بل)\s*خرید\s*ثبت\s*شد)$/i.test(trimmed)) {
    return t('notifications.purchaseInvoiceCreated')
  }

  // 2. Invoice registered body
  // E.g. "صورت‌حساب شماره INV-000100 ثبت شد." or "بل شماره INV-000100 ثبت شد."
  const registeredMatch = trimmed.match(
    /^(?:صورت‌حساب|بل)\s*شماره\s*([A-Za-z0-9\-_]+)\s*ثبت\s*شد\.?$/,
  )
  if (registeredMatch?.[1]) {
    return t('notifications.invoiceRegisteredBody', { number: registeredMatch[1] })
  }

  // 3. Invoice paid title
  // E.g. "💰 صورت‌حساب پرداخت شد" or "صورت‌حساب پرداخت شد" or "پرداخت بل ثبت شد"
  if (/^(?:💰\s*)?(?:صورت‌حساب\s*پرداخت\s*شد|پرداخت\s*بل\s*ثبت\s*شد)$/i.test(trimmed)) {
    return t('notifications.invoicePaid')
  }

  // 4. Invoice paid body
  // E.g. "صورت‌حساب شماره INV-000100 پرداخت شد." or "بل شماره INV-000100 پرداخت شد."
  const paidMatch = trimmed.match(/^(?:صورت‌حساب|بل)\s*شماره\s*([A-Za-z0-9\-_]+)\s*پرداخت\s*شد\.?$/)
  if (paidMatch?.[1]) {
    return t('notifications.invoicePaidBody', { number: paidMatch[1] })
  }

  // 5. Payment recorded
  // E.g. "پرداخت PMT-2026-000023 ثبت شد" or "پرداخت PMT-001 ثبت شد."
  const paymentMatch = trimmed.match(/^پرداخت\s*([A-Za-z0-9\-_]+)\s*ثبت\s*شد\.?$/)
  if (paymentMatch?.[1]) {
    return t('notifications.paymentRecorded', { ref: paymentMatch[1] })
  }
  if (/^(?:payment received|دریافت\s*(?:وجه|پول)\s*ثبت\s*شد)$/i.test(trimmed)) {
    return t('notifications.paymentReceived')
  }
  if (/^(?:payment sent|پرداخت\s*ثبت\s*شد)$/i.test(trimmed)) {
    return t('notifications.paymentSent')
  }

  // 6. Customer created
  // E.g. "مشتری جدید: علی احمدی"
  const custMatch = trimmed.match(/^(?:مشتری\s*جدید:\s*|New customer:\s*)(.+)$/i)
  if (custMatch?.[1]) {
    return t('notifications.customerCreated', { name: custMatch[1] })
  }
  if (/^(?:new customer added|مشتری\s*(?:تازه|جدید)\s*اضافه\s*شد)$/i.test(trimmed)) {
    return t('notifications.newCustomerAdded')
  }

  // 7. Overdue invoice
  if (/^(?:صورت‌حساب|بل)\s*سررسید\s*شده$/i.test(trimmed)) {
    return t('notifications.invoiceOverdue')
  }

  // 8. Escalation notifications
  if (trimmed === 'تأییدی که بی‌پاسخ مانده به شما ارجاع شد') {
    return t('notifications.escalatedToYou')
  }
  if (trimmed === 'تأییدی منتظر مانده و کسی برای ارجاع نیست') {
    return t('notifications.escalatedNoOne')
  }

  // 9. Generic status text
  if (trimmed === 'نیاز به تأیید دارد') return t('notifications.requiresApproval')
  if (trimmed === 'تأیید شد') return t('notifications.approved')
  if (trimmed === 'رد شد') return t('notifications.rejected')

  return raw
}
