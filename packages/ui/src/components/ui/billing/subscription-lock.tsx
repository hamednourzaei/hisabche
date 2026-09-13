'use client'

// ============================================
// The expired-subscription lock notice — ONE component, every page.
//
// The server is the authority: it refuses every write on an expired workspace
// with 402 SUBSCRIPTION_EXPIRED (backend/src/middleware/subscription.middleware.ts).
// This file only EXPLAINS that, in three places:
//
//   · SubscriptionLockNotice — lock icon on top, title, explanation, a button
//     to /[lang]/billing. Rendered as the page body for a gated route.
//   · SubscriptionLockDialog — the same notice in a dialog, opened by the api
//     client when any action comes back 402 SUBSCRIPTION_EXPIRED.
//   · useSubscriptionLocked — the server's `access.expired` verdict, so pages
//     can hide create/edit/delete controls. Unknown is NOT locked.
// ============================================

import { Lock } from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useSubscription } from '@hisabche/api'
import { useSubscriptionLockStore } from '@hisabche/store'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../dialog'

/** Routes (locale stripped) an expired workspace may still open, read-only. */
const READ_ONLY_ROUTES: readonly RegExp[] = [
  /^\/?$/,
  /^\/dashboard\/?$/,
  /^\/invoices\/?$/,
  // An invoice by id — but never the builder at /invoices/new.
  /^\/invoices\/(?!new(?:\/|$))[^/]+\/?$/,
  /^\/billing\/?$/,
]

/** Is this path (with or without a /fa|/af|/en prefix) open while expired? */
export function isRouteAllowedWhenExpired(pathname: string): boolean {
  const bare = pathname.split(/[?#]/)[0]?.replace(/^\/(fa|af|en)(?=\/|$)/, '') ?? ''
  return READ_ONLY_ROUTES.some((re) => re.test(bare))
}

/** The billing page in the reader's own locale — never a bare `/billing`. */
export function billingHref(locale: string, hashRouter = false): string {
  return hashRouter ? '/billing' : `/${locale}/billing`
}

/** True only when the server positively says the subscription has ended. */
export function useSubscriptionLocked(): boolean {
  const { data } = useSubscription()
  return data?.access?.expired === true
}

export interface SubscriptionLockNoticeProps {
  /** Desktop routes without a locale prefix (hash router). */
  hashRouter?: boolean | undefined
  onNavigate?: (() => void) | undefined
}

export function SubscriptionLockNotice({ hashRouter, onNavigate }: SubscriptionLockNoticeProps) {
  const t = useTranslations()
  const locale = useLocale()

  return (
    <section
      role="alert"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-3 px-4 py-10 text-center sm:py-16"
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-[hsl(var(--color-warning)/0.12)] text-[hsl(var(--color-warning))] sm:size-16">
        <Lock className="size-7 sm:size-8" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-bold text-[hsl(var(--fg-primary))] sm:text-xl">
        {t('subscriptionLock.title')}
      </h2>
      <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('subscriptionLock.description')}</p>
      <Link
        href={billingHref(locale, Boolean(hashRouter))}
        {...(onNavigate ? { onClick: onNavigate } : {})}
        className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-[var(--gradient-brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 sm:w-auto"
      >
        {t('subscriptionLock.cta')}
      </Link>
    </section>
  )
}

/** Mount once per shell. Opens whenever an action returns 402 SUBSCRIPTION_EXPIRED. */
export function SubscriptionLockDialog({ hashRouter }: { hashRouter?: boolean | undefined }) {
  const t = useTranslations()
  const open = useSubscriptionLockStore((s) => s.noticeOpen)
  const close = useSubscriptionLockStore((s) => s.closeNotice)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">{t('subscriptionLock.title')}</DialogTitle>
        <DialogDescription className="sr-only">
          {t('subscriptionLock.description')}
        </DialogDescription>
        <SubscriptionLockNotice hashRouter={hashRouter} onNavigate={close} />
      </DialogContent>
    </Dialog>
  )
}
