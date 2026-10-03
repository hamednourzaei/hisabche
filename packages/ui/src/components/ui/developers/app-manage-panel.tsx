'use client'

// ============================================
// packages/ui/src/components/ui/developers/app-manage-panel.tsx
//
// One app, from its publisher's side. Props only.
//
//   listing       what the marketplace shows (slug, tagline, category, links,
//                 the disclosed price)
//   draft         what the app asks for (redirect URIs, scopes, webhook
//                 subscription, API version) — the publisher's own
//                 workspace tests THIS; everyone else gets a reviewed version
//   screenshots   up to 8, https URLs
//   versions      submit the draft as a numbered version with a changelog;
//                 the review history
//   analytics     exact counts per day, installs, and health
// ============================================

import { memo, useState } from 'react'
import {
  API_VERSIONS,
  APP_CATEGORIES,
  APP_PRICE_INTERVALS,
  APP_SCREENSHOT_LIMIT,
  CURRENCY_CODES,
  type ApiKeyScope,
  type AppCategory,
  type AppPriceInterval,
  type OAuthAppUpdateInput,
  type WebhookEventType,
} from '@hisabche/validation'
import type { AppScreenshot, AppStats, AppVersionRow, OAuthAppRow } from '@hisabche/api'
import { fractionDigits, type KnownCurrency } from '@hisabche/formatting'
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react'

import { Badge } from '../badge'
import { Button } from '../button'
import { Input } from '../input'
import { SelectField } from '../select-field'
import { parseAmountMinor } from '../../../lib/bank-statement-csv'
import { appCategoryLabel, appHealthLabel, appVersionStatusLabel } from '../../../lib/oauth-labels'
import { CheckList } from './check-list'
import type { SectionState } from './developers-view'

type T = (key: string, fallback?: string) => string

export interface AppManagePanelProps {
  t: T
  formatDate: (iso: string) => string
  scopes: ApiKeyScope[]
  events: WebhookEventType[]
  app: OAuthAppRow
  saving: boolean
  onSave: (patch: OAuthAppUpdateInput) => void
  onRotateWebhookSecret: () => void
  /** The listing as installers see it (a preview while unpublished). */
  listingHref: string | null

  versionsState: SectionState
  versions: AppVersionRow[]
  submitting: boolean
  onSubmitVersion: (input: { version: string; changelog: string }) => void

  screenshotsState: SectionState
  screenshots: AppScreenshot[]
  addingScreenshot: boolean
  onAddScreenshot: (input: { url: string; caption: string }) => void
  /** Upload an image file and resolve with its URL; null when it was refused (the reason is shown by the caller). */
  onUploadImage: (file: File) => Promise<string | null>
  uploadingImage: boolean
  onRemoveScreenshot: (id: string) => void

  statsState: SectionState
  stats: AppStats | null
  days: 7 | 30
  onDays: (days: 7 | 30) => void
}

const scopeKey = (scope: string) => `developer.scope.${scope.replace(':', '_')}`
const eventKey = (event: string) => `developer.event.${event.replace('.', '_')}`

const HEALTH_VARIANT = {
  no_data: 'secondary',
  low_volume: 'secondary',
  healthy: 'success',
  degraded: 'warning',
  failing: 'destructive',
} as const

const VERSION_VARIANT = {
  in_review: 'warning',
  published: 'success',
  rejected: 'destructive',
  superseded: 'secondary',
} as const

const textarea =
  'w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-[hsl(var(--border-default))] pt-3">
      <h4 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">{title}</h4>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-[hsl(var(--fg-secondary))]">{label}</span>
      {children}
    </label>
  )
}

/** Minor units → the text a person edits, exactly (no float on the way). */
function minorToText(minor: number, digits: number): string {
  if (digits === 0) return String(minor)
  const s = String(minor).padStart(digits + 1, '0')
  return `${s.slice(0, -digits)}.${s.slice(-digits)}`
}

