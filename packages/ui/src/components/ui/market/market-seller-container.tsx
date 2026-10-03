'use client'

// ============================================
// packages/ui/src/components/ui/market/market-seller-container.tsx
//
// A business as a SELLER on the goods marketplace: its public profile and its
// listings. Web and desktop both mount this.
//
// ⚠️ THE MARKETPLACE IS OFF BY DEFAULT. Until a platform admin turns it on
// this screen says «بازار هنوز فعال نشده» and offers nothing to fill in — a
// form whose result nobody can see would be theatre (G1).
//
// ⚠️ This is a showcase, not a shop: there is no ordering or online payment,
// and no text here says there is (landing-claims). The price shown is the one
// the seller types here — never taken from the product's own prices.
//
// `verified` and a suspension are the platform's; they are SHOWN here, with
// the reason, and cannot be edited.
// ============================================

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Store } from 'lucide-react'
import {
  apiErrorMessage,
  useDeleteMarketListing,
  useMarketSeller,
  useSaveMarketListing,
  useSaveMarketSellerProfile,
  type MarketListing,
  type MarketListingInput,
  type MarketSellerProfile,
} from '@hisabche/api'
import { CURRENCY_CODES } from '@hisabche/validation'

import { ProductPicker } from '../product-picker'
import {
  ActionButton,
  Badge,
  CapabilityHeader,
  CapabilityPage,
  EmptyState,
  ErrorNote,
  Field,
  ListSection,
  Loading,
  Panel,
  SelectField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../capability/capability-kit'
import { statusOf, walletAmountToMinor, walletDigits, walletMoney } from '../wallet/wallet-format'

const SITE = 'https://hisabche.com'
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

const MARKET_ERRORS = [
  'MARKET_DISABLED',
  'MARKET_NOT_CONFIGURED',
  'MARKET_SLUG_TAKEN',
  'MARKET_LISTING_SLUG_TAKEN',
  'MARKET_PRODUCT_ALREADY_LISTED',
  'MARKET_PRODUCT_NOT_FOUND',
  'MARKET_SELLER_REQUIRED',
  'MARKET_LISTING_NOT_FOUND',
] as const

type T = (key: string, values?: Record<string, string | number>) => string

function marketErrorText(error: unknown, t: T): string {
  const message = apiErrorMessage(error, t('market.errors.generic'))
  const code = MARKET_ERRORS.find((c) => message.startsWith(c))
  return code ? t(`market.errors.${code}`) : message
}

/** Minor units → what a person types («12.50»), without grouping or a sign. */
function minorToInput(minor: number, currency: string): string {
  const digits = walletDigits(currency) ?? 0
  if (digits === 0) return String(minor)
  const text = String(minor).padStart(digits + 1, '0')
  return `${text.slice(0, -digits)}.${text.slice(-digits)}`
}

export function MarketSellerContainer() {
  const t: T = useTranslations()
  const seller = useMarketSeller()
  const status = seller.isError ? statusOf(seller.error) : null

  return (
    <CapabilityPage>
      <CapabilityHeader
        title={t('market.seller.title')}
        description={t('market.seller.description')}
      />

      {seller.isLoading ? (
        <Loading rows={3} />
      ) : status === 403 ? (
        <EmptyState
          title={t('market.seller.forbidden')}
          description={t('market.seller.forbiddenHint')}
        />
      ) : status === 503 ? (
        <EmptyState title={t('market.notConfigured')} description={t('market.notConfiguredHint')} />
      ) : seller.isError ? (
        <ErrorNote
          message={marketErrorText(seller.error, t)}
          onRetry={() => void seller.refetch()}
          retryLabel={t('common.retry')}
        />
      ) : seller.data && !seller.data.enabled ? (
        // The switch is off: say so, and say it is not the business's doing.
        <EmptyState
          icon={<Store className="size-8" aria-hidden="true" />}
          title={t('market.notEnabled')}
          description={t('market.notEnabledHint')}
        />
      ) : seller.data ? (
        <>
          <ProfilePanel t={t} profile={seller.data.profile} />
          {seller.data.profile ? (
            <Listings t={t} profile={seller.data.profile} listings={seller.data.listings} />
          ) : (
            <EmptyState title={t('market.listings.needProfile')} />
          )}
        </>
      ) : null}
    </CapabilityPage>
  )
}

// ─── Profile ─────────────────────────────────────────────────────────────

function ProfilePanel({ t, profile }: { t: T; profile: MarketSellerProfile | null }) {
  const lang = useLocale()
  const save = useSaveMarketSellerProfile()
  const [slug, setSlug] = useState(profile?.slug ?? '')
  const [name, setName] = useState(profile?.name ?? '')
  const [description, setDescription] = useState(profile?.description ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [country, setCountry] = useState(profile?.country ?? '')
  const [contact, setContact] = useState(profile?.contact ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = () => {
    setLocalError(null)
    const cleanSlug = slug.trim().toLowerCase()
    if (!SLUG.test(cleanSlug) || cleanSlug.length < 3) return setLocalError(t('market.slugInvalid'))
    if (!name.trim()) return setLocalError(t('market.profile.nameRequired'))
    const cleanCountry = country.trim().toUpperCase()
    if (cleanCountry && !/^[A-Z]{2}$/.test(cleanCountry)) {
      return setLocalError(t('market.profile.countryInvalid'))
    }
    save.mutate({
      slug: cleanSlug,
      name: name.trim(),
      description: description.trim(),
      city: city.trim(),
      country: cleanCountry,
      contact: contact.trim(),
    })
  }

  return (
    <Panel
      title={t('market.profile.title')}
      description={t('market.profile.hint')}
      action={
        profile ? (
          <Badge tone={profile.verified ? 'good' : 'neutral'}>
            {profile.verified ? t('market.profile.verified') : t('market.profile.notVerified')}
          </Badge>
        ) : null
      }
    >
      <div className="space-y-4">
        {profile?.status === 'suspended' ? (
          <ErrorNote
            message={t('market.profile.suspended', { reason: profile.suspendedReason ?? '—' })}
          />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('market.profile.name')} value={name} onChange={setName} />
          <Field label={t('market.profile.slug')} value={slug} onChange={setSlug} dir="ltr" />
          <Field label={t('market.profile.city')} value={city} onChange={setCity} />
          <Field
            label={t('market.profile.country')}
            value={country}
            onChange={setCountry}
            dir="ltr"
          />
          <Field label={t('market.profile.contact')} value={contact} onChange={setContact} />
        </div>
        <Field
          label={t('market.profile.description')}
          value={description}
          onChange={setDescription}
        />
        {profile ? (
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">
            {t('market.profile.address')}{' '}
            <span dir="ltr" className="select-all font-mono">
              {`${SITE}/${lang}/market/${profile.slug}`}
            </span>
          </p>
        ) : null}
        {localError ? <ErrorNote message={localError} /> : null}
        {save.isError ? <ErrorNote message={marketErrorText(save.error, t)} /> : null}
        {save.isSuccess ? (
          <p role="status" className="text-sm text-[hsl(var(--color-success))]">
            {t('market.saved')}
          </p>
        ) : null}
        <ActionButton disabled={save.isPending} onClick={submit}>
          {t('market.profile.save')}
        </ActionButton>
      </div>
    </Panel>
  )
}

// ─── Listings ────────────────────────────────────────────────────────────

const STATUS_TONE: Record<MarketListing['status'], string> = {
  draft: 'neutral',
  active: 'good',
  paused: 'warn',
}

function Listings({
  t,
  profile,
  listings,
}: {
  t: T
  profile: MarketSellerProfile
  listings: MarketListing[]
}) {
  const lang = useLocale()
  const remove = useDeleteMarketListing()
  // null = closed; 'new' = a new listing; otherwise the listing being edited.
  const [editing, setEditing] = useState<MarketListing | 'new' | null>(null)

  /** Is this listing on the public site right now? (The product must be active too.) */
  const isPublic = (row: MarketListing) =>
    profile.status === 'active' && row.status === 'active' && !row.isHidden && !row.suspended

  return (
    <ListSection
      title={t('market.listings.title')}
      description={t('market.listings.hint')}
      action={
        <ActionButton variant="quiet" onClick={() => setEditing('new')}>
          {t('market.listings.add')}
        </ActionButton>
      }
    >
      {editing ? (
        <ListingForm
          key={editing === 'new' ? 'new' : editing.id}
          t={t}
          listing={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : null}

      {listings.length === 0 ? (
        <EmptyState title={t('market.listings.empty')} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('market.listing.title')}</TableHead>
                <TableHead className="text-end">{t('market.listing.price')}</TableHead>
                <TableHead>{t('market.listing.status')}</TableHead>
                <TableHead>{t('market.listing.availability')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="font-medium">{row.title}</span>
                    {isPublic(row) ? (
                      <a
                        href={`${SITE}/${lang}/market/${profile.slug}/${row.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-[hsl(var(--color-primary))] underline"
                      >
                        {t('market.listings.view')}
                      </a>
                    ) : (
                      // §7.5: «not shown» is said, with the reason nearest to hand.
                      <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
                        {row.suspended
                          ? t('market.listings.suspended', { reason: row.suspendedReason ?? '—' })
                          : t('market.listings.notPublic')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell dir="ltr" className="text-end tabular-nums">
                    {walletMoney(row.priceMinor, row.currency, lang)}
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONE[row.status]}>{t(`market.status.${row.status}`)}</Badge>
                    {row.isHidden ? (
                      <span className="ms-1 text-xs text-[hsl(var(--fg-tertiary))]">
                        {t('market.listing.hidden')}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{t(`market.availability.${row.availability}`)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <ActionButton variant="quiet" onClick={() => setEditing(row)}>
                        {t('market.listings.edit')}
                      </ActionButton>
                      <ActionButton
                        variant="danger"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (confirm(t('market.listings.deleteConfirm'))) remove.mutate(row.id)
                        }}
                      >
                        {t('market.listings.delete')}
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {remove.isError ? <ErrorNote message={marketErrorText(remove.error, t)} /> : null}
    </ListSection>
  )
}

function ListingForm({
  t,
  listing,
  onDone,
}: {
  t: T
  listing: MarketListing | null
  onDone: () => void
}) {
  const save = useSaveMarketListing()
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null)
  const [slug, setSlug] = useState(listing?.slug ?? '')
  const [title, setTitle] = useState(listing?.title ?? '')
  const [description, setDescription] = useState(listing?.description ?? '')
  const [currency, setCurrency] = useState(listing?.currency ?? 'USD')
  const [price, setPrice] = useState(
    listing ? minorToInput(listing.priceMinor, listing.currency) : '',
  )
  const [availability, setAvailability] = useState(listing?.availability ?? 'in_stock')
  const [quantity, setQuantity] = useState(
    listing?.quantity === null || listing?.quantity === undefined ? '' : String(listing.quantity),
  )
  const [status, setStatus] = useState(listing?.status ?? 'draft')
  const [isHidden, setIsHidden] = useState(listing?.isHidden ?? false)
  const [seoTitle, setSeoTitle] = useState(listing?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(listing?.seoDescription ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = () => {
    setLocalError(null)
    const productId = listing?.productId ?? product?.id
    if (!productId) return setLocalError(t('market.listing.productRequired'))
    const cleanSlug = slug.trim().toLowerCase()
    if (!SLUG.test(cleanSlug) || cleanSlug.length < 3) return setLocalError(t('market.slugInvalid'))
    if (!title.trim()) return setLocalError(t('market.listing.titleRequired'))
    const priceMinor = walletAmountToMinor(price, currency)
    if (priceMinor === null || priceMinor <= 0)
      return setLocalError(t('market.listing.priceInvalid'))
    const stated = quantity.trim() === '' ? null : Number(quantity)
    if (stated !== null && (!Number.isInteger(stated) || stated < 0)) {
      return setLocalError(t('market.listing.quantityInvalid'))
    }
    const input: MarketListingInput = {
      productId,
      slug: cleanSlug,
      title: title.trim(),
      description: description.trim(),
      priceMinor,
      currency,
      availability,
      quantity: stated,
      isHidden,
      status,
      seoTitle: seoTitle.trim(),
      seoDescription: seoDescription.trim(),
    }
    save.mutate({ id: listing?.id ?? null, input }, { onSuccess: onDone })
  }

  return (
    <Panel title={listing ? t('market.listing.editTitle') : t('market.listing.newTitle')}>
      <div className="space-y-4">
        {listing ? null : (
          <div className="space-y-1.5" data-field="productId">
            <span className="text-sm font-medium text-[hsl(var(--fg-primary))]">
              {t('market.listing.product')}
            </span>
            <ProductPicker
              value={product ? { ...product, sellPrice: 0, unit: '' } : null}
              onChange={(picked) => {
                setProduct(picked ? { id: picked.id, name: picked.name } : null)
                // A starting point the seller then edits — never the price.
                if (picked && !title) setTitle(picked.name)
              }}
            />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('market.listing.title')} value={title} onChange={setTitle} />
          <Field label={t('market.listing.slug')} value={slug} onChange={setSlug} dir="ltr" />
          <Field
            label={t('market.listing.priceIn', { currency })}
            value={price}
            onChange={setPrice}
            dir="ltr"
          />
          <SelectField
            label={t('market.listing.currency')}
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_CODES.map((code) => ({ value: code, label: code }))}
          />
          <SelectField
            label={t('market.listing.availability')}
            value={availability}
            onChange={(value) => setAvailability(value as MarketListing['availability'])}
            options={[
              { value: 'in_stock', label: t('market.availability.in_stock') },
              { value: 'out_of_stock', label: t('market.availability.out_of_stock') },
            ]}
          />
          <Field
            label={t('market.listing.quantity')}
            value={quantity}
            onChange={setQuantity}
            dir="ltr"
          />
          <SelectField
            label={t('market.listing.status')}
            value={status}
            onChange={(value) => setStatus(value as MarketListing['status'])}
            options={[
              { value: 'draft', label: t('market.status.draft') },
              { value: 'active', label: t('market.status.active') },
              { value: 'paused', label: t('market.status.paused') },
            ]}
          />
        </div>
        <Field
          label={t('market.listing.description')}
          value={description}
          onChange={setDescription}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('market.listing.seoTitle')} value={seoTitle} onChange={setSeoTitle} />
          <Field
            label={t('market.listing.seoDescription')}
            value={seoDescription}
            onChange={setSeoDescription}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isHidden}
            onChange={(event) => setIsHidden(event.target.checked)}
          />
          {t('market.listing.hide')}
        </label>

        {localError ? <ErrorNote message={localError} /> : null}
        {save.isError ? <ErrorNote message={marketErrorText(save.error, t)} /> : null}
        <div className="flex flex-wrap gap-2">
          <ActionButton disabled={save.isPending} onClick={submit}>
            {t('market.listing.save')}
          </ActionButton>
          <ActionButton variant="quiet" onClick={onDone}>
            {t('market.listing.cancel')}
          </ActionButton>
        </div>
      </div>
    </Panel>
  )
}
