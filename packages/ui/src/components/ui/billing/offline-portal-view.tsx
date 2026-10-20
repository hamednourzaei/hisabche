// ============================================
// packages/ui/src/components/ui/billing/offline-portal-view.tsx
// Web portal view for OFFLINE accounts:
// «the portal only: licence status, devices, billing, upgrade, and export»
// ============================================

'use client'

import React from 'react'
import { HardDrive, Monitor, Key, ArrowUpRight, Download } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../card'
import { billingHref } from './subscription-lock'

export interface OfflinePortalDevice {
  device_id: string
  label?: string | null | undefined
  activated_at: string
  released_at?: string | null | undefined
}

export interface OfflinePortalLicense {
  license_id: string
  plan: string
  issued_at: string
  expires_at: string
  version: number
  device_id?: string | null | undefined
}

export interface UpgradeCreditBreakdown {
  amountPaid: number
  currency: string
  termDays: number
  unusedDays: number
  creditAmount: number
  newPlanPrice: number
  totalDue: number
}

export interface OfflinePortalViewProps {
  licenses?: OfflinePortalLicense[] | undefined
  devices?: OfflinePortalDevice[] | undefined
  creditBreakdown?: UpgradeCreditBreakdown | null | undefined
  hashRouter?: boolean | undefined
}

export function OfflinePortalView({
  licenses = [],
  devices = [],
  creditBreakdown = null,
  hashRouter = false,
}: OfflinePortalViewProps) {
  const t = useTranslations()
  const locale = useLocale()

  const safeT = (key: string, fallback: string): string => {
    try {
      const res = t(key as Parameters<typeof t>[0])
      return res && res !== key ? res : fallback
    } catch {
      return fallback
    }
  }

  const title = safeT(
    'entitlement.offlineAccount.webPortalTitle',
    'پورتال مدیریت اشتراک و لایسنس آفلاین',
  )
  const description = safeT(
    'entitlement.offlineAccount.webPortalMessage',
    'شما از نسخه آفلاین حسابچه استفاده می‌کنید. اطلاعات عملیاتی روی دستگاه محلی شما ذخیره می‌شود. در اینجا می‌توانید وضعیت لایسنس، دستگاه‌ها و ارتقا به نسخه آنلاین را مدیریت کنید.',
  )

  const activeLicense = licenses[0]

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      {/* Portal Header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary)/0.12)] text-[hsl(var(--color-primary))]">
            <HardDrive className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))]">{title}</h1>
            <p className="mt-1 text-sm text-[hsl(var(--fg-secondary))]">{description}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={billingHref(locale, hashRouter)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-brand)] px-4 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            <span>{safeT('entitlement.offlineAccount.upgradePrompt', 'ارتقا به آنلاین')}</span>
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={hashRouter ? '/data-and-sync' : `/${locale}/data-and-sync`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] px-4 text-sm font-semibold text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-muted))]"
          >
            <Download className="size-4 text-[hsl(var(--fg-secondary))]" aria-hidden="true" />
            <span>خروجی و پشتیبان‌گیری</span>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Licence Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              <CardTitle className="text-lg">
                {safeT('entitlement.offlineAccount.licenses', 'لایسنس‌های صادر شده')}
              </CardTitle>
            </div>
            <CardDescription>وضعیت اعتبار لایسنس آفلاین شما</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeLicense ? (
              <div className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--fg-secondary))]">شناسه لایسنس:</span>
                  <span className="font-mono text-xs text-[hsl(var(--fg-primary))]">
                    {activeLicense.license_id.slice(0, 13)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--fg-secondary))]">طرح:</span>
                  <span className="font-semibold text-[hsl(var(--color-primary))]">
                    {activeLicense.plan}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[hsl(var(--fg-secondary))]">تاریخ انقضا:</span>
                  <span className="text-[hsl(var(--fg-primary))]">
                    {new Date(activeLicense.expires_at).toLocaleDateString(locale)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[hsl(var(--fg-tertiary))]">لایسنس فعالی ثبت نشده است.</p>
            )}
          </CardContent>
        </Card>

        {/* Devices Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Monitor className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
              <CardTitle className="text-lg">
                {safeT('entitlement.offlineAccount.devices', 'دستگاه‌های فعال')}
              </CardTitle>
            </div>
            <CardDescription>دستگاه‌های متصل به لایسنس آفلاین</CardDescription>
          </CardHeader>
          <CardContent>
            {devices.length > 0 ? (
              <ul className="space-y-2">
                {devices.map((device) => (
                  <li
                    key={device.device_id}
                    className="flex items-center justify-between rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-[hsl(var(--fg-primary))]">
                        {device.label || 'دستگاه ثبت‌شده'}
                      </p>
                      <p className="font-mono text-xs text-[hsl(var(--fg-tertiary))]">
                        {device.device_id.slice(0, 13)}...
                      </p>
                    </div>
                    <span className="rounded-full bg-[hsl(var(--color-primary)/0.1)] px-2.5 py-0.5 text-xs text-[hsl(var(--color-primary))]">
                      فعال
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[hsl(var(--fg-tertiary))]">دستگاهی ثبت نشده است.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Credit Breakdown */}
      {creditBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {safeT(
                'entitlement.offlineAccount.upgradeCreditTitle',
                'ارتقا به نسخه آنلاین همراه با اعتبار لایسنس آفلاین',
              )}
            </CardTitle>
            <CardDescription>
              {safeT(
                'entitlement.offlineAccount.creditBreakdown',
                'محاسبه اعتبار بر اساس روزهای باقیمانده',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">مبلغ پرداختی اولیه</p>
                <p className="font-semibold text-[hsl(var(--fg-primary))]">
                  {creditBreakdown.amountPaid.toLocaleString()} {creditBreakdown.currency}
                </p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">روزهای باقیمانده لایسنس</p>
                <p className="font-semibold text-[hsl(var(--fg-primary))]">
                  {creditBreakdown.unusedDays} از {creditBreakdown.termDays} روز
                </p>
              </div>
              <div>
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">اعتبار قابل کسر</p>
                <p className="font-semibold text-[hsl(var(--color-primary))]">
                  {creditBreakdown.creditAmount.toLocaleString()} {creditBreakdown.currency}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