export const AppManagePanel = memo(function AppManagePanel(props: AppManagePanelProps) {
  const { t, app } = props

  // ─── listing + draft, edited together, saved together ─────────────────────
  const [slug, setSlug] = useState(app.slug ?? '')
  const [tagline, setTagline] = useState(app.tagline)
  const [category, setCategory] = useState<AppCategory | ''>(app.category ?? '')
  const [description, setDescription] = useState(app.description)
  const [iconUrl, setIconUrl] = useState(app.icon_url ?? '')
  const [homepage, setHomepage] = useState(app.homepage_url ?? '')
  const [privacyUrl, setPrivacyUrl] = useState(app.privacy_url ?? '')
  const [termsUrl, setTermsUrl] = useState(app.terms_url ?? '')
  const [installUrl, setInstallUrl] = useState(app.install_url ?? '')
  const [paid, setPaid] = useState(app.pricing_model === 'paid')
  const [currency, setCurrency] = useState<string>(app.price_currency ?? 'AFN')
  const [interval, setInterval] = useState<AppPriceInterval>(app.price_interval ?? 'month')
  const [price, setPrice] = useState(
    app.price_minor !== null && app.price_currency
      ? minorToText(Number(app.price_minor), fractionDigits(app.price_currency as KnownCurrency))
      : '',
  )
  const [redirects, setRedirects] = useState(app.redirect_uris.join('\n'))
  const [scopes, setScopes] = useState<ApiKeyScope[]>(app.requested_scopes)
  const [webhookUrl, setWebhookUrl] = useState(app.webhook_url ?? '')
  const [events, setEvents] = useState<WebhookEventType[]>(app.webhook_events as WebhookEventType[])
  const [apiVersion, setApiVersion] = useState(app.api_version)

  // The form starts from the SAVED app; the parent remounts it (key) when
  // another app is opened or a save comes back.

  const priceMinor = paid
    ? parseAmountMinor(price, fractionDigits(currency as KnownCurrency))
    : null
  const priceInvalid = paid && (priceMinor === null || priceMinor <= 0)
  const redirectList = redirects
    .split(/\s+/)
    .map((r) => r.trim())
    .filter(Boolean)

  const save = () => {
    if (priceInvalid) return
    const patch: OAuthAppUpdateInput = {
      tagline: tagline.trim(),
      description: description.trim(),
      iconUrl: iconUrl.trim() || null,
      privacyUrl: privacyUrl.trim() || null,
      termsUrl: termsUrl.trim() || null,
      installUrl: installUrl.trim() || null,
      redirectUris: redirectList,
      requestedScopes: scopes,
      webhookUrl: webhookUrl.trim() || null,
      webhookEvents: events,
      apiVersion: apiVersion as OAuthAppUpdateInput['apiVersion'],
      pricing:
        paid && priceMinor !== null
          ? {
              model: 'paid',
              priceMinor,
              currency: currency as Extract<
                OAuthAppUpdateInput['pricing'],
                { model: 'paid' }
              >['currency'],
              interval,
            }
          : { model: 'free' },
    }
    if (slug.trim()) patch.slug = slug.trim()
    if (category) patch.category = category
    if (homepage.trim()) patch.homepageUrl = homepage.trim()
    props.onSave(patch)
  }

  // ─── versions ─────────────────────────────────────────────────────────────
  const [version, setVersion] = useState('')
  const [changelog, setChangelog] = useState('')
  const inReview = props.versions.some((v) => v.status === 'in_review')

  // ─── screenshots ──────────────────────────────────────────────────────────
  const [shotUrl, setShotUrl] = useState('')
  const [shotCaption, setShotCaption] = useState('')

  return (
    <div className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] p-3">
      {props.listingHref && (
        <a
          href={props.listingHref}
          className="inline-flex items-center gap-1 text-sm text-[hsl(var(--color-primary))] underline-offset-4 hover:underline"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          {t('oauth.manage.viewListing')}
        </a>
      )}

      <Section title={t('oauth.manage.listing')}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label={t('oauth.manage.slug')}>
            <Input
              name="slug"
              dir="ltr"
              value={slug}
              maxLength={60}
              placeholder="shop-sync"
              onChange={(e) => setSlug(e.target.value)}
            />
          </Field>
          <Field label={t('oauth.manage.category')}>
            <SelectField
              name="category"
              data-field="category"
              value={category}
              onChange={(v) => setCategory(v as AppCategory)}
              options={APP_CATEGORIES.map((c) => ({ value: c, label: appCategoryLabel(t, c) }))}
            />
          </Field>
          <Field label={t('oauth.manage.tagline')}>
            <Input
              name="tagline"
              value={tagline}
              maxLength={120}
              onChange={(e) => setTagline(e.target.value)}
            />
          </Field>
          <Field label={t('oauth.manage.iconUrl')}>
            <Input
              name="iconUrl"
              dir="ltr"
              value={iconUrl}
              placeholder="https://"
              onChange={(e) => setIconUrl(e.target.value)}
            />
            <ImageUpload
              label={t('oauth.manage.uploadImage')}
              busy={props.uploadingImage}
              onFile={async (file) => {
                const url = await props.onUploadImage(file)
                if (url) setIconUrl(url)
              }}
            />
          </Field>
          <Field label={t('oauth.homepage')}>
            <Input
              name="homepageUrl"
              dir="ltr"
              value={homepage}
              placeholder="https://"
              onChange={(e) => setHomepage(e.target.value)}
            />
          </Field>
          <Field label={t('oauth.manage.installUrl')}>
            <Input
              name="installUrl"
              dir="ltr"
              value={installUrl}
              placeholder="https://"
              onChange={(e) => setInstallUrl(e.target.value)}
            />
          </Field>
          <Field label={t('oauth.manage.privacyUrl')}>
            <Input
              name="privacyUrl"
              dir="ltr"
              value={privacyUrl}
              placeholder="https://"
              onChange={(e) => setPrivacyUrl(e.target.value)}
            />
          </Field>
          <Field label={t('oauth.manage.termsUrl')}>
            <Input
              name="termsUrl"
              dir="ltr"
              value={termsUrl}
              placeholder="https://"
              onChange={(e) => setTermsUrl(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('oauth.appDescription')}>
          <textarea
            name="description"
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={textarea}
          />
        </Field>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.manage.installUrlHelp')}</p>

        <div className="space-y-2" data-field="pricing">
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('oauth.manage.pricing')}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="pricingModel"
                checked={!paid}
                onChange={() => setPaid(false)}
              />
              {t('oauth.pricing.free')}
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="pricingModel"
                checked={paid}
                onChange={() => setPaid(true)}
              />
              {t('oauth.pricing.paid')}
            </label>
          </div>
          {paid && (
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label={t('oauth.manage.price')}>
                <Input
                  name="priceMinor"
                  dir="ltr"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </Field>
              <Field label={t('oauth.manage.currency')}>
                <SelectField
                  name="currency"
                  value={currency}
                  onChange={setCurrency}
                  options={CURRENCY_CODES.map((c) => ({ value: c, label: c }))}
                />
              </Field>
              <Field label={t('oauth.manage.interval')}>
                <SelectField
                  name="interval"
                  value={interval}
                  onChange={(v) => setInterval(v as AppPriceInterval)}
                  options={APP_PRICE_INTERVALS.map((i) => ({
                    value: i,
                    label: t(`oauth.pricing.per.${i}`),
                  }))}
                />
              </Field>
            </div>
          )}
          {priceInvalid && (
            <p className="text-xs text-[hsl(var(--color-destructive))]">
              {t('oauth.manage.priceInvalid')}
            </p>
          )}
          <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.manage.pricingHelp')}</p>
        </div>
      </Section>

      <Section title={t('oauth.manage.draft')}>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.manage.draftHelp')}</p>
        <Field label={t('oauth.redirectUris')}>
          <textarea
            name="redirectUris"
            dir="ltr"
            rows={2}
            value={redirects}
            onChange={(e) => setRedirects(e.target.value)}
            className={textarea}
          />
        </Field>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('oauth.scopes')}</p>
        <CheckList
          name="requestedScopes"
          values={props.scopes}
          selected={scopes}
          onChange={setScopes}
          label={(s) => t(scopeKey(s), s)}
        />
        <Field label={t('oauth.manage.webhookUrl')}>
          <Input
            name="webhookUrl"
            dir="ltr"
            value={webhookUrl}
            placeholder="https://"
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </Field>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.manage.webhookHelp')}</p>
        <CheckList
          name="webhookEvents"
          values={props.events}
          selected={events}
          onChange={setEvents}
          label={(e) => t(eventKey(e), e)}
        />
        <Field label={t('oauth.manage.apiVersion')}>
          <SelectField
            name="apiVersion"
            value={apiVersion}
            onChange={setApiVersion}
            options={API_VERSIONS.map((v) => ({ value: v, label: v }))}
          />
        </Field>
      </Section>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={props.saving} disabled={priceInvalid} onClick={save}>
          {t('oauth.manage.save')}
        </Button>
        {app.webhook_url && app.webhook_events.length > 0 && (
          <Button size="sm" variant="outline" onClick={props.onRotateWebhookSecret}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('oauth.manage.rotateWebhookSecret')}
          </Button>
        )}
      </div>

      <Section title={t('oauth.manage.screenshots')}>
        {props.screenshotsState !== 'ready' ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {props.screenshotsState === 'loading'
              ? t('developer.loading')
              : t('developer.loadError')}
          </p>
        ) : props.screenshots.length === 0 ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t('oauth.manage.noScreenshots')}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {props.screenshots.map((s) => (
              <li
                key={s.id}
                className="space-y-1 rounded-lg bg-[hsl(var(--surface-muted))] p-2 text-xs"
              >
                <img
                  src={s.url}
                  alt={s.caption}
                  loading="lazy"
                  className="aspect-video w-full rounded object-cover"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{s.caption}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('developer.delete')}
                    onClick={() => props.onRemoveScreenshot(s.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {props.screenshots.length < APP_SCREENSHOT_LIMIT && (
          <form
            className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault()
              if (!shotUrl.trim().startsWith('https://')) return
              props.onAddScreenshot({ url: shotUrl.trim(), caption: shotCaption.trim() })
              setShotUrl('')
              setShotCaption('')
            }}
          >
            <Input
              name="url"
              dir="ltr"
              value={shotUrl}
              placeholder="https://…/screenshot.png"
              aria-label={t('oauth.manage.screenshotUrl')}
              onChange={(e) => setShotUrl(e.target.value)}
            />
            <div className="sm:col-span-3">
              <ImageUpload
                label={t('oauth.manage.uploadImage')}
                busy={props.uploadingImage}
                onFile={async (file) => {
                  const url = await props.onUploadImage(file)
                  if (url) setShotUrl(url)
                }}
              />
            </div>
            <Input
              name="caption"
              value={shotCaption}
              maxLength={200}
              placeholder={t('oauth.manage.caption')}
              aria-label={t('oauth.manage.caption')}
              onChange={(e) => setShotCaption(e.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              loading={props.addingScreenshot}
              disabled={!shotUrl.trim().startsWith('https://')}
            >
              {t('oauth.manage.addScreenshot')}
            </Button>
          </form>
        )}
      </Section>

      <Section title={t('oauth.manage.versions')}>
        <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.manage.versionsHelp')}</p>
        {props.versionsState === 'ready' ? (
          props.versions.length === 0 ? (
            <p className="text-sm text-[hsl(var(--fg-secondary))]">
              {t('oauth.manage.noVersions')}
            </p>
          ) : (
            <ul className="space-y-2">
              {props.versions.map((v) => (
                <li
                  key={v.id}
                  className="space-y-1 rounded-lg bg-[hsl(var(--surface-muted))] p-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span dir="ltr" className="font-mono">
                      {v.version}
                    </span>
                    <Badge variant={VERSION_VARIANT[v.status] ?? 'secondary'}>
                      {appVersionStatusLabel(t, v.status)}
                    </Badge>
                    <span className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {props.formatDate(v.published_at ?? v.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-line text-xs text-[hsl(var(--fg-secondary))]">
                    {v.changelog}
                  </p>
                  {v.review_note && (
                    <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                      {t('oauth.reviewNote')}: {v.review_note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {props.versionsState === 'loading' ? t('developer.loading') : t('developer.loadError')}
          </p>
        )}
        {inReview ? (
          <p className="text-xs text-[hsl(var(--fg-secondary))]">
            {t('oauth.error.VERSION_IN_REVIEW')}
          </p>
        ) : (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!version.trim() || !changelog.trim()) return
              props.onSubmitVersion({ version: version.trim(), changelog: changelog.trim() })
              setVersion('')
              setChangelog('')
            }}
          >
            <Input
              name="version"
              dir="ltr"
              value={version}
              placeholder="1.0.0"
              aria-label={t('oauth.manage.versionNumber')}
              onChange={(e) => setVersion(e.target.value)}
            />
            <textarea
              name="changelog"
              rows={3}
              maxLength={5000}
              value={changelog}
              placeholder={t('oauth.manage.changelog')}
              aria-label={t('oauth.manage.changelog')}
              onChange={(e) => setChangelog(e.target.value)}
              className={textarea}
            />
            <Button
              type="submit"
              size="sm"
              loading={props.submitting}
              disabled={!version.trim() || !changelog.trim()}
            >
              {t('oauth.submit')}
            </Button>
          </form>
        )}
      </Section>

      <Section title={t('oauth.manage.analytics')}>
        <div className="flex gap-2">
          {([7, 30] as const).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={props.days === d ? 'default' : 'outline'}
              onClick={() => props.onDays(d)}
            >
              {d === 7 ? t('oauth.manage.days7') : t('oauth.manage.days30')}
            </Button>
          ))}
        </div>
        {props.statsState !== 'ready' || !props.stats ? (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {props.statsState === 'loading' ? t('developer.loading') : t('developer.loadError')}
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span>{t('oauth.manage.health')}:</span>
              <Badge variant={HEALTH_VARIANT[props.stats.health.level] ?? 'secondary'}>
                {appHealthLabel(t, props.stats.health.level)}
              </Badge>
            </div>
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('oauth.manage.healthHelp')}</p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ['oauth.manage.activeInstalls', props.stats.installs.active],
                  ['oauth.manage.installedInPeriod', props.stats.installs.installedInPeriod],
                  ['oauth.manage.uninstalledInPeriod', props.stats.installs.uninstalledInPeriod],
                  ['oauth.manage.requests24h', props.stats.requests24h],
                  ['oauth.manage.serverErrors24h', props.stats.serverErrors24h],
                  ['oauth.manage.deliveries24h', props.stats.deliveries24h],
                  ['oauth.manage.failedDeliveries24h', props.stats.failedDeliveries24h],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="rounded-lg bg-[hsl(var(--surface-muted))] p-2">
                  <dt className="text-xs text-[hsl(var(--fg-tertiary))]">{t(key)}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {props.stats.usage.length === 0 ? (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('oauth.manage.noUsage')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[hsl(var(--fg-tertiary))]">
                      <th className="p-1 text-start">{t('developer.usageDay')}</th>
                      <th className="p-1 text-end">{t('developer.usageRequests')}</th>
                      <th className="p-1 text-end">{t('developer.usageClientErrors')}</th>
                      <th className="p-1 text-end">{t('developer.usageServerErrors')}</th>
                      <th className="p-1 text-end">{t('developer.usageAvgMs')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.stats.usage.map((u) => (
                      <tr key={u.day} className="tabular-nums">
                        <td className="p-1">{props.formatDate(u.day)}</td>
                        <td className="p-1 text-end">{u.requests}</td>
                        <td className="p-1 text-end">{u.clientErrors}</td>
                        <td className="p-1 text-end">{u.serverErrors}</td>
                        <td className="p-1 text-end">{u.avgMs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  )
})

AppManagePanel.displayName = 'AppManagePanel'

/**
 * Pick an image file. The server decides the type from the bytes and stores
 * it; the field above is then filled with the stored URL — so the listing's
 * images are ours, and cannot change behind a reviewed URL.
 */
function ImageUpload({
  label,
  busy,
  onFile,
}: {
  label: string
  busy: boolean
  onFile: (file: File) => Promise<void>
}) {
  return (
    <label className="mt-1 inline-flex cursor-pointer items-center gap-2 text-xs text-[hsl(var(--color-primary))]">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void onFile(file)
        }}
      />
      <span className="underline">{label}</span>
    </label>
  )
}
