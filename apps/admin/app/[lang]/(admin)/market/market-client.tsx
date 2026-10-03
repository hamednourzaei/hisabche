'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { apiErrorMessage, type MarketSellerProfile } from '@hisabche/api'
import { walletMoney } from '@hisabche/ui'

import { Button, Input } from '@/components/ui'
import { EmptyState, ErrorState, ListSkeleton, Panel } from '@/components/admin-shell/admin-ui'
import {
  useAdminMarketListings,
  useAdminMarketSellers,
  useAdminMarketState,
  useSetListingSuspended,
  useSetMarketEnabled,
  useSetSellerStatus,
  useSetSellerVerified,
  type AdminMarketListing,
} from '@/hooks/use-admin-market'

/**
 * The goods marketplace, from the platform side.
 *
 * The switch decides whether the marketplace exists at all: OFF (the default)
 * the public pages are 404 and sellers see «not enabled yet». Below it: the
 * sellers — verify one, suspend one (with the reason the seller will read) —
 * and a seller's listings, each of which can be suspended on its own.
 */
export function MarketClient() {
  const t = useTranslations()
  const state = useAdminMarketState()
  const setEnabled = useSetMarketEnabled()
  const [q, setQ] = useState('')
  const [submitted, setSubmitted] = useState('')
  const sellers = useAdminMarketSellers(submitted)
  const [open, setOpen] = useState<MarketSellerProfile | null>(null)

  const notConfigured =
    state.isError && apiErrorMessage(state.error, '').startsWith('MARKET_NOT_CONFIGURED')

  if (state.isLoading) return <ListSkeleton rows={2} />
  if (notConfigured) {
    return (
      <EmptyState title={t('market.notConfigured')} hint={t('admin.market.notConfiguredHint')} />
    )
  }
  if (state.isError) {
    return <ErrorState message={t('admin.error.generic')} onRetry={() => void state.refetch()} />
  }

  const enabled = state.data?.enabled === true

  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">
            {enabled ? t('admin.market.switchOn') : t('admin.market.switchOff')}
          </p>
          <p className="text-xs text-muted-foreground">{t('admin.market.switchHint')}</p>
        </div>
        <Button
          variant={enabled ? 'outline' : 'default'}
          disabled={setEnabled.isPending}
          onClick={() => {
            const question = enabled ? t('admin.market.confirmOff') : t('admin.market.confirmOn')
            if (confirm(question)) setEnabled.mutate(!enabled)
          }}
        >
          {enabled ? t('admin.market.turnOff') : t('admin.market.turnOn')}
        </Button>
        {setEnabled.isError ? (
          <p role="alert" className="w-full text-xs text-destructive">
            {apiErrorMessage(setEnabled.error, t('admin.error.generic'))}
          </p>
        ) : null}
      </Panel>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setOpen(null)
          setSubmitted(q)
        }}
      >
        <Input
          value={q}
          maxLength={100}
          placeholder={t('admin.market.searchPlaceholder')}
          onChange={(event) => setQ(event.target.value)}
          className="w-72"
        />
        <Button type="submit">{t('admin.market.search')}</Button>
      </form>

      {sellers.isError ? (
        <ErrorState message={t('admin.error.generic')} onRetry={() => void sellers.refetch()} />
      ) : sellers.isLoading ? (
        <ListSkeleton rows={3} height="h-16" />
      ) : (sellers.data ?? []).length === 0 ? (
        <EmptyState title={t('admin.market.noSellers')} />
      ) : (
        <ul className="space-y-2">
          {(sellers.data ?? []).map((seller) => (
            <SellerRow
              key={seller.workspaceId}
              seller={seller}
              isOpen={open?.workspaceId === seller.workspaceId}
              onToggle={() => setOpen(open?.workspaceId === seller.workspaceId ? null : seller)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function SellerRow({
  seller,
  isOpen,
  onToggle,
}: {
  seller: MarketSellerProfile
  isOpen: boolean
  onToggle: () => void
}) {
  const t = useTranslations()
  const setStatus = useSetSellerStatus()
  const setVerified = useSetSellerVerified()
  const [reason, setReason] = useState('')
  const suspended = seller.status === 'suspended'

  return (
    <Panel as="li" className="space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{seller.name}</span>
        <code dir="ltr" className="font-mono text-xs">
          /market/{seller.slug}
        </code>
        <span className="text-xs text-muted-foreground">
          {suspended ? t('admin.market.suspended') : t('admin.market.active')} ·{' '}
          {seller.verified ? t('admin.market.verified') : t('admin.market.notVerified')}
        </span>
      </div>
      {suspended && seller.suspendedReason ? (
        <p className="text-xs text-muted-foreground">{seller.suspendedReason}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={setVerified.isPending}
          onClick={() =>
            setVerified.mutate({ workspaceId: seller.workspaceId, verified: !seller.verified })
          }
        >
          {seller.verified ? t('admin.market.unverify') : t('admin.market.verify')}
        </Button>
        {suspended ? (
          <Button
            size="sm"
            variant="outline"
            disabled={setStatus.isPending}
            onClick={() =>
              setStatus.mutate({ workspaceId: seller.workspaceId, status: 'active', reason: '' })
            }
          >
            {t('admin.market.reactivate')}
          </Button>
        ) : (
          <>
            <label className="min-w-[200px] flex-1 space-y-1">
              <span className="block text-[11px] text-muted-foreground">
                {t('admin.market.reason')}
              </span>
              <Input
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              // The seller reads this reason: no suspension without one.
              disabled={setStatus.isPending || reason.trim() === ''}
              onClick={() =>
                setStatus.mutate({ workspaceId: seller.workspaceId, status: 'suspended', reason })
              }
            >
              {t('admin.market.suspend')}
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" className="ms-auto" onClick={onToggle}>
          {isOpen ? t('admin.market.hideListings') : t('admin.market.showListings')}
        </Button>
      </div>

      {setStatus.isError || setVerified.isError ? (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(setStatus.error ?? setVerified.error, t('admin.error.generic'))}
        </p>
      ) : null}

      {isOpen ? <SellerListings workspaceId={seller.workspaceId} /> : null}
    </Panel>
  )
}

function SellerListings({ workspaceId }: { workspaceId: string }) {
  const t = useTranslations()
  const listings = useAdminMarketListings(workspaceId)

  if (listings.isError) {
    return <ErrorState message={t('admin.error.generic')} onRetry={() => void listings.refetch()} />
  }
  if (listings.isLoading) return <ListSkeleton rows={2} height="h-12" />
  if ((listings.data ?? []).length === 0) {
    return <p className="text-xs text-muted-foreground">{t('market.listings.empty')}</p>
  }
  return (
    <ul className="divide-y divide-border">
      {(listings.data ?? []).map((listing) => (
        <ListingRow key={listing.id} listing={listing} />
      ))}
    </ul>
  )
}

function ListingRow({ listing }: { listing: AdminMarketListing }) {
  const t = useTranslations()
  const lang = useLocale()
  const suspend = useSetListingSuspended()
  const [reason, setReason] = useState('')

  return (
    <li className="space-y-2 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">{listing.title}</span>
        <span dir="ltr" className="tabular-nums">
          {walletMoney(listing.priceMinor, listing.currency, lang)}
        </span>
        <span className="text-muted-foreground">{t(`market.status.${listing.status}`)}</span>
        {listing.suspended ? (
          <span className="text-destructive">
            {t('admin.market.suspended')}
            {listing.suspendedReason ? `: ${listing.suspendedReason}` : ''}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {listing.suspended ? (
          <Button
            size="sm"
            variant="outline"
            disabled={suspend.isPending}
            onClick={() => suspend.mutate({ id: listing.id, suspended: false, reason: '' })}
          >
            {t('admin.market.reactivate')}
          </Button>
        ) : (
          <>
            <Input
              value={reason}
              maxLength={500}
              placeholder={t('admin.market.reason')}
              onChange={(event) => setReason(event.target.value)}
              className="w-64"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={suspend.isPending || reason.trim() === ''}
              onClick={() => suspend.mutate({ id: listing.id, suspended: true, reason })}
            >
              {t('admin.market.suspend')}
            </Button>
          </>
        )}
      </div>
      {suspend.isError ? (
        <p role="alert" className="text-destructive">
          {apiErrorMessage(suspend.error, t('admin.error.generic'))}
        </p>
      ) : null}
    </li>
  )
}
